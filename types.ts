export enum AppState {
  UPLOAD = 'UPLOAD',
  ANALYZING_DOC = 'ANALYZING_DOC',
  CONFIRM_REQUIREMENTS = 'CONFIRM_REQUIREMENTS',
  SEARCHING = 'SEARCHING',
  COMPARING = 'COMPARING',
  RESULT = 'RESULT',
}

export interface ColorScheme {
  id: string;
  name: string;
  description: string;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
  };
  scores: {
    match: number;      // 30%
    trend: number;      // 25%
    market: number;     // 20%
    innovation: number; // 15%
    harmony: number;    // 10%
  };
  weightedScore: number;
  sources: string[];
  usageAdvice: string;
}

export interface Requirement {
  id: string;
  text: string;
  sourcePage?: number;
}

export interface AnalysisReport {
  customerName: string;
  date: string;
  requirements: Requirement[];
  bestScheme: ColorScheme;
  allSchemes: ColorScheme[];
}