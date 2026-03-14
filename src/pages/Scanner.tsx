import { useState, useRef } from 'react';
import { ScanLine, Upload, Check, Loader2, FileImage, Zap, Cpu, FileText, ArrowRight, Sparkles } from 'lucide-react';
import { api } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { SERVICE_MAP } from '../data/services';

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  aadhaar: 'आधार कार्ड',
  pan: 'पैन कार्ड',
  ration_card: 'राशन कार्ड',
  income_certificate: 'आय प्रमाण पत्र',
  caste_certificate: 'जाति प्रमाण पत्र',
  domicile_certificate: 'मूल निवास प्रमाण पत्र',
  death_certificate: 'मृत्यु प्रमाण पत्र',
  bank_passbook: 'बैंक पासबुक',
  school_tc: 'स्कूल TC',
  other: 'अन्य दस्तावेज़',
};

export default function Scanner() {
  const [ocrText, setOcrText] = useState('');
  const [extractedFields, setExtractedFields] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrEngine, setOcrEngine] = useState<'llama' | 'tesseract'>('llama');
  const [fileType, setFileType] = useState<'image' | 'pdf' | null>(null);
  const [selectedService, setSelectedService] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    setFileType(isPdf ? 'pdf' : 'image');

    if (!isPdf) {
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }

    setScanning(true);
    setOcrText('');
    setExtractedFields(null);
    setSelectedService('');

    if (isPdf || ocrEngine === 'llama') {
      try {
        const result = await api.llamaOcr(file);
        setOcrText(result.raw_text || 'Fields extracted via Llama Scout');
        setExtractedFields(result);
        // Auto-select service from detected document type
        if (result.detected_service) {
          setSelectedService(result.detected_service);
        }
      } catch {
        console.warn('Llama Scout OCR failed, falling back to Tesseract.js');
        if (!isPdf) {
          await runTesseractOcr(file);
        } else {
          setOcrText('PDF OCR विफल — बैकएंड चालू करें। PDFs के लिए Llama Scout ज़रूरी है।');
        }
      }
    } else {
      await runTesseractOcr(file);
    }

    setScanning(false);
  };

  const runTesseractOcr = async (file: File) => {
    try {
      const Tesseract = await import('tesseract.js');
      const result = await Tesseract.recognize(file, 'eng+hin');
      const text = result.data.text;
      setOcrText(text);

      try {
        const fields = await api.autofill(text);
        setExtractedFields(fields);
        if (fields.detected_service) {
          setSelectedService(fields.detected_service);
        }
      } catch {
        const aadhaarMatch = text.match(/\d{4}\s?\d{4}\s?\d{4}/);
        const dobMatch = text.match(/\d{2}[\/\-]\d{2}[\/\-]\d{4}/) || text.match(/\d{4}[\/\-]\d{2}[\/\-]\d{2}/);
        setExtractedFields({
          aadhaar_number: aadhaarMatch ? aadhaarMatch[0].replace(/\s/g, '') : null,
          dob: dobMatch ? dobMatch[0] : null,
          applicant_name: null,
          father_name: null,
          gender: null,
          address: null,
          income: null,
          document_type: null,
          detected_service: null,
          fields_found: (aadhaarMatch ? 1 : 0) + (dobMatch ? 1 : 0),
        });
      }
    } catch (err) {
      console.error('OCR failed:', err);
      setOcrText('OCR विफल — कृपया पुनः प्रयास करें');
    }
  };

  const handleUseFields = () => {
    if (!extractedFields) return;

    const targetService = selectedService || extractedFields.detected_service;

    // Store all OCR fields including new ones
    const ocrPayload: Record<string, string> = {};
    if (extractedFields.applicant_name) ocrPayload.applicant_name = extractedFields.applicant_name;
    if (extractedFields.father_name) ocrPayload.father_name = extractedFields.father_name;
    if (extractedFields.aadhaar_number) ocrPayload.aadhaar_number = extractedFields.aadhaar_number;
    if (extractedFields.dob) ocrPayload.dob = extractedFields.dob;
    if (extractedFields.gender) ocrPayload.gender = extractedFields.gender;
    if (extractedFields.address) ocrPayload.address = extractedFields.address;
    if (extractedFields.income) ocrPayload.income = extractedFields.income;
    if (extractedFields.document_type) ocrPayload.document_type = extractedFields.document_type;

    // Merge with existing OCR data
    const existing = JSON.parse(localStorage.getItem('ocr_autofill') || '{}');
    localStorage.setItem('ocr_autofill', JSON.stringify({ ...existing, ...ocrPayload }));
    localStorage.setItem('ocr_autofill_ts', new Date().toISOString());

    // Navigate directly to the specific service form if we know it; else service list
    if (targetService) {
      navigate(`/forms/${targetService}`);
    } else {
      navigate('/forms');
    }
  };

  const docTypeLabel = extractedFields?.document_type
    ? DOCUMENT_TYPE_LABELS[extractedFields.document_type] || extractedFields.document_type
    : null;

  const targetServiceInfo = (selectedService || extractedFields?.detected_service)
    ? SERVICE_MAP[selectedService || extractedFields?.detected_service]
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <ScanLine className="w-8 h-8 text-blue-600" />
          OCR दस्तावेज़ स्कैनर
        </h1>
        <p className="text-slate-500 mt-1">
          आधार कार्ड, आय प्रमाण, जाति प्रमाण, या PDF अपलोड करें — AI ऑटो-फिल करेगा
        </p>
      </div>

      {/* OCR Engine Selector */}
      <div className="flex gap-3">
        <button
          onClick={() => setOcrEngine('llama')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
            ocrEngine === 'llama'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}>
          <Zap className="w-4 h-4" />
          Llama Scout AI (तेज़ + सटीक)
        </button>
        <button
          onClick={() => setOcrEngine('tesseract')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
            ocrEngine === 'tesseract'
              ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/25'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}>
          <Cpu className="w-4 h-4" />
          Tesseract.js (ऑफलाइन)
        </button>
      </div>

      {/* Upload Area */}
      <div 
        className="bg-white rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-400 transition-colors p-12 text-center cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept="image/*,.pdf,application/pdf" className="hidden" onChange={handleFileChange} />
        
        {scanning ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            <p className="text-lg font-medium text-slate-700">स्कैन हो रहा है...</p>
            <p className="text-sm text-slate-500">
              {ocrEngine === 'llama' || fileType === 'pdf'
                ? '🦙 Llama Scout AI दस्तावेज़ पढ़ रहा है...' 
                : 'Tesseract.js ब्राउज़र में OCR कर रहा है (ऑफलाइन)'}
            </p>
          </div>
        ) : imagePreview ? (
          <div className="flex flex-col items-center gap-4">
            <img src={imagePreview} alt="Preview" className="max-h-48 rounded-xl shadow-lg" />
            <p className="text-sm text-slate-500">नया दस्तावेज़ अपलोड करने के लिए क्लिक करें</p>
          </div>
        ) : fileType === 'pdf' ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
              <FileText className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-sm text-slate-500">PDF स्कैन किया — नया के लिए क्लिक करें</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
              <Upload className="w-8 h-8 text-blue-500" />
            </div>
            <div>
              <p className="text-lg font-medium text-slate-700">दस्तावेज़ अपलोड करें</p>
              <p className="text-sm text-slate-500 mt-1">आधार, आय/जाति/निवास प्रमाण, PDF — कोई भी दस्तावेज़</p>
              <p className="text-xs text-slate-400 mt-2">JPG, PNG, PDF — अधिकतम 5MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Detected Document + Service Banner */}
      {extractedFields && docTypeLabel && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-xl">
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-indigo-900">
                पहचाना गया: {docTypeLabel}
              </p>
              {targetServiceInfo && (
                <p className="text-xs text-indigo-600 mt-0.5">
                  → सुझाव: {targetServiceInfo.name} फॉर्म
                </p>
              )}
            </div>
          </div>
          {/* Service override dropdown */}
          <select
            value={selectedService || extractedFields?.detected_service || ''}
            onChange={e => setSelectedService(e.target.value)}
            className="text-xs border border-indigo-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">-- सेवा चुनें --</option>
            {Object.values(SERVICE_MAP).map(svc => (
              <option key={svc.id} value={svc.id}>{svc.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* OCR Results */}
      {ocrText && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Raw Text */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                {fileType === 'pdf' ? <FileText className="w-4 h-4" /> : <FileImage className="w-4 h-4" />}
                OCR पाठ ({ocrEngine === 'llama' || fileType === 'pdf' ? 'Llama Scout' : 'Tesseract'})
              </h3>
            </div>
            <pre className="p-4 text-sm text-slate-600 whitespace-pre-wrap font-mono max-h-64 overflow-auto">
              {ocrText}
            </pre>
          </div>

          {/* Extracted Fields */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                निकाले गए विवरण ({extractedFields?.fields_found || 0} फ़ील्ड)
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {extractedFields ? (
                <>
                  {[
                    { label: 'नाम', value: extractedFields.applicant_name },
                    { label: 'पिता का नाम', value: extractedFields.father_name },
                    { label: 'आधार नंबर', value: extractedFields.aadhaar_number },
                    { label: 'जन्म तिथि', value: extractedFields.dob },
                    { label: 'लिंग', value: extractedFields.gender },
                    { label: 'पता', value: extractedFields.address },
                    { label: 'वार्षिक आय', value: extractedFields.income ? `₹${Number(extractedFields.income).toLocaleString('hi-IN')}` : null },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <span className="text-sm text-slate-500">{label}</span>
                      <span className={`text-sm font-medium ${value ? 'text-slate-900' : 'text-slate-300'}`}>
                        {value || 'नहीं मिला'}
                      </span>
                    </div>
                  ))}
                  
                  <button onClick={handleUseFields}
                    className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2">
                    <ArrowRight className="w-4 h-4" />
                    {targetServiceInfo
                      ? `${targetServiceInfo.name} फॉर्म में जाएं`
                      : 'फॉर्म में ऑटो-फिल करें'}
                  </button>
                </>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">स्कैनिंग का इंतज़ार...</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
