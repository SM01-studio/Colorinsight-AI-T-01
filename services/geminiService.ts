import { GoogleGenAI, Type, SchemaType } from "@google/genai";
import { ColorScheme, Requirement } from "../types";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY not found in environment");
  return new GoogleGenAI({ apiKey });
};

export const extractRequirements = async (pdfText: string): Promise<{ customerName: string; requirements: Requirement[] }> => {
  const ai = getAiClient();
  
  const prompt = `
    Analyze the following Customer Positioning Report text. 
    1. Identify the customer name/brand name.
    2. Extract specific color-related scenarios, preferences, target audience color psychology, or design requirements.
    
    Text content:
    ${pdfText.substring(0, 10000)}... (truncated)
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          customerName: { type: Type.STRING },
          requirements: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                text: { type: Type.STRING, description: "The extracted requirement text" },
                sourcePage: { type: Type.INTEGER, description: "Estimated page number if available, else 1" }
              }
            }
          }
        }
      }
    }
  });

  if (!response.text) throw new Error("No response from AI");
  return JSON.parse(response.text);
};

export const generateAndScoreSchemes = async (requirements: Requirement[]): Promise<ColorScheme[]> => {
  const ai = getAiClient();
  
  const reqText = requirements.map(r => r.text).join("; ");
  
  const prompt = `
    Act as a world-class Color Strategy Expert.
    Based on these requirements: "${reqText}"
    
    1. Search your internal knowledge base for 4 distinct, high-quality color schemes (palettes) that fit these needs.
    2. One scheme must be highly "Trendy", one "Market Safe", one "Innovative/Bold", and one "Balanced".
    3. For each scheme, provide a 3-color palette (HEX).
    4. SIMULATE a quantitative evaluation for each scheme on a scale of 0-10 based on:
       - Match (Fit with requirements)
       - Trend (Current popularity in 2024-2025 design)
       - Market (Commercial acceptance probability)
       - Innovation (Uniqueness)
       - Harmony (Color theory balance)
    5. Provide real-world reference sources (e.g., "Pantone 2025", "WGSN", "Behance Trending").
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            palette: {
              type: Type.OBJECT,
              properties: {
                primary: { type: Type.STRING },
                secondary: { type: Type.STRING },
                accent: { type: Type.STRING }
              }
            },
            scores: {
              type: Type.OBJECT,
              properties: {
                match: { type: Type.NUMBER },
                trend: { type: Type.NUMBER },
                market: { type: Type.NUMBER },
                innovation: { type: Type.NUMBER },
                harmony: { type: Type.NUMBER }
              }
            },
            sources: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            usageAdvice: { type: Type.STRING }
          }
        }
      }
    }
  });

  if (!response.text) throw new Error("Failed to generate schemes");
  
  const schemes = JSON.parse(response.text);
  
  // Calculate weighted scores in frontend to ensure precision
  return schemes.map((s: any) => ({
    ...s,
    weightedScore: (
      (s.scores.match * 0.30) + 
      (s.scores.trend * 0.25) + 
      (s.scores.market * 0.20) + 
      (s.scores.innovation * 0.15) + 
      (s.scores.harmony * 0.10)
    ).toFixed(2)
  }));
};