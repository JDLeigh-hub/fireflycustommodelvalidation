export type ModelType =
  | 'lifestyle-photography'
  | 'photorealistic-portraiture'
  | 'still-life-product'
  | 'character-development'
  | 'iconography-graphics'
  | '3d-isometric';
export type AssetStatus = 'pending' | 'analyzing' | 'complete' | 'error';
export type IssueLevel = 'error' | 'warning';
export type ProjectStatus = 'draft' | 'validating' | 'analyzing' | 'chatting' | 'complete';

export interface ValidationIssue {
  rule: string;
  level: IssueLevel;
  message: string;
  suggestion: string;
}

export interface TrainingAsset {
  id: string;
  filename: string;
  storedFilename: string;
  path: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  format: string;
  status: AssetStatus;
  validationIssues: ValidationIssue[];
  validationScore: number;
  reversedPrompt: string;
  description: string;
  caption: string;
  tags: string[];
  aiNotes: string[];
  lightingNotes: string;
  compositionNotes: string;
}

export type PromptSegmentRole =
  | 'subject'
  | 'style'
  | 'environment'
  | 'lighting'
  | 'mood'
  | 'composition'
  | 'quality';

export interface PromptSegment {
  text: string;
  role: PromptSegmentRole;
  lesson: string;
}

export interface IdealPrompt {
  prompt: string;
  focus: string;
  rationale: string;
  breakdown: PromptSegment[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Project {
  id: string;
  name: string;
  modelType: ModelType;
  keyTerm?: string;
  currentStep?: number;
  createdAt: string;
  updatedAt: string;
  status: ProjectStatus;
  assets: TrainingAsset[];
  expectedOutcome: string;
  chatHistory: ChatMessage[];
  idealPrompts: IdealPrompt[];
  overallScore: number;
}
