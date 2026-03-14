import patterns from '../data/rejectionPatterns.json';

type ServiceType = 'old_age_pension' | 'caste_certificate' | 'income_certificate';

export interface ValidationWarning {
  field: string;
  message: string;
  level: 'warning' | 'critical';
}

export const validateField = (
  service: ServiceType,
  fieldName: string,
  value: any,
  context?: any // e.g. mocked aadhaar data
): ValidationWarning | null => {
  const serviceData = patterns.services[service as keyof typeof patterns.services];
  if (!serviceData || !('fields' in serviceData)) return null;
  
  const serviceRules = (serviceData.fields as any)[fieldName];
  
  if (!serviceRules) return null;

  for (const rule of serviceRules.rules) {
    if (rule.condition.startsWith('<') && typeof value === 'number') {
      const limit = parseInt(rule.condition.substring(1));
      if (value < limit) {
        return { field: fieldName, message: rule.error, level: 'critical' };
      }
    }
    
    if (rule.condition.startsWith('>') && typeof value === 'number') {
      const limit = parseInt(rule.condition.substring(1));
      if (value > limit) {
        return { field: fieldName, message: rule.error, level: 'critical' };
      }
    }

    if (rule.condition === 'mismatch_aadhaar' && typeof value === 'string') {
      // Mock logic: assume context.aadhaarName has the truth
      if (context?.aadhaarName && value.toLowerCase() !== context.aadhaarName.toLowerCase()) {
        return { field: fieldName, message: rule.error, level: 'warning' };
      }
    }
  }

  return null;
};

export const calculateRiskScore = (warnings: ValidationWarning[]): 'Low' | 'Medium' | 'High' => {
  if (warnings.length === 0) return 'Low';
  
  const hasCritical = warnings.some(w => w.level === 'critical');
  if (hasCritical || warnings.length > 2) return 'High';
  
  return 'Medium';
};
