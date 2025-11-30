
export enum AppState {
  LANDING = 'LANDING',
  UPLOAD = 'UPLOAD',
  ANALYZING_DOC = 'ANALYZING_DOC',
  CONFIRM_REQUIREMENTS = 'CONFIRM_REQUIREMENTS',
  SEARCHING = 'SEARCHING',
  VIEW_SEARCH_RESULTS = 'VIEW_SEARCH_RESULTS',
  COMPARING = 'COMPARING',
  RESULT = 'RESULT',
}

export interface BilingualText {
  en: string;
  zh: string;
}

export interface SearchResult {
  trends: BilingualText[];
  competitors: BilingualText[];
  keywords: string[];
  marketInsight: BilingualText;
  sources?: { title: string; url: string }[]; // For grounding metadata
}

export interface ColorScheme {
  id: string;
  name: BilingualText;
  description: BilingualText;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
  };
  scores: {
    match: number;
    trend: number;
    market: number;
    innovation: number;
    harmony: number;
  };
  weightedScore: number;
  sources: string[]; // Text sources
  usageAdvice: BilingualText;
  swot: {
    strengths: BilingualText[];
    weaknesses: BilingualText[];
  };
}

export interface Requirement {
  id: string;
  text: string; // Keep simple for display, or could be Bilingual if extracted that way
  summaryEn?: string;
  sourcePage?: number;
}
