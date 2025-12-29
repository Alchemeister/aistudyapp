import { GoogleGenAI, Type } from "@google/genai";
import { ContentType, Difficulty } from "../types";

// The API key is injected via Vite's `define` config mapping VITE_GEMINI_API_KEY to process.env.API_KEY
const MODEL_NAME = "gemini-3-flash-preview"; 

// --- Lazy Load Client ---
// We do NOT initialize 'ai' here to prevent crashes on module load.
// It is initialized only when needed inside getAiClient().
const getAiClient = (): GoogleGenAI | null => {
  const key = process.env.API_KEY;
  // If key is missing or empty string (safeguarded by vite config), return null for mock mode
  if (!key || key.trim() === '') {
    console.warn("Gemini API Key is missing. App will use Mock Data.");
    return null;
  }
  return new GoogleGenAI({ apiKey: key });
};

// --- Mock Data Helpers ---
const getMockData = (type: ContentType, count: number) => {
  const mockId = () => Math.random().toString(36).substr(2, 9);
  
  if (type === ContentType.FLASHCARDS) {
    return Array(Math.min(count, 3)).fill(0).map((_, i) => ({
      front: `[Mock] Sample Flashcard ${i + 1}`,
      back: "This is a generated placeholder because the API Key is missing.",
      mastered: false
    }));
  }
  
  if (type === ContentType.QUIZ) {
    return Array(Math.min(count, 3)).fill(0).map((_, i) => ({
      id: mockId(),
      text: `[Mock] Sample Question ${i + 1}: What is the capital of France?`,
      type: 'MC',
      options: ['London', 'Berlin', 'Paris', 'Madrid'],
      correctAnswer: 'Paris',
      explanation: "Paris is the capital of France. (Mock Data)"
    }));
  }

  return `[Mock Generated Content]\n\nThis is a placeholder summary because the Gemini API Key is missing in your environment variables.\n\nTo fix this:\n1. Create a .env file\n2. Add VITE_GEMINI_API_KEY=your_key_here\n3. Restart the server.`;
};

export const generateContent = async (
  text: string,
  type: ContentType,
  difficulty: Difficulty,
  context: string = "",
  count: number = 10
): Promise<any> => {
  
  // Initialize AI lazily
  const ai = getAiClient();

  // FALLBACK: If no API key, return mock data immediately
  if (!ai) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    return getMockData(type, count);
  }

  const difficultyPrompt = difficulty === 5 
    ? "Expert level, deep analysis required." 
    : difficulty === 3 
      ? "Undergraduate level, focus on concepts." 
      : "Introductory level, focus on definitions.";

  try {
    if (type === ContentType.FLASHCARDS) {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Create ${count} flashcards. Context: ${context}. Difficulty: ${difficultyPrompt}. Text: ${text.substring(0, 8000)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                front: { type: Type.STRING },
                back: { type: Type.STRING },
                mastered: { type: Type.BOOLEAN },
              }
            }
          }
        }
      });
      const data = JSON.parse(response.text || "[]");
      return data.filter((item: any) => item.front && item.back);
    }

    if (type === ContentType.QUIZ) {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Create ${count} multiple choice questions. Context: ${context}. Difficulty: ${difficultyPrompt}. Text: ${text.substring(0, 8000)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                text: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['MC', 'TF'] },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING }
              }
            }
          }
        }
      });
      return JSON.parse(response.text || "[]");
    }

    if (type === ContentType.NOTES || type === ContentType.MINDMAP || type === ContentType.ACTIVE_RECALL) {
      let prompt = "";
      if (type === ContentType.NOTES) prompt = "Generate structured Cornell-style notes.";
      if (type === ContentType.MINDMAP) prompt = "Generate a text-based hierarchical mind map using markdown bullet points.";
      if (type === ContentType.ACTIVE_RECALL) prompt = `Generate a list of ${count} Active Recall questions without answers, intended for self-testing.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `${prompt} Context: ${context}. Text: ${text.substring(0, 8000)}`,
        config: { responseMimeType: "text/plain" }
      });
      return response.text;
    }

  } catch (error) {
    console.error("Gemini Gen Error:", error);
    // If API call fails (e.g. quota exceeded), fall back to mock
    return getMockData(type, count);
  }
};

export const fixFlashcardContent = async (
  contextText: string,
): Promise<{ front: string; back: string }> => {
  const ai = getAiClient();

  // Fallback for fix function
  if (!ai) {
    return { front: "Mock Fix Front", back: "Mock Fix Back (No API Key)" };
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Generate exactly ONE high-quality flashcard (front and back) based on the following text. It should be concise and accurate. Text: ${contextText.substring(0, 2000)}`,
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
    return JSON.parse(response.text || '{"front": "Error", "back": "Could not generate"}');
  } catch (e) {
    console.error(e);
    return { front: "Error generating card", back: "Please try again manually." };
  }
};

export const parseTableOfContents = async (fullText: string): Promise<any[]> => {
  const ai = getAiClient();
  
  if (!ai) return [];

  try {
    // 1. Smart Extraction: Locate "Table of Contents"
    const tocStartRegex = /(?:^|\n)\s*(?:table\s+of\s+contents|contents)\s*(?:$|\n)/i;
    const match = fullText.match(tocStartRegex);

    let tocSection = fullText;
    if (match && match.index !== undefined) {
      tocSection = fullText.substring(match.index);
    }

    if (tocSection.length > 15000) {
      tocSection = tocSection.substring(0, 15000);
    }

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `You are an expert at parsing textbook Tables of Contents.
Input: Raw text extracted specifically from the Table of Contents section of a PDF.
Task: Detect ONLY main chapters (e.g., "Chapter 1: The Study of Life", "Unit 1: The Cell").
Ignore subsections (e.g., 1.1, 1.2, A.1) and front matter (Preface, Foreword).
Output a strict JSON array of objects with "title" (string) and "start_page" (number).
Look for the page number at the end of the line.
Input Text:
${tocSection}`,
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
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("TOC Parse Error", e);
    return [];
  }
};