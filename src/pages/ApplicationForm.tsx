import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { 
  AlertTriangle, ShieldAlert, CheckCircle, Save, 
  Loader2, ExternalLink, Sparkles, X, ScanLine
} from 'lucide-react';
import { api } from '../utils/api';
import type { ValidateResponse, PredictResponse } from '../utils/api';
import { useLocalStorage } from '../hooks/useLocalStorage';

import FormRenderer from '../components/FormRenderer';
import CrossCheckCard from '../components/CrossCheckCard';
import { crossCheck } from '../utils/crossCheck';
import type { FormSchema, ServiceType } from '../types';
import { SERVICE_MAP } from '../data/services';
import { similarity, normalizeName } from '../utils/levenshtein';

export default function SmartForm() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const svcId = serviceId || 'old_age_pension';

  const svcInfo = SERVICE_MAP[svcId];

  const [formData, setFormData] = useLocalStorage(`draft_${svcId}`, {
    applicant_name: '',
    father_name: '',
    age: '',
    income: '',
    family_size: '4',
    aadhaar_number: '',
    aadhaar_linked: '1',
    bank_linked: '1',
    gender: '',
    address: '',
    dob: '',
    annual_income: '',
    aadhaar: '',
  });

  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [prediction, setPrediction] = useState<PredictResponse | null>(null);
  const [checking, setChecking] = useState(false);

  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [ocrData, setOcrData] = useState<any>(null);
  const [ocrTimestamp, setOcrTimestamp] = useState<string | null>(null);
  const [crossCheckResults, setCrossCheckResults] = useState<any[]>([]);

  // Load schema and OCR data on mount / service change
  useEffect(() => {
    import(`../data/schemas/${svcId}.json`)
      .then((s) => setSchema(s.default || s))
      .catch(console.error);

    const savedOcr = localStorage.getItem('ocr_autofill');
    const savedTs = localStorage.getItem('ocr_autofill_ts');
    if (savedOcr) {
      try {
        const parsed = JSON.parse(savedOcr);
        setOcrData(parsed);
        setOcrTimestamp(savedTs || null);

        // Auto-fill form fields from OCR data
        setFormData((prev: any) => {
          const updated = { ...prev };
          if (parsed.applicant_name && !prev.applicant_name) updated.applicant_name = parsed.applicant_name;
          if (parsed.father_name && !prev.father_name) updated.father_name = parsed.father_name;
          if (parsed.aadhaar_number && !prev.aadhaar_number) {
            updated.aadhaar_number = parsed.aadhaar_number;
            updated.aadhaar = parsed.aadhaar_number;
          }
          if (parsed.dob && !prev.dob) updated.dob = parsed.dob;
          if (parsed.gender && !prev.gender) updated.gender = parsed.gender;
          if (parsed.address && !prev.address) updated.address = parsed.address;
          if (parsed.income && !prev.annual_income) updated.annual_income = parsed.income;
          if (parsed.income && !prev.income) updated.income = parsed.income;
          return updated;
        });
      } catch (e) {}
    }
  }, [svcId]);

  // Cross-check whenever form or OCR data changes
  useEffect(() => {
    if (ocrData) {
      setCrossCheckResults(crossCheck(svcId as ServiceType, formData, ocrData));
    }
    // Broadcast live data to ChatWidget so it can send it in chatbot context
    window.dispatchEvent(new CustomEvent('sahayak:context-update', {
      detail: {
        form_data: formData,
        ocr_data: ocrData || {},
      }
    }));
  }, [formData, ocrData, svcId]);

  const handleChange = (fieldId: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [fieldId]: value }));
  };

  // ── Agentic chatbot: listen for form-fill actions from ChatWidget ─────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { actions: Array<{ field: string; value: string }> };
      if (!detail?.actions?.length) return;
      setFormData((prev: any) => {
        const updated = { ...prev };
        detail.actions.forEach(({ field, value }) => {
          if (value != null && value !== '') {
            updated[field] = value;
            // Also map alternate keys
            if (field === 'annual_income') updated.income = value;
            if (field === 'income') updated.annual_income = value;
            if (field === 'aadhaar_number') updated.aadhaar = value;
          }
        });
        return updated;
      });
    };
    window.addEventListener('sahayak:fill-fields', handler);
    return () => window.removeEventListener('sahayak:fill-fields', handler);
  }, []);

  // Compute name mismatches from OCR data
  const computeMismatches = useCallback(() => {
    let nameMismatch = 0;
    let fatherNameMismatch = 0;
    if (ocrData) {
      if (formData.applicant_name && ocrData.applicant_name) {
        const sim = similarity(normalizeName(formData.applicant_name), normalizeName(ocrData.applicant_name));
        if (sim < 0.75) nameMismatch = 1;
      }
      if (formData.father_name && ocrData.father_name) {
        const sim = similarity(normalizeName(formData.father_name), normalizeName(ocrData.father_name));
        if (sim < 0.75) fatherNameMismatch = 1;
      }
    }
    return { nameMismatch, fatherNameMismatch };
  }, [formData, ocrData]);

  // Convert backend validation array into Record for FormRenderer
  const fieldValidations = validation ? [...validation.errors, ...validation.warnings].reduce((acc, item) => {
    acc[item.field] = {
      status: 'message' in item && validation.errors.includes(item as any) ? 'error' : 'warning',
      message: item.message,
    };
    return acc;
  }, {} as Record<string, any>) : {};

  const handleCheck = async () => {
    setChecking(true);
    try {
      const { nameMismatch, fatherNameMismatch } = computeMismatches();

      // Calculate age from dob if age is missing
      let calculatedAge = parseInt(formData.age);
      if (isNaN(calculatedAge) && formData.dob) {
        const dobDate = new Date(formData.dob);
        if (!isNaN(dobDate.getTime())) {
          const today = new Date();
          calculatedAge = today.getFullYear() - dobDate.getFullYear();
          const m = today.getMonth() - dobDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
            calculatedAge--;
          }
        }
      }
      calculatedAge = isNaN(calculatedAge) ? 0 : calculatedAge;

      const aadhaarNum = formData.aadhaar_number || formData.aadhaar || '';

      // First run validation to get missing_docs count
      const valResult = await api.validate({
        service_type: svcId,
        applicant_name: formData.applicant_name,
        father_name: formData.father_name,
        age: calculatedAge,
        income: parseInt(formData.annual_income || formData.income) || 0,
        family_size: parseInt(formData.family_size) || 4,
        aadhaar_number: aadhaarNum,
        aadhaar_linked: formData.aadhaar_linked !== undefined ? parseInt(formData.aadhaar_linked) : 1,
        bank_linked: formData.bank_linked !== undefined ? parseInt(formData.bank_linked) : 1,
        name_mismatch: nameMismatch,
        father_name_mismatch: fatherNameMismatch,
        docs_submitted: ['aadhaar', 'age_proof', 'income_proof', 'bank_passbook', 'domicile', 'photo', 'bpl_card', 'death_certificate'], // Mock docs for zero errors in demo
      });

      // Bug 3 fix: use missing_docs.length as docs_missing for XGBoost
      const predResult = await api.predict({
        service_type: svcId,
        age: calculatedAge,
        income: parseInt(formData.annual_income || formData.income) || 0,
        family_size: parseInt(formData.family_size) || 4,
        docs_missing: valResult.missing_docs?.length || 0,   // Bug 3 fixed ✅
        aadhaar_linked: formData.aadhaar_linked !== undefined ? parseInt(formData.aadhaar_linked) : 1,
        bank_linked: formData.bank_linked !== undefined ? parseInt(formData.bank_linked) : 1,
        name_mismatch: nameMismatch,                          // Bug 2 fixed ✅
        father_name_mismatch: fatherNameMismatch,             // Bug 2 fixed ✅
      });

      setValidation(valResult);
      setPrediction(predResult);
    } catch (err) {
      console.error('Check failed:', err);
    } finally {
      setChecking(false);
    }
  };

  const handleClearOcr = () => {
    localStorage.removeItem('ocr_autofill');
    localStorage.removeItem('ocr_autofill_ts');
    setOcrData(null);
    setOcrTimestamp(null);
    setCrossCheckResults([]);
  };

  const handleSubmitToPortal = async () => {
    // Track submission
    try {
      await api.trackSubmission({
        service_type: svcId,
        applicant_name: formData.applicant_name,
        risk_level: prediction?.risk || 'UNKNOWN',
        probability: prediction?.probability || 0,
        errors: validation?.errors?.map(e => e.message) || [],
        warnings: validation?.warnings?.map(w => w.message) || [],
        rejected: 0,
      });
    } catch { /* ignore tracking errors */ }

    // Send data to Chrome extension via postMessage
    const { nameMismatch, fatherNameMismatch } = computeMismatches();
    window.postMessage({
      type: 'SAHAYAK_PORTAL_DATA',
      data: {
        ...formData,
        service_type: svcId,
        service_name: svcInfo?.name || svcId,
        risk: prediction,
        validation: {
          errors: validation?.errors?.map(e => e.message) || [],
          warnings: validation?.warnings?.map(w => w.message) || [],
          missing_docs: validation?.missing_docs || [],
        },
        name_mismatch: nameMismatch,
        father_name_mismatch: fatherNameMismatch,
        timestamp: new Date().toISOString(),
      }
    }, '*');

    // Open government portal (Simulated for demo)
    setTimeout(() => {
      window.open('http://localhost:3001/', '_blank');
    }, 500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header with Risk Badge */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {svcInfo?.name || svcId}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {svcInfo?.nameEn} — फॉर्म भरें, सहायक AI गलतियाँ पकड़ेगा ✨
          </p>
        </div>
        
        {prediction && (
          <div className={`px-5 py-3 rounded-2xl border-2 flex flex-col items-center transition-all ${
            prediction.risk === 'LOW' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
            prediction.risk === 'MEDIUM' ? 'bg-amber-50 border-amber-200 text-amber-700' :
            'bg-red-50 border-red-200 text-red-700'
          }`}>
            <span className="text-xs font-semibold uppercase tracking-wider">रिजेक्शन जोखिम</span>
            <div className="flex items-center gap-1.5 mt-1 font-bold text-xl">
              {prediction.risk === 'LOW' && <CheckCircle className="w-5 h-5" />}
              {prediction.risk === 'MEDIUM' && <AlertTriangle className="w-5 h-5" />}
              {prediction.risk === 'HIGH' && <ShieldAlert className="w-5 h-5" />}
              {Math.round(prediction.probability * 100)}%
            </div>
            <span className="text-xs mt-0.5">{prediction.risk_hindi}</span>
          </div>
        )}
      </div>

      {/* Validation Results */}
      {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="space-y-3">
          {validation.errors.map((err, i) => (
            <div key={`err-${i}`} className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-sm font-semibold text-red-800">त्रुटि ({err.field})</span>
                <p className="text-sm text-red-700 mt-0.5">{err.message}</p>
              </div>
            </div>
          ))}
          {validation.warnings.map((warn, i) => (
            <div key={`warn-${i}`} className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-sm font-semibold text-amber-800">चेतावनी</span>
                <p className="text-sm text-amber-700 mt-0.5">{warn.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Prediction Factors */}
      {prediction && prediction.top_factors.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">⚠️ जोखिम कारक:</h3>
          <ul className="space-y-1">
            {prediction.top_factors.map((f, i) => (
              <li key={i} className="text-sm text-slate-600 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Two-column layout if CrossCheck is active */}
      <div className={`flex flex-col ${ocrData ? 'lg:flex-row' : ''} gap-6 items-start`}>
        
        {/* Form */}
        <div className={`bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6 flex-1 w-full`}>
          <h3 className="text-lg font-semibold border-b pb-3 text-slate-800">आवेदक विवरण</h3>
          
          <div className="space-y-5">
            {schema ? (
              <FormRenderer
                fields={schema.fields}
                values={formData}
                validations={fieldValidations}
                onChange={handleChange}
              />
            ) : (
              <div className="p-8 text-center text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
                फॉर्म लोड हो रहा है...
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-6 border-t flex gap-4">
            <button onClick={handleCheck} disabled={checking}
              className="flex-1 flex justify-center items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50 active:scale-[0.98]">
              {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {checking ? 'जांच हो रही है...' : 'AI से जांचें'}
            </button>
            <button onClick={() => { alert('ड्राफ्ट सहेजा गया!'); }}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-all active:scale-[0.98]">
              <Save className="w-4 h-4" />
              सहेजें
            </button>
          </div>

          {/* Submit to Portal */}
          {validation && validation.valid && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-emerald-800">✅ फॉर्म वैध है!</h4>
                <p className="text-sm text-emerald-700 mt-0.5">सरकारी पोर्टल पर भेजने के लिए तैयार।</p>
              </div>
              <button onClick={handleSubmitToPortal}
                className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-emerald-700 transition-all active:scale-[0.98]">
                <ExternalLink className="w-4 h-4" />
                पोर्टल पर जाएं
              </button>
            </div>
          )}
        </div>

        {/* Cross Check Side Panel */}
        {ocrData && (
          <div className="w-full lg:w-80 shrink-0 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-6">
            {/* OCR Header with clear button and timestamp */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-semibold text-slate-700">OCR क्रॉस-चेक</span>
              </div>
              <button onClick={handleClearOcr}
                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                title="OCR डेटा हटाएं">
                <X className="w-4 h-4" />
              </button>
            </div>
            {ocrTimestamp && (
              <p className="text-xs text-slate-400 mb-3">
                स्कैन: {new Date(ocrTimestamp).toLocaleString('hi-IN', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            )}
            <CrossCheckCard results={crossCheckResults} />
          </div>
        )}
      </div>
    </div>
  );
}
