// ─── Core domain types for Sahayak ───────────────────────────────────────────

export type ServiceType =
  | 'old_age_pension'
  | 'widow_pension'
  | 'caste_certificate'
  | 'income_certificate'
  | 'domicile_certificate'
  | 'ration_card'
  | 'ayushman';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type ValidationStatus = 'valid' | 'warning' | 'error' | 'empty';

// ─── Form Schema (loaded from JSON) ──────────────────────────────────────────

export interface FieldSchema {
  id: string;
  label: string;           // Hindi label
  labelEn: string;         // English label (internal)
  type: 'text' | 'number' | 'date' | 'select' | 'file';
  required: boolean;
  options?: string[];      // for select fields
  pattern?: string;        // regex string
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  tooltip?: string;        // Hindi tooltip
  placeholder?: string;
}

export interface FormSchema {
  serviceType: ServiceType;
  titleHindi: string;
  titleEnglish: string;
  fields: FieldSchema[];
  eligibilityQuestions: EligibilityQuestion[];
}

// ─── Eligibility ──────────────────────────────────────────────────────────────

export interface EligibilityQuestion {
  id: string;
  questionHindi: string;
  questionEnglish: string;
  type: 'boolean' | 'number' | 'select';
  options?: string[];
  disqualifyIf?: boolean | string | number;
  disqualifyMsg?: string;  // Hindi
}

export interface EligibilityResult {
  eligible: boolean;
  failedChecks: string[];  // Hindi messages
}

// ─── Form Validation ──────────────────────────────────────────────────────────

export interface FieldValidation {
  fieldId: string;
  status: ValidationStatus;
  message?: string;        // Hindi
}

export interface FormState {
  values: Record<string, string>;
  validations: Record<string, FieldValidation>;
  healthScore: number;     // 0–100
  riskLevel: RiskLevel;
  isEligible: boolean | null;
}

// ─── OCR / Document ───────────────────────────────────────────────────────────

export interface ExtractedDocFields {
  name?: string;
  dob?: string;
  fatherName?: string;
  aadhaar?: string;
  address?: string;
  income?: string;
  caste?: string;
  domicileYears?: string;
  rationCategory?: string;
}

export interface CrossCheckResult {
  fieldId: string;
  fieldLabel: string;
  formValue: string;
  docValue: string;
  match: boolean;
  similarity: number;      // 0–1
  message: string;         // Hindi
}

// ─── Application (StripBoard entry) ──────────────────────────────────────────

export interface Application {
  id: string;
  serviceType: ServiceType;
  applicantName: string;
  createdAt: string;       // ISO date string
  healthScore: number;
  riskLevel: RiskLevel;
  isEligible: boolean | null;
}

// ─── Prediction ───────────────────────────────────────────────────────────────

export interface PredictionResult {
  riskLevel: RiskLevel;
  probability: number;     // 0–1
  topFactors: string[];    // Hindi factor descriptions
}

// ─── RAG / Chat ───────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface RejectionStat {
  serviceType: ServiceType;
  totalSubmissions: number;
  totalRejections: number;
  topReasons: string[];
}
