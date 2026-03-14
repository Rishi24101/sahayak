const API_BASE = 'http://localhost:8001/api';

export interface PredictRequest {
  service_type: string;
  age: number;
  income: number;
  family_size?: number;
  docs_missing?: number;
  aadhaar_linked?: number;
  bank_linked?: number;
  name_mismatch?: number;
  father_name_mismatch?: number;
  prev_rejections?: number;
  operator_exp_months?: number;
}

export interface PredictResponse {
  probability: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  risk_hindi: string;
  top_factors: string[];
}

export interface ValidateRequest {
  service_type: string;
  applicant_name?: string;
  father_name?: string;
  age?: number;
  income?: number;
  family_size?: number;
  aadhaar_number?: string;
  aadhaar_linked?: number;
  bank_linked?: number;
  name_mismatch?: number;
  father_name_mismatch?: number;
  docs_submitted?: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidateResponse {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  required_docs: string[];
  missing_docs: string[];
}

export interface FormAction {
  field: string;
  value: string;
  label?: string;
}

export interface QueryResponse {
  answer: string;
  source: string;
  scheme: string;
  form_actions?: FormAction[];
}

export interface AutofillResponse {
  applicant_name: string | null;
  father_name: string | null;
  aadhaar_number: string | null;
  dob: string | null;
  gender: string | null;
  address: string | null;
  income: string | null;
  document_type: string | null;
  detected_service: string | null;
  fields_found: number;
}

export interface DashboardData {
  total_submissions: number;
  total_rejected: number;
  rejection_rate: number;
  high_risk_count: number;
  scheme_stats: Array<{
    service_type: string;
    total: number;
    rejected: number;
    avg_risk: number;
  }>;
  top_rejection_reasons: Array<{
    service_type: string;
    field_name: string;
    error_message: string;
    count: number;
  }>;
  recent_submissions: Array<{
    id: number;
    service_type: string;
    applicant_name: string;
    risk_level: string;
    probability: number;
    errors: string;
    warnings: string;
    rejected: number;
  }>;
}

async function fetchAPI<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

export const api = {
  predict: (data: PredictRequest) =>
    fetchAPI<PredictResponse>('/predict', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  validate: (data: ValidateRequest) =>
    fetchAPI<ValidateResponse>('/validate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  query: (question: string, scheme_context: string = '', form_context?: {
    service_id?: string;
    service_name?: string;
    errors?: string[];
    missing_docs?: string[];
  }) =>
    fetchAPI<QueryResponse>('/query', {
      method: 'POST',
      body: JSON.stringify({ question, scheme_context, form_context }),
    }),

  autofill: (ocr_text: string) =>
    fetchAPI<AutofillResponse>('/autofill', {
      method: 'POST',
      body: JSON.stringify({ ocr_text }),
    }),

  autocorrect: (field_name: string, field_value: string, service_type: string = '') =>
    fetchAPI<{ original: string; corrected: string; changed: boolean; suggestion: string }>('/autocorrect', {
      method: 'POST',
      body: JSON.stringify({ field_name, field_value, service_type }),
    }),

  getDashboard: () => fetchAPI<DashboardData>('/dashboard'),

  trackSubmission: (data: any) =>
    fetchAPI('/track', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  healthCheck: async () => {
    try {
      const res = await fetch('http://localhost:8001/health');
      return res.ok;
    } catch {
      return false;
    }
  },

  voiceTranscribe: async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    const res = await fetch(`${API_BASE}/voice/transcribe`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json() as Promise<{ text: string; language: string; duration: number }>;
  },

  llamaOcr: async (imageFile: File) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    const res = await fetch(`${API_BASE}/ocr/extract`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json() as Promise<AutofillResponse & { raw_text: string }>;
  },
};
