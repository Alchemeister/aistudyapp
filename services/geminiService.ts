
import { GoogleGenAI, Type } from "@google/genai";
import { ContentType, Difficulty } from "../types";

// FAST MODEL: Gemini 3 Flash (High speed, lower cost)
const MODEL_NAME = "gemini-3-flash-preview"; 

// --- Lazy Load Client ---
const getAiClient = (): GoogleGenAI | null => {
  const key = process.env.API_KEY;
  if (!key || key.trim() === '') {
    console.warn("Gemini API Key is missing. App will use Mock Data.");
    return null;
  }
  return new GoogleGenAI({ apiKey: key });
};

// --- Helper: Clean JSON ---
// STRICT REPAIR: If JSON is truncated, discard the last incomplete item entirely.
const cleanAndParseJson = (text: string): any[] => {
    if (!text) return [];
    
    // 1. Strip markdown code blocks
    let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
        // 2. Try direct parse first
        const res = JSON.parse(clean);
        return Array.isArray(res) ? res : [];
    } catch (e) {
        console.warn("Direct JSON parse failed. Attempting strict repair...");
        
        // 3. Iterative Repair
        // We assume the AI returns an array [...]. If truncated, it ends like `... {"front": "abc", "back"`
        // We search backwards for the last closing brace `}`. 
        // We cut everything after it, append `]`, and try to parse.
        // We repeat this (moving backwards) until we find a valid array or run out of braces.
        
        let lastBraceIndex = clean.lastIndexOf('}');
        
        while (lastBraceIndex > 0) {
            // Construct a potential valid JSON string ending at this brace
            const attempt = clean.substring(0, lastBraceIndex + 1) + ']';
            
            try {
                const result = JSON.parse(attempt);
                if (Array.isArray(result)) {
                    console.log(`Repaired JSON. Recovered ${result.length} items.`);
                    return result;
                }
            } catch (parseErr) {
                // This brace wasn't a valid end of an object in the array context.
                // Move to the previous closing brace.
                lastBraceIndex = clean.lastIndexOf('}', lastBraceIndex - 1);
            }
        }
        
        console.error("Failed to parse or repair AI response.");
        return [];
    }
};

// --- Mock Data Helpers ---
const getMockData = (type: ContentType, count: number) => {
  const mockId = () => Math.random().toString(36).substr(2, 9);
  
  if (type === ContentType.FLASHCARDS) {
    return Array(Math.min(count, 5)).fill(0).map((_, i) => ({
      front: `[Mock] What is the definition of Concept ${i + 1}?`,
      back: `This is a mock definition for concept ${i + 1}. The real AI generation requires a valid API key.`,
      source: "Textbook Name - Ch 1, Page 15",
      mastered: false
    }));
  }
  
  if (type === ContentType.QUIZ || type === ContentType.MOCK_TEST) {
    return [
        {
            id: mockId(),
            text: "Which organelle is known as the powerhouse of the cell?",
            type: 'MC',
            options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi Apparatus'],
            correctAnswer: 'Mitochondria',
            explanation: "Mitochondria produce ATP, the cell's main energy source.",
            source: "Bio 101 - Ch 3, Page 45"
        },
        {
            id: mockId(),
            text: "The plasma membrane is impermeable to all substances.",
            type: 'TF',
            options: ['True', 'False'],
            correctAnswer: 'False',
            explanation: "It is selectively permeable.",
            source: "Bio 101 - Ch 3, Page 48"
        }
    ].slice(0, count);
  }

  return `[Mock Generated Content]\n\nThis is a placeholder summary because the Gemini API Key is missing.`;
};

// --- Validation Helpers ---
const cleanFlashcards = (data: any[]): any[] => {
    if (!Array.isArray(data)) return [];
    return data
        .map(item => {
            const front = item.front || item.term || item.question || "";
            const back = item.back || item.definition || item.answer || "";
            const source = item.source || "";
            return { ...item, front, back, source };
        })
        .filter(item => 
            // Strict check: Must have content
            item.front && typeof item.front === 'string' && item.front.trim().length > 0 &&
            item.back && typeof item.back === 'string' && item.back.trim().length > 0
        );
};

const cleanQuestions = (data: any[]): any[] => {
    if (!Array.isArray(data)) return [];
    return data
        .map(item => {
            // Normalize Type
            let type = item.type || (item.options ? 'MC' : 'OPEN');
            let options = item.options || [];

            // Repair TF questions missing options
            if (type === 'TF' && (!options || options.length === 0)) {
                options = ['True', 'False'];
            }
            
            // Repair MC questions missing options (Fallback to Open if completely broken)
            if (type === 'MC' && (!options || options.length === 0)) {
                 type = 'OPEN'; // Auto-convert to open ended if no options
            }

            return {
                ...item,
                type: type,
                text: item.text || item.question || "Question text missing",
                options: options,
                correctAnswer: item.correctAnswer || item.answer || "",
                explanation: item.explanation || "",
                source: item.source || ""
            };
        })
        .filter(item => item.text && item.text.trim().length > 0);
};

export const generateContent = async (
  text: string,
  type: ContentType,
  difficulty: Difficulty,
  contextTitle: string = "Course Material", 
  count: number = 10
): Promise<any> => {
  
  const ai = getAiClient();

  if (!ai) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return getMockData(type, count);
  }

  if (!text || text.trim().length < 20) {
      console.warn("Generation aborted: Source text is empty or too short.");
      throw new Error("SOURCE_TEXT_EMPTY"); 
  }

  // Optimized prompts to ensure concise output -> Faster generation -> Less timeouts
  const difficultyPrompt = difficulty === 5 
    ? "Expert level concepts. IMPORTANT: Keep definitions CONCISE (max 2-3 sentences) but rigorous. Do not write paragraphs." 
    : difficulty === 3 
      ? "Undergraduate level. Focus on core concepts. Keep answers brief and accurate." 
      : "Introductory level. Simple and direct definitions.";

  // CRITICAL: Maintain large context window (200k chars) so we don't lose data
  // but use the fast model to process it.
  const safeText = text.substring(0, 200000); 

  try {
    if (type === ContentType.FLASHCARDS) {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `
          Generate exactly ${count} flashcards based on the source text.
          
          Context Source Name: "${contextTitle}"
          Difficulty: ${difficultyPrompt}
          
          OUTPUT FORMAT:
          Return a raw JSON Array. Do not wrap in markdown.
          [
            { 
              "front": "Question", 
              "back": "Concise Answer", 
              "source": "${contextTitle} - Ch 1: The Cell, Page 5" 
            }
          ]

          STRICT RULES:
          1. 'front': MUST be a complete question or directive.
          2. 'back': Accurate but SHORT explanation.
          3. 'source': YOU MUST INCLUDE the specific "Book/Note Name" AND "Page Number" (if available). E.g., "${contextTitle} - Ch 3, p.42".
          4. Ensure valid JSON.
          
          Source Material:
          ${safeText}
        `,
        config: {
          responseMimeType: "application/json",
        }
      });
      
      const raw = cleanAndParseJson(response.text || "[]");
      return cleanFlashcards(raw);
    }

    if (type === ContentType.QUIZ || type === ContentType.MOCK_TEST) {
      const isMock = type === ContentType.MOCK_TEST;
      const qCount = isMock ? count : 10;
      
      let prompt = `Create a ${qCount} question assessment based on "${contextTitle}". Difficulty: ${difficultyPrompt}.`;
      
      if (isMock) {
        prompt += `
        Mix of: 'MC' (4 opts), 'TF', 'FILL_BLANK' (1 word), 'MATCHING', 'SHORT_ANSWER'.
        `;
      } else {
        prompt += `Focus on 'MC' and 'TF'.`;
      }

      prompt += `
      OUTPUT FORMAT (JSON Array):
      [
        {
          "id": "1",
          "type": "MC",
          "text": "Question?",
          "options": ["A","B","C","D"],
          "correctAnswer": "A",
          "explanation": "Why A is correct.",
          "source": "${contextTitle} - Ch 2, p.15"
        }
      ]
      
      IMPORTANT:
      - For 'TF' (True/False) questions, YOU MUST provide "options": ["True", "False"].
      - 'source': YOU MUST INCLUDE the "Book/Note Name" AND "Page Number" (if available).
      
      Source Material:
      ${safeText}`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });
      
      const raw = cleanAndParseJson(response.text || "[]");
      return cleanQuestions(raw);
    }

    // Notes / Mindmap
    if (type === ContentType.NOTES || type === ContentType.MINDMAP || type === ContentType.ACTIVE_RECALL) {
      let prompt = "";
      if (type === ContentType.NOTES) prompt = "Generate concise Cornell-style notes (Main Points, Details, Summary).";
      if (type === ContentType.MINDMAP) prompt = "Generate a text-based hierarchical mind map (markdown bullets).";
      if (type === ContentType.ACTIVE_RECALL) prompt = `Generate ${count} Active Recall questions (no answers).`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `${prompt} Context: ${contextTitle}. Source Material: ${safeText}`,
        config: { 
            responseMimeType: "text/plain",
        }
      });
      return response.text;
    }

  } catch (error: any) {
    console.error("Gemini Gen Error:", error);
    if (error.message === "SOURCE_TEXT_EMPTY") throw error;
    if (!process.env.API_KEY) return getMockData(type, count);
    return []; 
  }
};

export const fixFlashcardContent = async (
  contextText: string,
): Promise<{ front: string; back: string }> => {
  const ai = getAiClient();
  if (!ai) return { front: "Error", back: "No API Key" };

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Fix/Improve flashcard. Input: ${contextText.substring(0, 1000)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            front: { type: Type.STRING },
            back: { type: Type.STRING },
          }
        }
      }
    });
    // Use the same robust cleaner for the fix function
    const fixedArr = cleanAndParseJson(response.text || "[]");
    const data = fixedArr[0] || {};
    return { front: data.front || "Error", back: data.back || "Could not fix" };
  } catch (e) {
    return { front: "Error", back: "API Error" };
  }
};

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  const ai = getAiClient();
  if (!ai) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return "[Mock Transcription] Need API Key.";
  }

  try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
              const base64Data = reader.result as string;
              const base64Content = base64Data.split(',')[1];
              resolve(base64Content);
          };
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
      });
      
      const base64Audio = await base64Promise;

      const response = await ai.models.generateContent({
          model: MODEL_NAME, 
          contents: {
              parts: [
                  { inlineData: { mimeType: audioBlob.type, data: base64Audio } },
                  { text: "Transcribe this audio verbatim." }
              ]
          }
      });
      
      return response.text || "Transcription failed.";
  } catch (e) {
      console.error("Transcription Error:", e);
      return "Error during transcription.";
  }
};

export const parseTableOfContents = async (fullText: string): Promise<any[]> => {
  const ai = getAiClient();
  if (!ai) return [];

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME, 
      contents: `Extract main chapters (Title and Start Page) from this TOC text: ${fullText.substring(0, 10000)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              start_page: { type: Type.NUMBER },
            }
          }
        }
      }
    });
    return cleanAndParseJson(response.text || "[]");
  } catch (e) {
    return [];
  }
};
