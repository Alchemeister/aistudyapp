import { GoogleGenAI, Type } from "@google/genai";
import { ContentType, Difficulty } from "../types";

// The API key is injected via Vite's `define` config mapping VITE_GEMINI_API_KEY to process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_NAME = "gemini-3-flash-preview"; 

export const generateContent = async (
  text: string,
  type: ContentType,
  difficulty: Difficulty,
  context: string = "",
  count: number = 10
): Promise<any> => {
  
  // Ensure the key is present (checking the polyfilled value)
  if (!process.env.API_KEY) throw new Error("API Key missing. Please check VITE_GEMINI_API_KEY in .env");

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
    throw error;
  }
};

export const fixFlashcardContent = async (
  contextText: string,
): Promise<{ front: string; back: string }> => {
  if (!process.env.API_KEY) throw new Error("API Key missing");

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
  if (!process.env.API_KEY) throw new Error("API Key missing");

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