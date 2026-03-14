import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { 
  AlertTriangle, ShieldAlert, CheckCircle, Save, 
  Loader2, ExternalLink, Sparkles
} from 'lucide-react';
import { api } from '../utils/api';
import type { ValidateResponse, PredictResponse } from '../utils/api';
import { useLocalStorage } from '../hooks/useLocalStorage';

const SERVICE_NAMES: Record<string, string> = {
  old_age_pension: 'वृद्धावस्था पेंशन (IGNOAPS)',
  widow_pension: 'विधवा पेंशन (IGNWPS)',
  ration_card: 'राशन कार्ड (NFSA)',
  income_certificate: 'आय प्रमाण पत्र',
  caste_certificate: 'जाति प्रमाण पत्र (SC/ST/OBC)',
  ayushman: 'आयुष्मान भारत (PM-JAY)',
};

const PORTAL_URLS: Record<string, string> = {
  old_age_pension: 'https://edistrict.cgstate.gov.in/',
  widow_pension: 'https://edistrict.cgstate.gov.in/',
  ration_card: 'https://khadya.cg.nic.in/',
  income_certificate: 'https://edistrict.cgstate.gov.in/',
  caste_certificate: 'https://edistrict.cgstate.gov.in/',
  ayushman: 'https://pmjay.gov.in/',
};

export default function SmartForm() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const svcId = serviceId || 'old_age_pension';

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
  });

  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [prediction, setPrediction] = useState<PredictResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [autocorrectSuggestions, setAutocorrectSuggestions] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleBlur = useCallback(async (fieldName: string) => {
    const value = formData[fieldName as keyof typeof formData];
    if (!value) return;
    
    try {
      const result = await api.autocorrect(fieldName, value, svcId);
      if (result.changed) {
        setAutocorrectSuggestions(prev => ({
          ...prev,
          [fieldName]: result.suggestion
        }));
      }
    } catch { /* Ignore autocorrect errors */ }
  }, [formData, svcId]);

  const acceptSuggestion = async (fieldName: string) => {
    const result = await api.autocorrect(fieldName, formData[fieldName as keyof typeof formData], svcId);
    if (result.changed) {
      setFormData({ ...formData, [fieldName]: result.corrected });
      setAutocorrectSuggestions(prev => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  };

  const handleCheck = async () => {
    setChecking(true);
    try {
      const [valResult, predResult] = await Promise.all([
        api.validate({
          service_type: svcId,
          applicant_name: formData.applicant_name,
          father_name: formData.father_name,
          age: parseInt(formData.age) || 0,
          income: parseInt(formData.income) || 0,
          family_size: parseInt(formData.family_size) || 4,
          aadhaar_number: formData.aadhaar_number,
          aadhaar_linked: parseInt(formData.aadhaar_linked),
          bank_linked: parseInt(formData.bank_linked),
        }),
        api.predict({
          service_type: svcId,
          age: parseInt(formData.age) || 0,
          income: parseInt(formData.income) || 0,
          family_size: parseInt(formData.family_size) || 4,
          docs_missing: 0,
          aadhaar_linked: parseInt(formData.aadhaar_linked),
          bank_linked: parseInt(formData.bank_linked),
        }),
      ]);
      setValidation(valResult);
      setPrediction(predResult);
    } catch (err) {
      console.error('Check failed:', err);
    } finally {
      setChecking(false);
    }
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

    // Open government portal
    const portalUrl = PORTAL_URLS[svcId] || 'https://edistrict.cgstate.gov.in/';
    window.open(portalUrl, '_blank');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header with Risk Badge */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {SERVICE_NAMES[svcId] || svcId}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            फॉर्म भरें — सहायक AI गलतियाँ पकड़ेगा ✨
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

      {/* Form */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <h3 className="text-lg font-semibold border-b pb-3 text-slate-800">आवेदक विवरण</h3>
        
        <div className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              आवेदक का नाम <span className="text-slate-400">(आधार अनुसार)</span>
            </label>
            <input type="text" name="applicant_name" value={formData.applicant_name}
              onChange={handleChange} onBlur={() => handleBlur('applicant_name')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all"
              placeholder="जैसे: Ram Kumar"
            />
            {autocorrectSuggestions.applicant_name && (
              <button onClick={() => acceptSuggestion('applicant_name')}
                className="mt-1.5 text-xs text-blue-600 flex items-center gap-1 hover:underline">
                <Sparkles className="w-3 h-3" />
                {autocorrectSuggestions.applicant_name}
              </button>
            )}
          </div>

          {/* Father Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">पिता/पति का नाम</label>
            <input type="text" name="father_name" value={formData.father_name}
              onChange={handleChange} onBlur={() => handleBlur('father_name')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all"
            />
          </div>

          {/* Age + Income (2-col) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">आयु (वर्ष)</label>
              <input type="number" name="age" value={formData.age}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all"
                placeholder="जैसे: 65"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">वार्षिक आय (₹)</label>
              <input type="number" name="income" value={formData.income}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all"
                placeholder="जैसे: 80000"
              />
            </div>
          </div>

          {/* Aadhaar + Family Size */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">आधार नंबर</label>
              <input type="text" name="aadhaar_number" value={formData.aadhaar_number}
                onChange={handleChange} maxLength={12}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all font-mono"
                placeholder="XXXX XXXX XXXX"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">परिवार सदस्य</label>
              <input type="number" name="family_size" value={formData.family_size}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Aadhaar/Bank linked */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">आधार लिंक?</label>
              <select name="aadhaar_linked" value={formData.aadhaar_linked} onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none">
                <option value="1">हाँ ✅</option>
                <option value="0">नहीं ❌</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">बैंक खाता लिंक?</label>
              <select name="bank_linked" value={formData.bank_linked} onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none">
                <option value="1">हाँ ✅</option>
                <option value="0">नहीं ❌</option>
              </select>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">पता</label>
            <input type="text" name="address" value={formData.address}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all"
              placeholder="गाँव/वार्ड, ब्लॉक, जिला"
            />
          </div>
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
    </div>
  );
}
