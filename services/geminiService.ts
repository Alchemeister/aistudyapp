// SECURITY: AI calls go through server endpoints - no API key exposed to browser
import { ContentType, Difficulty } from "../types";

// --- Server API Helper ---
// All AI generation now goes through /api/generate to keep API keys secure
const getAuthToken = async (): Promise<string | null> => {
  try {
    const { auth } = await import('./firebase');
    if (!auth?.currentUser) return null;
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
};

interface ServerGenerateResponse {
  success: boolean;
  content: string;
  creditsRemaining?: number;
  error?: string;
  requiresPro?: boolean;
  limitReached?: boolean;
}

// Local development: call Gemini API directly (no server endpoint in dev mode)
const callLocalGemini = async (
  prompt: string,
  systemInstruction?: string
): Promise<ServerGenerateResponse> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error('VITE_GEMINI_API_KEY not set in .env.local');
    return { success: false, content: '', error: 'API key not configured' };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('Gemini API error:', response.status);
      return { success: false, content: '', error: 'AI generation failed' };
    }

    const result = await response.json();
    const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return { success: true, content: generatedText };
  } catch (e) {
    console.error('Local Gemini error:', e);
    return { success: false, content: '', error: 'Network error' };
  }
};

const callServerGenerate = async (
  contentType: string,
  prompt: string,
  systemInstruction?: string
): Promise<ServerGenerateResponse> => {
  // In local development, use direct Gemini API call
  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocalDev) {
    return callLocalGemini(prompt, systemInstruction);
  }

  const token = await getAuthToken();
  if (!token) {
    return { success: false, content: '', error: 'Not authenticated' };
  }

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ contentType, prompt, systemInstruction }),
    });

    // Handle non-JSON responses (server crash returns plain text)
    const responseContentType = response.headers.get('content-type');
    if (!responseContentType?.includes('application/json')) {
      const text = await response.text();
      return { success: false, content: '', error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        content: '',
        error: data.error || 'Generation failed',
        requiresPro: data.requiresPro,
        limitReached: data.limitReached,
      };
    }

    return {
      success: true,
      content: data.content,
      creditsRemaining: data.creditsRemaining,
    };
  } catch (e) {
    console.error('Generation network error:', e);
    return { success: false, content: '', error: 'Network error' };
  }
};

// --- Generation Tracking (local cache, server is source of truth) ---
const STORAGE_KEY = 'ai_generation_usage';
const FREE_LIMIT = 50;

interface GenerationUsage {
  generationsThisMonth: number;
  periodStart: string;
  periodEnd: string;
  lastGeneration?: string;
}

const getMonthBounds = () => {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() };
};

export const getGenerationUsage = (): GenerationUsage => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const usage = JSON.parse(stored) as GenerationUsage;
      if (typeof usage.generationsThisMonth !== 'number' || !usage.periodEnd) {
        throw new Error('Invalid usage data');
      }
      const now = new Date();
      const periodEnd = new Date(usage.periodEnd);
      if (!isNaN(periodEnd.getTime()) && now > periodEnd) {
        const bounds = getMonthBounds();
        const resetUsage: GenerationUsage = { generationsThisMonth: 0, ...bounds };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(resetUsage));
        return resetUsage;
      }
      return usage;
    }
  } catch {
    // Silent fail, initialize fresh
  }
  const bounds = getMonthBounds();
  const initialUsage: GenerationUsage = { generationsThisMonth: 0, ...bounds };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialUsage));
  return initialUsage;
};

export const getRemainingGenerations = (): number => {
  const usage = getGenerationUsage();
  return Math.max(0, FREE_LIMIT - usage.generationsThisMonth);
};

export const getGenerationLimit = (): number => FREE_LIMIT;

// Update local cache after server confirms generation (local cache is just for UI, server is source of truth)
const recordGeneration = (): void => {
  try {
    const usage = getGenerationUsage();
    const updated: GenerationUsage = {
      ...usage,
      generationsThisMonth: usage.generationsThisMonth + 1,
      lastGeneration: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Silent fail - server tracks actual usage
  }
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

  if (type === ContentType.PRACTICE_PROBLEMS) {
    return [
      {
        id: mockId(),
        problem: "A car accelerates uniformly from rest to 20 m/s in 5 seconds. Calculate the acceleration.",
        givens: ["v₀ = 0 m/s (starts from rest)", "v = 20 m/s", "t = 5 s"],
        find: "a = ?",
        steps: [
          { explanation: "Use the kinematic equation", math: "v = v_0 + at" },
          { explanation: "Rearrange to solve for acceleration", math: "a = \\frac{v - v_0}{t}" },
          { explanation: "Substitute values", math: "a = \\frac{20 - 0}{5} = 4" }
        ],
        answer: "a = 4 m/s²",
        formula: "v = v₀ + at",
        difficulty: "easy",
        topic: "Kinematics",
        source: "Mock Data"
      },
      {
        id: mockId(),
        problem: "Calculate the force required to accelerate a 10 kg mass at 3 m/s².",
        givens: ["m = 10 kg", "a = 3 m/s²"],
        find: "F = ?",
        steps: [
          { explanation: "Apply Newton's Second Law", math: "F = ma" },
          { explanation: "Substitute the known values", math: "F = (10)(3) = 30" }
        ],
        answer: "F = 30 N",
        formula: "F = ma",
        difficulty: "easy",
        topic: "Newton's Laws",
        source: "Mock Data"
      }
    ].slice(0, count);
  }

  if (type === ContentType.MNEMONICS) {
    return [
      {
        id: mockId(),
        items: ["Huron", "Ontario", "Michigan", "Erie", "Superior"],
        mnemonic: "HOMES",
        type: "acronym",
        explanation: "Each letter represents a Great Lake: H-Huron, O-Ontario, M-Michigan, E-Erie, S-Superior",
        topic: "Great Lakes of North America",
        source: "Mock Data"
      },
      {
        id: mockId(),
        items: ["Kingdom", "Phylum", "Class", "Order", "Family", "Genus", "Species"],
        mnemonic: "King Philip Came Over For Good Soup",
        type: "acrostic",
        explanation: "Each word's first letter matches the taxonomy rank: King=Kingdom, Philip=Phylum, Came=Class, Over=Order, For=Family, Good=Genus, Soup=Species",
        topic: "Biological Classification",
        source: "Mock Data"
      },
      {
        id: mockId(),
        items: ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"],
        mnemonic: "My Very Educated Mother Just Served Us Nachos",
        type: "acrostic",
        explanation: "Each word's first letter corresponds to a planet in order from the Sun",
        topic: "Solar System Planets",
        source: "Mock Data"
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

const cleanPracticeProblems = (data: any[]): any[] => {
  if (!Array.isArray(data)) return [];
  return data
    .map((item, index) => ({
      id: item.id || `prob-${index}`,
      problem: item.problem || "",
      givens: Array.isArray(item.givens) ? item.givens : [],
      find: item.find || "",
      steps: Array.isArray(item.steps) ? item.steps.map((step: any) => ({
        explanation: step.explanation || "",
        math: step.math || ""
      })) : [],
      answer: item.answer || "",
      formula: item.formula || "",
      difficulty: item.difficulty || "medium",
      topic: item.topic || "",
      source: item.source || ""
    }))
    .filter(item =>
      item.problem && item.problem.trim().length > 0 &&
      item.steps.length > 0 &&
      item.answer && item.answer.trim().length > 0
    );
};

const cleanMnemonics = (data: any[]): any[] => {
  if (!Array.isArray(data)) return [];
  const validTypes = ['acronym', 'acrostic', 'rhyme', 'story', 'visual'];
  return data
    .map((item, index) => ({
      id: item.id || `mnem-${index}`,
      items: Array.isArray(item.items) ? item.items : [],
      mnemonic: item.mnemonic || "",
      type: validTypes.includes(item.type) ? item.type : 'acronym',
      explanation: item.explanation || "",
      topic: item.topic || "",
      source: item.source || ""
    }))
    .filter(item =>
      item.items.length >= 2 &&
      item.mnemonic && item.mnemonic.trim().length > 0
    );
};

const cleanQuestions = (data: any[]): any[] => {
    if (!Array.isArray(data)) return [];
    return data
        .map((item, index) => {
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
                id: item.id || `q-${Date.now()}-${index}`, // Ensure unique ID
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

  // SECURITY: All AI calls go through server - no API key exposed
  const token = await getAuthToken();
  if (!token) {
    // Not logged in - return mock data
    await new Promise(resolve => setTimeout(resolve, 500));
    return getMockData(type, count);
  }

  if (!text || text.trim().length < 20) {
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

      const prompt = `
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
        `;

      const response = await callServerGenerate('flashcards', prompt);
      if (!response.success) {
        if (response.requiresPro || response.limitReached) {
          throw new Error(response.error || 'Generation limit reached');
        }
        return getMockData(type, count);
      }

      const raw = cleanAndParseJson(response.content);
      const result = cleanFlashcards(raw);
      if (result.length > 0) recordGeneration();
      return result;
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

      const response = await callServerGenerate(isMock ? 'mock_test' : 'quiz', prompt);
      if (!response.success) {
        if (response.requiresPro || response.limitReached) {
          throw new Error(response.error || 'Generation limit reached');
        }
        return getMockData(type, count);
      }

      const raw = cleanAndParseJson(response.content);
      const result = cleanQuestions(raw);
      if (result.length > 0) recordGeneration();
      return result;
    }

    // Notes / Mindmap
    if (type === ContentType.NOTES || type === ContentType.MINDMAP || type === ContentType.ACTIVE_RECALL) {
      let typeLabel = 'notes';
      let promptText = "";
      if (type === ContentType.NOTES) {
        promptText = "Generate concise Cornell-style notes (Main Points, Details, Summary).";
        typeLabel = 'notes';
      }
      if (type === ContentType.MINDMAP) {
        promptText = "Generate a text-based hierarchical mind map (markdown bullets).";
        typeLabel = 'mindmap';
      }
      if (type === ContentType.ACTIVE_RECALL) {
        promptText = `Generate ${count} Active Recall questions (no answers).`;
        typeLabel = 'active_recall';
      }

      const response = await callServerGenerate(typeLabel, `${promptText} Context: ${contextTitle}. Source Material: ${safeText}`);
      if (!response.success) {
        if (response.requiresPro || response.limitReached) {
          throw new Error(response.error || 'Generation limit reached');
        }
        return `[Generation Failed] ${response.error || 'Unknown error'}`;
      }
      if (response.content) recordGeneration();
      return response.content;
    }

    // Concept Connections (Pro feature)
    if (type === ContentType.CONCEPT_CONNECTIONS) {
      const prompt = `
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
        `;

      const response = await callServerGenerate('concept_connections', prompt);
      if (!response.success) {
        if (response.requiresPro || response.limitReached) {
          throw new Error(response.error || 'Generation limit reached');
        }
        return [];
      }

      const raw = cleanAndParseJson(response.content);
      const result = cleanConceptConnections(raw);
      if (result.length > 0) recordGeneration();
      return result;
    }

    // Practice Problems (STEM)
    if (type === ContentType.PRACTICE_PROBLEMS) {
      const prompt = `
          Generate ${count} practice problems with step-by-step solutions for STEM students.

          Context Source: "${contextTitle}"
          Difficulty: ${difficultyPrompt}

          IMPORTANT: These should be CALCULATION-BASED problems that require applying formulas.
          Look for any formulas, equations, or quantitative concepts in the source material.

          OUTPUT FORMAT (JSON Array):
          [
            {
              "problem": "A car accelerates uniformly from rest to 25 m/s in 10 seconds. What is its acceleration?",
              "givens": ["v₀ = 0 m/s (starts from rest)", "v = 25 m/s", "t = 10 s"],
              "find": "a = ?",
              "steps": [
                {
                  "explanation": "Identify the kinematic equation relating velocity, initial velocity, acceleration, and time",
                  "math": "v = v_0 + at"
                },
                {
                  "explanation": "Rearrange to solve for acceleration",
                  "math": "a = \\\\frac{v - v_0}{t}"
                },
                {
                  "explanation": "Substitute the known values",
                  "math": "a = \\\\frac{25 - 0}{10} = \\\\frac{25}{10}"
                },
                {
                  "explanation": "Calculate the final answer",
                  "math": "a = 2.5 \\\\text{ m/s}^2"
                }
              ],
              "answer": "a = 2.5 m/s²",
              "formula": "v = v₀ + at",
              "difficulty": "easy",
              "topic": "Kinematics",
              "source": "${contextTitle}"
            }
          ]

          RULES:
          1. Problems MUST require numerical calculations, not just conceptual answers
          2. Use LaTeX notation for math in "math" fields (use double backslashes: \\\\frac, \\\\text, etc.)
          3. "givens" should list all known values with units
          4. "find" should clearly state what needs to be calculated
          5. "steps" should show complete work - each step should be a logical progression
          6. "formula" should show the key equation(s) used
          7. "difficulty" must be "easy", "medium", or "hard"
          8. Include units in all answers
          9. Problems should be based on concepts from the source material
          10. Return ONLY a JSON array, no markdown

          If the source material doesn't contain STEM/quantitative content, generate problems
          based on any numerical data, statistics, or logical/analytical concepts present.

          Source Material:
          ${safeText}
        `;

      const response = await callServerGenerate('practice_problems', prompt);
      if (!response.success) {
        if (response.requiresPro || response.limitReached) {
          throw new Error(response.error || 'Generation limit reached');
        }
        return getMockData(type, count);
      }

      const raw = cleanAndParseJson(response.content);
      const result = cleanPracticeProblems(raw);
      if (result.length > 0) recordGeneration();
      return result;
    }

    // Mnemonics
    if (type === ContentType.MNEMONICS) {
      const prompt = `
          Analyze the source material and create ${count} memorable mnemonics for lists, sequences, steps, or categories.

          Context Source: "${contextTitle}"

          MNEMONIC TYPES (use the most effective type for each list):
          - "acronym": First letters form a word (e.g., "HOMES" for Great Lakes)
          - "acrostic": First letters form a sentence (e.g., "Every Good Boy Does Fine" for music notes)
          - "rhyme": A catchy rhyme to remember items (e.g., "In 1492, Columbus sailed the ocean blue")
          - "story": A short narrative connecting the items
          - "visual": A vivid mental image description

          OUTPUT FORMAT (JSON Array):
          [
            {
              "items": ["Huron", "Ontario", "Michigan", "Erie", "Superior"],
              "mnemonic": "HOMES",
              "type": "acronym",
              "explanation": "Each letter in HOMES represents one of the Great Lakes: H-Huron, O-Ontario, M-Michigan, E-Erie, S-Superior",
              "topic": "Great Lakes of North America",
              "source": "${contextTitle}"
            },
            {
              "items": ["Kingdom", "Phylum", "Class", "Order", "Family", "Genus", "Species"],
              "mnemonic": "King Philip Came Over For Good Soup",
              "type": "acrostic",
              "explanation": "Each word starts with the same letter as the taxonomic rank: King=Kingdom, Philip=Phylum, etc.",
              "topic": "Biological Classification",
              "source": "${contextTitle}"
            }
          ]

          RULES:
          1. Look for ANY enumerable content: lists, sequences, steps, categories, stages, phases
          2. "items" must contain the EXACT terms/items to remember (minimum 3 items)
          3. "mnemonic" must be memorable, catchy, and easy to recall
          4. "type" must be one of: "acronym", "acrostic", "rhyme", "story", "visual"
          5. "explanation" must clearly explain how the mnemonic maps to each item
          6. Prefer acronyms and acrostics when items have useful first letters
          7. Use rhymes or stories for items that don't form good acronyms
          8. Make mnemonics fun, silly, or vivid - these are more memorable!
          9. Return ONLY a JSON array, no markdown

          Source Material:
          ${safeText}
        `;

      const response = await callServerGenerate('mnemonics', prompt);
      if (!response.success) {
        if (response.requiresPro || response.limitReached) {
          throw new Error(response.error || 'Generation limit reached');
        }
        return getMockData(type, count);
      }

      const raw = cleanAndParseJson(response.content);
      const result = cleanMnemonics(raw);
      if (result.length > 0) recordGeneration();
      return result;
    }

  } catch (error: any) {
    console.error("Generation error:", error?.message || 'Unknown error');
    if (error.message === "SOURCE_TEXT_EMPTY") throw error;
    // Re-throw limit/pro errors so UI can show appropriate message
    if (error.message?.includes('limit') || error.message?.includes('Pro')) throw error;
    return getMockData(type, count);
  }
};

/**
 * Generate a comprehensive exam (midterm/final) from existing study materials
 * This avoids token limits by using curated flashcards and quiz questions
 * instead of raw PDF text.
 */
export const generateExamFromMaterials = async (
  flashcards: { front: string; back: string; source?: string }[],
  existingQuestions: { text: string; correctAnswer: string; type: string; source?: string }[],
  courseTitle: string,
  questionCount: number = 100,
  difficulty: Difficulty = Difficulty.MEDIUM
): Promise<any[]> => {
  const token = await getAuthToken();
  if (!token) {
    // Return mock data if not logged in
    await new Promise(resolve => setTimeout(resolve, 1000));
    return getMockData(ContentType.MOCK_TEST, Math.min(questionCount, 20)) as any[];
  }

  // Build a summary of available content
  const flashcardSummary = flashcards.slice(0, 150).map(fc =>
    `Q: ${fc.front}\nA: ${fc.back}${fc.source ? ` (${fc.source})` : ''}`
  ).join('\n\n');

  const existingQuestionSummary = existingQuestions.slice(0, 100).map(q =>
    `[${q.type}] ${q.text} → ${q.correctAnswer}${q.source ? ` (${q.source})` : ''}`
  ).join('\n\n');

  const totalSourceItems = flashcards.length + existingQuestions.length;

  if (totalSourceItems < 10) {
    throw new Error("INSUFFICIENT_MATERIALS");
  }

  const difficultyPrompt = difficulty === 5
    ? "Expert level - include analysis, synthesis, and application questions"
    : difficulty === 3
      ? "Undergraduate level - mix of recall, understanding, and application"
      : "Introductory level - focus on core concepts and definitions";

  // Determine question type distribution based on count
  const mcCount = Math.floor(questionCount * 0.50);  // 50% Multiple Choice
  const tfCount = Math.floor(questionCount * 0.15);  // 15% True/False
  const fillCount = Math.floor(questionCount * 0.15); // 15% Fill in Blank
  const shortCount = Math.floor(questionCount * 0.15); // 15% Short Answer
  const matchCount = questionCount - mcCount - tfCount - fillCount - shortCount; // Remainder

  try {
    const prompt = `Create a comprehensive ${questionCount}-question exam for "${courseTitle}".

You have access to the following study materials that students have been learning:

=== FLASHCARDS (${flashcards.length} total, showing first 150) ===
${flashcardSummary}

=== PREVIOUS QUIZ QUESTIONS (${existingQuestions.length} total, showing first 100) ===
${existingQuestionSummary}

Difficulty Level: ${difficultyPrompt}

REQUIRED QUESTION DISTRIBUTION:
- ${mcCount} Multiple Choice (MC) questions with exactly 4 options
- ${tfCount} True/False (TF) questions
- ${fillCount} Fill in the Blank (FILL_BLANK) questions
- ${shortCount} Short Answer (SHORT_ANSWER) questions
- ${matchCount} Matching (MATCHING) questions with word bank

EXAM CREATION RULES:
1. Create NEW questions inspired by the study materials - don't just copy them directly
2. Vary the wording and approach from the source flashcards/questions
3. Include some SYNTHESIS questions that combine concepts from different topics
4. Make questions progressively harder throughout the exam
5. Ensure comprehensive coverage of all topics represented in the materials
6. For Short Answer questions, include "keywords" array for grading

QUESTION FORMATS:
MC: {"type": "MC", "text": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "B", "explanation": "...", "source": "..."}
TF: {"type": "TF", "text": "...", "options": ["True", "False"], "correctAnswer": "True", "explanation": "...", "source": "..."}
FILL_BLANK: {"type": "FILL_BLANK", "text": "The _____ is...", "options": [], "correctAnswer": "answer", "explanation": "...", "source": "..."}
SHORT_ANSWER: {"type": "SHORT_ANSWER", "text": "...", "options": [], "correctAnswer": "...", "keywords": ["key1", "key2"], "explanation": "...", "source": "..."}
MATCHING: {"type": "MATCHING", "text": "Select the term that...", "options": ["word1", "word2", "word3", "word4"], "correctAnswer": "word1", "explanation": "...", "source": "..."}

Return ONLY a JSON array of questions. No markdown wrapping.`;

    const response = await callServerGenerate('mock_test', prompt);
    if (!response.success) {
      if (response.requiresPro || response.limitReached) {
        throw new Error(response.error || 'Generation limit reached');
      }
      return getMockData(ContentType.MOCK_TEST, Math.min(questionCount, 20)) as any[];
    }

    const raw = cleanAndParseJson(response.content);
    const result = cleanQuestions(raw);
    if (result.length > 0) recordGeneration();
    return result;
  } catch (error: any) {
    console.error("Exam generation error:", error?.message || 'Unknown error');
    if (error.message?.includes('limit') || error.message?.includes('Pro')) throw error;
    return getMockData(ContentType.MOCK_TEST, Math.min(questionCount, 20)) as any[];
  }
};

export const fixFlashcardContent = async (
  contextText: string,
): Promise<{ front: string; back: string }> => {
  const token = await getAuthToken();
  if (!token) return { front: "Error", back: "Not logged in" };

  try {
    const prompt = `Fix/Improve this flashcard and return a JSON object with "front" and "back" keys. Input: ${contextText.substring(0, 1000)}`;
    const response = await callServerGenerate('flashcard_fix', prompt);

    if (!response.success) {
      return { front: "Error", back: response.error || "Generation failed" };
    }

    // Parse the response
    const fixedArr = cleanAndParseJson(response.content);
    const data = Array.isArray(fixedArr) ? fixedArr[0] : fixedArr;
    return { front: data?.front || "Error", back: data?.back || "Could not fix" };
  } catch (e) {
    return { front: "Error", back: "API Error" };
  }
};

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  // Audio transcription requires server-side endpoint with multipart support
  // For now, return a message indicating this feature needs server setup
  const token = await getAuthToken();
  if (!token) {
    return "[Transcription unavailable] Please log in to use this feature.";
  }

  try {
    // Convert audio to base64
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

    // Call server transcription endpoint
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        audio: base64Audio,
        mimeType: audioBlob.type,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return error.error || "Transcription failed.";
    }

    const data = await response.json();
    return data.text || "Transcription failed.";
  } catch (e) {
    console.error("Transcription error");
    return "Error during transcription. Please try again.";
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
  const token = await getAuthToken();
  if (!token) return [];

  try {
    const prompt = `
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
      `;

    const response = await callServerGenerate('toc_parse', prompt);
    if (!response.success) {
      return [];
    }

    const parsed = cleanAndParseJson(response.content);

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
    console.error("TOC parse error");
    return [];
  }
};

// --- AI Chat with Context (Pro Feature) ---
export const chatWithContext = async (
  userMessage: string,
  contextText: string,
  contextTitle: string,
  chatHistory: { role: 'user' | 'assistant'; content: string }[] = []
): Promise<string> => {
  const token = await getAuthToken();
  if (!token) {
    return "AI Tutor requires you to be logged in. Please sign in to continue.";
  }

  try {
    // Build context for the AI
    const context = `CONTEXT SOURCE: "${contextTitle}"\n\nRELEVANT MATERIAL:\n${contextText.substring(0, 12000)}`;

    // Call the dedicated chat endpoint
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: userMessage,
        context,
        history: chatHistory.slice(-10), // Last 10 messages for context
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.requiresPro) {
        return "AI Tutor is a Pro feature. Upgrade to Pro to get personalized tutoring help!";
      }
      return data.error || "Sorry, there was an error. Please try again.";
    }

    return data.response || "I couldn't generate a response. Please try again.";
  } catch (e) {
    console.error("Chat error");
    return "Sorry, there was an error processing your question. Please try again.";
  }
};

// --- Smart Lecture Notes (Auto-summarize transcripts) ---
export interface LectureSummaryResult {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
}

export const generateLectureSummary = async (
  transcript: string,
  lectureTitle: string
): Promise<LectureSummaryResult | null> => {
  const token = await getAuthToken();
  if (!token) {
    // Return mock data if not logged in
    return {
      summary: "[Mock] This lecture covered important concepts related to the topic. Key themes included foundational principles, practical applications, and real-world examples. The instructor emphasized understanding core concepts before moving to advanced material.",
      keyPoints: [
        "Key concept 1: Foundation of the topic",
        "Key concept 2: Important relationship between ideas",
        "Key concept 3: Practical application"
      ],
      actionItems: [
        "Review chapter notes before next lecture",
        "Complete practice problems"
      ]
    };
  }

  if (!transcript || transcript.trim().length < 50) {
    return null;
  }

  try {
    // Truncate very long transcripts
    const safeTranscript = transcript.length > 20000
      ? transcript.substring(0, 20000) + "...[truncated]"
      : transcript;

    const prompt = `Analyze this lecture transcript and create comprehensive study notes.

LECTURE: "${lectureTitle}"

TRANSCRIPT:
${safeTranscript}

Generate a JSON response with:
1. "summary": A 2-3 paragraph comprehensive summary of the lecture content. Write it as helpful study notes that capture the main topics, explanations, and examples given.
2. "keyPoints": An array of 5-10 key takeaways/concepts from the lecture. Each should be a complete thought, not just a topic name.
3. "actionItems": An array of any action items, assignments, or things to remember mentioned in the lecture. If none are mentioned, provide 2-3 suggested study actions based on the content.

OUTPUT FORMAT (JSON):
{
  "summary": "The lecture began with...",
  "keyPoints": ["Point 1: Full explanation", "Point 2: Full explanation"],
  "actionItems": ["Review X", "Practice Y"]
}

Return ONLY valid JSON, no markdown.`;

    const response = await callServerGenerate('lecture_summary', prompt);
    if (!response.success) {
      return null;
    }

    // Parse as object (not array)
    let result: any;
    try {
      result = JSON.parse(response.content || "{}");
    } catch {
      // Try cleanAndParseJson as fallback
      const parsed = cleanAndParseJson(response.content || "{}");
      result = Array.isArray(parsed) ? parsed[0] : parsed;
    }

    if (result && result.summary) {
      return {
        summary: result.summary || "",
        keyPoints: Array.isArray(result.keyPoints) ? result.keyPoints : [],
        actionItems: Array.isArray(result.actionItems) ? result.actionItems : []
      };
    }

    return null;
  } catch (e) {
    console.error("Lecture summary error");
    return null;
  }
};
