
import { GoogleGenAI, Type } from "@google/genai";
import { ColorScheme, Requirement, SearchResult } from "../types";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY not found in environment");
  return new GoogleGenAI({ apiKey });
};

export const extractRequirements = async (pdfText: string): Promise<{ customerName: string; requirements: Requirement[] }> => {
  const ai = getAiClient();
  
  const prompt = `
    You are a professional color consultant. Analyze the following PDF text from a client positioning report.
    
    Tasks:
    1. Identify the Customer Name or Brand Name.
    2. Extract key requirements related to color, atmosphere, target audience, and design preferences.
    
    Input Text:
    ${pdfText.substring(0, 15000)}... (truncated)
    
    Output JSON format:
    {
      "customerName": "String",
      "requirements": [
        { "id": "1", "text": "Detailed requirement description in Chinese (Original text)", "summaryEn": "English summary", "sourcePage": 1 }
      ]
    }
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
                text: { type: Type.STRING },
                summaryEn: { type: Type.STRING },
                sourcePage: { type: Type.INTEGER }
              }
            }
          }
        }
      }
    }
  });

  if (!response.text) throw new Error("AI response empty");
  return JSON.parse(response.text);
};

export const performMarketSearch = async (requirements: Requirement[]): Promise<SearchResult> => {
  const ai = getAiClient();
  const reqText = requirements.map(r => `${r.text} (${r.summaryEn})`).join("; ");

  const prompt = `
    Based on the client's color requirements: "${reqText}"
    
    Use Google Search to find REAL, GLOBAL data. Focus on International/Western design trends (Europe, North America, Japan) and Global Color Forecasts.
    
    1. Search for "2024 2025 Interior Design Color Trends", "Pantone Fashion Color Trend Report", or "Global Color Forecast".
    2. Search for real competitor projects or similar high-end design case studies globally.
    
    Strictly output VALID JSON string only inside a JSON block. No introductory text.
    JSON Structure:
    {
      "trends": [{ "en": "Trend Name", "zh": "Chinese Translation" }],
      "competitors": [{ "en": "Project Name", "zh": "Chinese Translation" }],
      "keywords": ["keyword1", "keyword2"],
      "marketInsight": { "en": "English insight paragraph...", "zh": "Chinese translation..." }
    }
  `;

  // NOTE: When using tools like googleSearch, responseMimeType: "application/json" IS NOT ALLOWED.
  // We must parse the text manually.
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });

  if (!response.text) throw new Error("Search failed: No response text received from AI.");
  
  // Clean markdown formatting if present (e.g., ```json ... ```)
  let jsonStr = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
  
  let data;
  try {
    data = JSON.parse(jsonStr);
  } catch (e) {
    console.error("JSON Parse Error:", e, "Raw Text:", jsonStr);
    throw new Error("Failed to parse search results. AI response was not valid JSON.");
  }
  
  // Extract Grounding Metadata (Links)
  const sources: { title: string; url: string }[] = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    chunks.forEach((chunk: any) => {
      if (chunk.web?.uri && chunk.web?.title) {
        sources.push({ title: chunk.web.title, url: chunk.web.uri });
      }
    });
  }

  // Deduplicate sources
  const uniqueSources = sources.filter((v,i,a)=>a.findIndex(v2=>(v2.url===v.url))===i).slice(0, 5);

  return { ...data, sources: uniqueSources };
};

export const generateAndScoreSchemes = async (requirements: Requirement[], searchData: SearchResult): Promise<ColorScheme[]> => {
  const ai = getAiClient();
  
  const reqText = requirements.map(r => r.text).join("; ");
  const marketContext = JSON.stringify(searchData);
  
  const prompt = `
    Role: World-class Color Strategy Expert.
    Context: Client Requirements: "${reqText}". Market Research: ${marketContext}
    
    Task: Create 4 distinct, high-end color schemes.
    1. "Global Trend" (Based on search trends)
    2. "Market Safe" (Conservative, luxurious)
    3. "Bold Innovation" (Avant-garde)
    4. "Balanced Classic" (Timeless)
    
    For each scheme:
    - Provide 3 HEX colors.
    - Score 0-10 on Match, Trend, Market, Innovation, Harmony.
    - Provide SWOT analysis (Strengths/Weaknesses) in BOTH English and Chinese.
    - Usage Advice in BOTH English and Chinese.
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
            name: { type: Type.OBJECT, properties: { en: {type: Type.STRING}, zh: {type: Type.STRING} } },
            description: { type: Type.OBJECT, properties: { en: {type: Type.STRING}, zh: {type: Type.STRING} } },
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
            sources: { type: Type.ARRAY, items: { type: Type.STRING } },
            usageAdvice: { type: Type.OBJECT, properties: { en: {type: Type.STRING}, zh: {type: Type.STRING} } },
            swot: {
              type: Type.OBJECT,
              properties: {
                strengths: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { en: {type: Type.STRING}, zh: {type: Type.STRING} } } },
                weaknesses: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { en: {type: Type.STRING}, zh: {type: Type.STRING} } } }
              }
            }
          }
        }
      }
    }
  });

  if (!response.text) throw new Error("Scheme generation failed");
  
  const schemes = JSON.parse(response.text);
  
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

export const generateVisualizationImage = async (scheme: ColorScheme, requirements: Requirement[]): Promise<string> => {
  const ai = getAiClient();
  
  const context = requirements.slice(0, 3).map(r => r.summaryEn || r.text).join(", ");
  
  const prompt = `
    Generate a photorealistic, high-end architectural interior photography.
    
    Subject: ${context}
    Style: Architectural Digest, Vogue Living, soft natural lighting, ultra-detailed, 8k.
    
    Color Palette to Apply:
    - Dominant: ${scheme.palette.primary}
    - Secondary: ${scheme.palette.secondary}
    - Accent: ${scheme.palette.accent}
    
    Composition: Wide angle, cinematic, minimalist, luxury.
    NO text, NO labels.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image', // Switch to flash-image for stability with standard keys
    contents: prompt,
    config: {
       imageConfig: { aspectRatio: "16:9" }
    }
  });

  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  }

  throw new Error("Image generation failed");
};
