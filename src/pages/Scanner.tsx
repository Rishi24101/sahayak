import { useState, useRef } from 'react';
import { ScanLine, Upload, Check, Loader2, FileImage, Zap, Cpu, FileText } from 'lucide-react';
import { api } from '../utils/api';
import { useNavigate } from 'react-router-dom';

export default function Scanner() {
  const [ocrText, setOcrText] = useState('');
  const [extractedFields, setExtractedFields] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrEngine, setOcrEngine] = useState<'llama' | 'tesseract'>('llama');
  const [fileType, setFileType] = useState<'image' | 'pdf' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    setFileType(isPdf ? 'pdf' : 'image');

    // Show preview
    if (!isPdf) {
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null); // No preview for PDFs
    }

    setScanning(true);
    setOcrText('');
    setExtractedFields(null);

    if (isPdf || ocrEngine === 'llama') {
      // For PDFs or Llama mode, always use the backend Llama Scout
      try {
        const result = await api.llamaOcr(file);
        setOcrText(result.raw_text || 'Fields extracted via Llama Scout');
        setExtractedFields(result);
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
      const result = await Tesseract.recognize(file, 'eng+hin', {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            // Could show progress
          }
        }
      });

      const text = result.data.text;
      setOcrText(text);

      try {
        const fields = await api.autofill(text);
        setExtractedFields(fields);
      } catch {
        const aadhaarMatch = text.match(/\d{4}\s?\d{4}\s?\d{4}/);
        const dobMatch = text.match(/\d{2}[\/\-]\d{2}[\/\-]\d{4}/) || text.match(/\d{4}[\/\-]\d{2}[\/\-]\d{2}/);
        setExtractedFields({
          aadhaar_number: aadhaarMatch ? aadhaarMatch[0].replace(/\s/g, '') : null,
          dob: dobMatch ? dobMatch[0] : null,
          applicant_name: null,
          gender: null,
          address: null,
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
    const existing = JSON.parse(localStorage.getItem('ocr_autofill') || '{}');
    const merged = { ...existing };
    if (extractedFields.applicant_name) merged.applicant_name = extractedFields.applicant_name;
    if (extractedFields.aadhaar_number) merged.aadhaar_number = extractedFields.aadhaar_number;
    if (extractedFields.dob) merged.dob = extractedFields.dob;
    if (extractedFields.gender) merged.gender = extractedFields.gender;
    if (extractedFields.address) merged.address = extractedFields.address;
    localStorage.setItem('ocr_autofill', JSON.stringify(merged));
    navigate('/forms');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <ScanLine className="w-8 h-8 text-blue-600" />
          OCR दस्तावेज़ स्कैनर
        </h1>
        <p className="text-slate-500 mt-1">
          आधार कार्ड, पैन कार्ड, या PDF अपलोड करें — AI ऑटो-फिल करेगा
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
            <p className="text-sm text-slate-500">PDF अपलोड किया गया — नया दस्तावेज़ के लिए क्लिक करें</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
              <Upload className="w-8 h-8 text-blue-500" />
            </div>
            <div>
              <p className="text-lg font-medium text-slate-700">दस्तावेज़ अपलोड करें</p>
              <p className="text-sm text-slate-500 mt-1">आधार कार्ड, पैन कार्ड, या कोई भी ID</p>
              <p className="text-xs text-slate-400 mt-2">JPG, PNG, PDF — अधिकतम 5MB</p>
            </div>
          </div>
        )}
      </div>

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
                    { label: 'आधार नंबर', value: extractedFields.aadhaar_number },
                    { label: 'जन्म तिथि', value: extractedFields.dob },
                    { label: 'लिंग', value: extractedFields.gender },
                    { label: 'पता', value: extractedFields.address },
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
                    <Check className="w-4 h-4" />
                    फॉर्म में ऑटो-फिल करें
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
