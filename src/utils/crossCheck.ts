import type { CrossCheckResult, ExtractedDocFields, ServiceType } from '../types';
import { similarity, normalizeName, normalizeDate } from '../utils/levenshtein';

// Map form field IDs → doc field keys + Hindi labels
interface FieldMapping {
  formId: string;
  docKey: keyof ExtractedDocFields;
  label: string;
  normalizer?: (s: string) => string;
  threshold?: number;
}

const COMMON_MAPPINGS: FieldMapping[] = [
  {
    formId: 'applicant_name',
    docKey: 'name',
    label: 'आवेदक का नाम',
    normalizer: normalizeName,
    threshold: 0.75,
  },
  {
    formId: 'father_name',
    docKey: 'fatherName',
    label: 'पिता का नाम',
    normalizer: normalizeName,
    threshold: 0.75,
  },
  {
    formId: 'dob',
    docKey: 'dob',
    label: 'जन्म तिथि',
    normalizer: normalizeDate,
    threshold: 0.9,
  },
  {
    formId: 'aadhaar',
    docKey: 'aadhaar',
    label: 'आधार संख्या',
    threshold: 1.0,
  },
  {
    formId: 'address',
    docKey: 'address',
    label: 'पता',
    threshold: 0.6,
  },
];

const SERVICE_EXTRA: Record<string, FieldMapping[]> = {
  income_certificate: [
    {
      formId: 'annual_income',
      docKey: 'income',
      label: 'वार्षिक आय',
      threshold: 0.9,
    },
  ],
  caste_certificate: [
    {
      formId: 'caste',
      docKey: 'caste',
      label: 'जाति',
      threshold: 0.8,
    },
  ],
  domicile_certificate: [
    {
      formId: 'residence_years',
      docKey: 'domicileYears',
      label: 'निवास वर्ष',
      threshold: 0.9,
    },
  ],
  ration_card: [
    {
      formId: 'ration_category',
      docKey: 'rationCategory',
      label: 'राशन श्रेणी',
      threshold: 0.9,
    },
  ],
};

/**
 * Compare OCR-extracted document fields against form values.
 * Returns a list of cross-check results for each comparable field.
 */
export function crossCheck(
  serviceType: ServiceType,
  formValues: Record<string, string>,
  docFields: ExtractedDocFields
): CrossCheckResult[] {
  const mappings: FieldMapping[] = [
    ...COMMON_MAPPINGS,
    ...(SERVICE_EXTRA[serviceType] ?? []),
  ];

  const results: CrossCheckResult[] = [];

  for (const mapping of mappings) {
    const formVal = formValues[mapping.formId]?.trim() ?? '';
    const docVal = docFields[mapping.docKey]?.trim() ?? '';

    // Skip if either side is missing
    if (!formVal || !docVal) continue;

    const norm = mapping.normalizer ?? ((s: string) => s.toLowerCase().trim());
    const normForm = norm(formVal);
    const normDoc = norm(docVal);
    const threshold = mapping.threshold ?? 0.8;

    const sim = similarity(normForm, normDoc);
    const match = sim >= threshold;

    let message: string;
    if (match) {
      message = `${mapping.label} मेल खाता है।`;
    } else if (sim >= 0.5) {
      message = `${mapping.label} में अंतर हो सकता है — कृपया जाँचें। (फॉर्म: "${formVal}", दस्तावेज़: "${docVal}")`;
    } else {
      message = `${mapping.label} मेल नहीं खाता। (फॉर्म: "${formVal}", दस्तावेज़: "${docVal}")`;
    }

    results.push({
      fieldId: mapping.formId,
      fieldLabel: mapping.label,
      formValue: formVal,
      docValue: docVal,
      match,
      similarity: sim,
      message,
    });
  }

  return results;
}
