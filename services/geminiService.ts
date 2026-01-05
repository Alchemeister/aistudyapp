
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

// --- Question Distribution by Difficulty ---
interface QuestionDistribution {
  MC: number;
  TF: number;
  FILL_BLANK: number;
  MATCHING: number;
  SHORT_ANSWER: number;
}

const getQuestionDistribution = (difficulty: Difficulty, totalCount: number): QuestionDistribution => {
  // Distribution percentages by difficulty
  // Easy: More T/F and MC (straightforward)
  // Medium: Balanced mix
  // Hard: More fill-blank, matching, short answer (challenging)

  const distributions: Record<Difficulty, { MC: number; TF: number; FILL_BLANK: number; MATCHING: number; SHORT_ANSWER: number }> = {
    [Difficulty.EASY]: { MC: 0.40, TF: 0.50, FILL_BLANK: 0.10, MATCHING: 0, SHORT_ANSWER: 0 },
    [Difficulty.MEDIUM]: { MC: 0.35, TF: 0.25, FILL_BLANK: 0.20, MATCHING: 0.15, SHORT_ANSWER: 0.05 },
    [Difficulty.HARD]: { MC: 0.15, TF: 0.05, FILL_BLANK: 0.30, MATCHING: 0.25, SHORT_ANSWER: 0.25 },
  };

  const dist = distributions[difficulty] || distributions[Difficulty.MEDIUM];

  // Calculate counts, ensuring at least 1 of each non-zero type and total matches
  let counts: QuestionDistribution = {
    MC: Math.round(totalCount * dist.MC),
    TF: Math.round(totalCount * dist.TF),
    FILL_BLANK: Math.round(totalCount * dist.FILL_BLANK),
    MATCHING: Math.round(totalCount * dist.MATCHING),
    SHORT_ANSWER: Math.round(totalCount * dist.SHORT_ANSWER),
  };

  // Adjust to match total (rounding may cause off-by-one)
  let sum = counts.MC + counts.TF + counts.FILL_BLANK + counts.MATCHING + counts.SHORT_ANSWER;
  const diff = totalCount - sum;

  if (diff !== 0) {
    // Add/subtract from the largest category
    if (difficulty === Difficulty.EASY) {
      counts.TF += diff;
    } else if (difficulty === Difficulty.HARD) {
      counts.FILL_BLANK += diff;
    } else {
      counts.MC += diff;
    }
  }

  return counts;
};

const cleanConceptConnections = (data: any[]): any[] => {
  if (!Array.isArray(data)) return [];
  return data
    .map((item, index) => ({
      id: item.id || `conn-${index}`,
      concept: item.concept || "",
      relatedConcepts: Array.isArray(item.relatedConcepts) ? item.relatedConcepts : [],
      relationship: item.relationship || "relates to",
      explanation: item.explanation || "",
      source: item.source || ""
    }))
    .filter(item =>
      item.concept && item.concept.trim().length > 0 &&
      item.relatedConcepts.length >= 2
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
      // Difficulty-specific question type guidance
      const questionTypeGuidance = difficulty === 5
        ? "Focus on: Analysis ('Why does X cause Y?'), Synthesis ('How do X and Y interact?'), Edge cases, and Comparisons ('How does X differ from Y?')."
        : difficulty === 3
          ? "Mix of: Definitions ('What is X?'), Applications ('When would you use X?'), and Cause/Effect ('What results from X?')."
          : "Focus on: Basic definitions ('What is X?'), Simple recall ('Name the parts of X'), and Direct facts.";

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `
          Generate exactly ${count} high-quality flashcards based on the source text.

          Context Source Name: "${contextTitle}"
          Difficulty: ${difficultyPrompt}

          FLASHCARD QUALITY RULES:
          1. ONE concept per card (atomic facts only - never combine multiple ideas)
          2. ${questionTypeGuidance}
          3. Front side: Complete question or clear directive (never vague)
          4. Back side: Direct answer FIRST, then 1 brief supporting detail if needed
          5. AVOID: Yes/No questions, overly broad questions, multi-part questions
          6. Include context clues in questions when the concept could be ambiguous
          7. Use specific terminology from the source material

          OUTPUT FORMAT:
          Return a raw JSON Array. Do not wrap in markdown.
          [
            {
              "front": "What is the primary function of mitochondria in cellular respiration?",
              "back": "ATP production through oxidative phosphorylation. The inner membrane contains the electron transport chain.",
              "source": "${contextTitle} - Ch 1: The Cell, Page 5"
            }
          ]

          BAD EXAMPLES (avoid these patterns):
          - "What is biology?" (too vague)
          - "Is the mitochondria important?" (yes/no)
          - "Name and describe all organelles" (multi-part)

          GOOD EXAMPLES:
          - "What organelle is called the 'powerhouse of the cell' and why?"
          - "How does the structure of the mitochondrial membrane support ATP synthesis?"
          - "Compare the function of smooth vs rough endoplasmic reticulum."

          STRICT RULES:
          1. 'front': MUST be a complete question or directive.
          2. 'back': Direct answer first, keep under 3 sentences total.
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

      // Get difficulty-based question type distribution
      const dist = getQuestionDistribution(difficulty, qCount);

      // Build distribution string for prompt
      const distributionParts: string[] = [];
      if (dist.MC > 0) distributionParts.push(`- ${dist.MC} Multiple Choice (MC) questions with exactly 4 options`);
      if (dist.TF > 0) distributionParts.push(`- ${dist.TF} True/False (TF) questions`);
      if (dist.FILL_BLANK > 0) distributionParts.push(`- ${dist.FILL_BLANK} Fill in the Blank (FILL_BLANK) questions (answer should be 1-2 words)`);
      if (dist.MATCHING > 0) distributionParts.push(`- ${dist.MATCHING} Matching (MATCHING) questions with a word bank of 4-6 options`);
      if (dist.SHORT_ANSWER > 0) distributionParts.push(`- ${dist.SHORT_ANSWER} Short Answer (SHORT_ANSWER) questions requiring 1-2 sentence responses`);

      const distributionString = distributionParts.join('\n');

      const prompt = `Create an assessment with EXACTLY ${qCount} questions based on "${contextTitle}".

Difficulty: ${difficultyPrompt}

REQUIRED QUESTION DISTRIBUTION (you MUST follow this exactly):
${distributionString}

QUESTION TYPE FORMATS:

MC (Multiple Choice):
{
  "type": "MC",
  "text": "Question text?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": "Option A",
  "explanation": "Why this is correct.",
  "source": "${contextTitle} - Ch X, p.Y"
}

TF (True/False):
{
  "type": "TF",
  "text": "Statement to evaluate.",
  "options": ["True", "False"],
  "correctAnswer": "True",
  "explanation": "Why this is true/false.",
  "source": "${contextTitle} - Ch X, p.Y"
}

FILL_BLANK (Fill in the Blank):
{
  "type": "FILL_BLANK",
  "text": "The _____ is the powerhouse of the cell.",
  "options": [],
  "correctAnswer": "mitochondria",
  "explanation": "The mitochondria produces ATP.",
  "source": "${contextTitle} - Ch X, p.Y"
}

MATCHING (Word Bank):
{
  "type": "MATCHING",
  "text": "Select the term that describes: the process of cell division",
  "options": ["Mitosis", "Meiosis", "Photosynthesis", "Respiration", "Osmosis"],
  "correctAnswer": "Mitosis",
  "explanation": "Mitosis is the process of cell division.",
  "source": "${contextTitle} - Ch X, p.Y"
}

SHORT_ANSWER:
{
  "type": "SHORT_ANSWER",
  "text": "Explain the role of enzymes in digestion.",
  "options": [],
  "correctAnswer": "Enzymes break down food molecules into smaller components that can be absorbed.",
  "keywords": ["break down", "molecules", "absorbed"],
  "explanation": "Enzymes catalyze digestive reactions.",
  "source": "${contextTitle} - Ch X, p.Y"
}

STRICT RULES:
1. Follow the EXACT distribution above - count your questions!
2. TF questions MUST have "options": ["True", "False"]
3. MC questions MUST have exactly 4 options
4. FILL_BLANK answers should be 1-2 words only
5. SHORT_ANSWER must include "keywords" array for grading
6. Every question needs a "source" field with page reference
7. Return ONLY a JSON array, no markdown

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

    // Concept Connections
    if (type === ContentType.CONCEPT_CONNECTIONS) {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `
          Extract and map concept connections from the source material.
          Identify ${count} key concepts and show how they relate to other concepts.

          Context Source Name: "${contextTitle}"
          Difficulty: ${difficultyPrompt}

          OUTPUT FORMAT (JSON Array):
          [
            {
              "concept": "Photosynthesis",
              "relatedConcepts": ["Chlorophyll", "ATP", "Glucose", "Carbon Dioxide", "Sunlight"],
              "relationship": "produces",
              "explanation": "Photosynthesis uses chlorophyll to capture sunlight, converting CO2 and water into glucose and ATP for energy storage.",
              "source": "${contextTitle} - Ch 5, p.120"
            }
          ]

          RULES:
          1. Each concept must have 3-5 related concepts
          2. "relationship" should be a verb or phrase describing the connection type:
             - "causes", "requires", "is part of", "produces", "inhibits", "regulates", "enables", "depends on"
          3. "explanation" must be 1-2 sentences explaining HOW the concepts connect
          4. Focus on the most important/foundational concepts from the material
          5. Related concepts should be specific terms from the source, not generic words
          6. Include page numbers in "source" field when available
          7. Return ONLY a JSON array, no markdown

          Source Material:
          ${safeText}
        `,
        config: {
          responseMimeType: "application/json",
        }
      });

      const raw = cleanAndParseJson(response.text || "[]");
      return cleanConceptConnections(raw);
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

// TOC Entry interface for type safety
export interface TOCEntry {
  title: string;
  start_page: number;
  level: number;        // 1 = chapter, 2 = section/subsection
  children?: TOCEntry[];
}

export const parseTableOfContents = async (fullText: string): Promise<TOCEntry[]> => {
  const ai = getAiClient();
  if (!ai) return [];

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `
        Analyze this text from the first 30 pages of a PDF and extract the Table of Contents structure.

        TASK: Identify chapters and their sections/subsections with page numbers.

        RULES:
        1. "level": 1 = Main chapter/unit, 2 = Section/subsection within a chapter
        2. Only include actual content chapters (skip preface, acknowledgments, index, appendix unless they're substantial)
        3. Look for patterns like:
           - "Chapter 1: Title ........ 15"
           - "1.1 Section Name .... 20"
           - Numbered sections (1, 1.1, 1.2, 2, 2.1, etc.)
           - Roman numerals for chapters
        4. If page numbers have patterns like "1-15" or "Ch1-15", extract just the number
        5. Subsections (level 2) should be grouped under their parent chapter in the "children" array
        6. If no clear hierarchy exists, mark everything as level 1

        OUTPUT FORMAT (JSON Array):
        [
          {
            "title": "Chapter 1: Introduction to Biology",
            "start_page": 1,
            "level": 1,
            "children": [
              { "title": "1.1 What is Biology?", "start_page": 3, "level": 2 },
              { "title": "1.2 The Scientific Method", "start_page": 8, "level": 2 }
            ]
          },
          {
            "title": "Chapter 2: Cell Structure",
            "start_page": 25,
            "level": 1,
            "children": []
          }
        ]

        IMPORTANT:
        - Return ONLY valid JSON array
        - Include "children" array even if empty
        - Page numbers must be positive integers
        - Titles should be cleaned (no trailing dots/leaders)

        TEXT TO ANALYZE:
        ${fullText.substring(0, 15000)}
      `,
      config: {
        responseMimeType: "application/json",
      }
    });

    const parsed = cleanAndParseJson(response.text || "[]");

    // Clean and validate the response
    return parsed
      .filter((item: any) => item.title && typeof item.start_page === 'number' && item.start_page > 0)
      .map((item: any) => ({
        title: String(item.title).replace(/\.{2,}/g, '').trim(),
        start_page: Math.max(1, Math.floor(item.start_page)),
        level: item.level === 2 ? 2 : 1,
        children: Array.isArray(item.children)
          ? item.children
              .filter((c: any) => c.title && typeof c.start_page === 'number' && c.start_page > 0)
              .map((c: any) => ({
                title: String(c.title).replace(/\.{2,}/g, '').trim(),
                start_page: Math.max(1, Math.floor(c.start_page)),
                level: 2,
              }))
          : []
      }));
  } catch (e) {
    console.error("TOC Parse Error:", e);
    return [];
  }
};
