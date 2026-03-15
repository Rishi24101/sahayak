import { useState, useRef } from 'react';
import { ScanLine, Upload, Check, Loader2, FileText, Zap, Cpu, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { SERVICE_MAP } from '../data/services';

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  aadhaar:              'आधार कार्ड',
  pan:                  'पैन कार्ड',
  ration_card:          'राशन कार्ड',
  income_certificate:   'आय प्रमाण पत्र',
  caste_certificate:    'जाति प्रमाण पत्र',
  domicile_certificate: 'मूल निवास प्रमाण पत्र',
  death_certificate:    'मृत्यु प्रमाण पत्र',
  bank_passbook:        'बैंक पासबुक',
  school_tc:            'स्कूल TC',
  other:                'अन्य दस्तावेज़',
};

const FIELD_LABELS: Record<string, string> = {
  applicant_name: 'नाम',
  father_name: 'पिता/पति का नाम',
  aadhaar_number: 'आधार नंबर',
  dob: 'जन्म तिथि',
  gender: 'लिंग',
  address: 'पता',
  income: 'वार्षिक आय',
  mobile: 'मोबाइल',
};

export default function Scanner() {
  const [ocrText, setOcrText]                 = useState('');
  const [extractedFields, setExtractedFields] = useState<any>(null);
  const [scanning, setScanning]               = useState(false);
  const [imagePreview, setImagePreview]       = useState<string | null>(null);
  const [ocrEngine, setOcrEngine]             = useState<'llama' | 'tesseract'>('llama');
  const [fileType, setFileType]               = useState<'image' | 'pdf' | null>(null);
  const [selectedService, setSelectedService] = useState<string>('');
  const [animatingFields, setAnimatingFields] = useState<Set<string>>(new Set());
  const [doneFields, setDoneFields]           = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate     = useNavigate();

  // Animate fields popping in one by one as OCR results arrive
  const animateFields = (fields: Record<string, any>) => {
    const fieldKeys = Object.keys(FIELD_LABELS).filter(k => fields[k]);
    let delay = 0;
    for (const key of fieldKeys) {
      const d = delay;
      setTimeout(() => {
        setAnimatingFields(prev => new Set([...prev, key]));
        setTimeout(() => {
          setAnimatingFields(prev => { const n = new Set(prev); n.delete(key); return n; });
          setDoneFields(prev => new Set([...prev, key]));
        }, 600);
      }, d);
      delay += 220;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    setFileType(isPdf ? 'pdf' : 'image');
    setAnimatingFields(new Set());
    setDoneFields(new Set());

    if (!isPdf) {
      const reader = new FileReader();
      reader.onload = ev => setImagePreview(ev.target?.result as string);
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
        setOcrText(result.raw_text || 'फ़ील्ड Llama Scout द्वारा निकाले गए');
        setExtractedFields(result);
        if (result.detected_service) setSelectedService(result.detected_service);
        animateFields(result);
      } catch {
        if (!isPdf) await runTesseractOcr(file);
        else setOcrText('PDF OCR विफल — बैकएंड चालू करें।');
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
        if (fields.detected_service) setSelectedService(fields.detected_service);
        animateFields(fields);
      } catch {
        setExtractedFields({ fields_found: 0 });
      }
    } catch {
      setOcrText('OCR विफल — पुनः प्रयास करें');
    }
  };

  const handleUseFields = () => {
    if (!extractedFields) return;
    const targetService = selectedService || extractedFields.detected_service;
    const ocrPayload: Record<string, string> = {};
    ['applicant_name', 'father_name', 'aadhaar_number', 'dob', 'gender', 'address', 'income', 'mobile', 'document_type']
      .forEach(k => { if (extractedFields[k]) ocrPayload[k] = extractedFields[k]; });
    const existing = JSON.parse(localStorage.getItem('ocr_autofill') || '{}');
    localStorage.setItem('ocr_autofill', JSON.stringify({ ...existing, ...ocrPayload }));
    localStorage.setItem('ocr_autofill_ts', new Date().toISOString());
    navigate(targetService ? `/forms/${targetService}` : '/forms');
  };

  const docTypeLabel     = extractedFields?.document_type ? DOCUMENT_TYPE_LABELS[extractedFields.document_type] || extractedFields.document_type : null;
  const targetServiceInfo = SERVICE_MAP[selectedService || extractedFields?.detected_service || ''] || null;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--csc-blue)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ScanLine size={20} /> OCR दस्तावेज़ स्कैनर
        </h1>
        <p style={{ fontSize: 12, color: 'var(--csc-muted)', marginTop: 4 }}>
          आधार कार्ड, आय प्रमाण, जाति / निवास प्रमाण, PDF अपलोड करें — AI स्वतः फ़ील्ड भरेगा
        </p>
      </div>

      {/* ── Engine Toggle ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[
          { id: 'llama',      icon: Zap,  label: 'Llama Scout AI',  sub: 'तेज़ + सटीक (ऑनलाइन)' },
          { id: 'tesseract',  icon: Cpu,  label: 'Tesseract.js',    sub: 'ऑफलाइन मोड' },
        ].map(eng => (
          <button key={eng.id} onClick={() => setOcrEngine(eng.id as any)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 4,
            border: ocrEngine === eng.id ? '2px solid var(--csc-blue)' : '1px solid var(--csc-border)',
            background: ocrEngine === eng.id ? 'var(--csc-blue-light)' : '#fff',
            color: ocrEngine === eng.id ? 'var(--csc-blue)' : 'var(--csc-muted)',
            fontWeight: ocrEngine === eng.id ? 700 : 400, fontSize: 12, cursor: 'pointer',
          }}>
            <eng.icon size={14} />
            <div style={{ textAlign: 'left' }}>
              <div>{eng.label}</div>
              <div style={{ fontSize: 10, opacity: 0.7, marginTop: 1 }}>{eng.sub}</div>
            </div>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* ── Left: Upload + OCR Text ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Upload Zone */}
          <div
            className="csc-card"
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed var(--csc-border)', background: scanning ? 'var(--csc-blue-light)' : '#fff',
              padding: 28, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseOver={e => { if (!scanning) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--csc-blue-mid)'; }}
            onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--csc-border)'; }}
          >
            <input ref={fileInputRef} type="file" accept="image/*,.pdf,application/pdf" style={{ display: 'none' }} onChange={handleFileChange} />

            {scanning ? (
              <>
                <Loader2 size={32} color="var(--csc-blue)" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 600, color: 'var(--csc-blue)', fontSize: 14 }}>स्कैन हो रहा है...</div>
                <div style={{ fontSize: 12, color: 'var(--csc-muted)', marginTop: 4 }}>
                  {ocrEngine === 'llama' ? '🦙 Llama Scout AI दस्तावेज़ पढ़ रहा है' : 'Tesseract.js ब्राउज़र में काम कर रहा है'}
                </div>
              </>
            ) : imagePreview ? (
              <>
                <img src={imagePreview} alt="preview" style={{ maxHeight: 140, maxWidth: '100%', borderRadius: 4, marginBottom: 8, border: '1px solid var(--csc-border)' }} />
                <div style={{ fontSize: 12, color: 'var(--csc-muted)' }}>नया दस्तावेज़ अपलोड करने के लिए क्लिक करें</div>
              </>
            ) : fileType === 'pdf' ? (
              <>
                <FileText size={36} color="var(--csc-red)" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 600, fontSize: 13 }}>PDF स्कैन किया गया</div>
                <div style={{ fontSize: 12, color: 'var(--csc-muted)', marginTop: 3 }}>नया PDF के लिए क्लिक करें</div>
              </>
            ) : (
              <>
                <Upload size={36} color="var(--csc-blue)" style={{ margin: '0 auto 12px', opacity: 0.7 }} />
                <div style={{ fontWeight: 600, color: 'var(--csc-text)', fontSize: 14 }}>दस्तावेज़ अपलोड करें</div>
                <div style={{ fontSize: 12, color: 'var(--csc-muted)', marginTop: 4 }}>आधार, आय / जाति / निवास प्रमाण, PDF</div>
                <div style={{ fontSize: 11, color: 'var(--csc-border)', marginTop: 6 }}>JPG · PNG · PDF — अधिकतम 5MB</div>
              </>
            )}
          </div>

          {/* Raw OCR Text */}
          {ocrText && (
            <div className="csc-card">
              <div className="csc-card-header">
                <FileText size={14} /> OCR पाठ ({ocrEngine === 'llama' || fileType === 'pdf' ? 'Llama Scout' : 'Tesseract'})
              </div>
              <pre style={{ padding: '10px 14px', fontSize: 11, color: 'var(--csc-muted)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', maxHeight: 210, overflowY: 'auto', lineHeight: 1.6, margin: 0 }}>
                {ocrText}
              </pre>
            </div>
          )}
        </div>

        {/* ── Right: Extracted Fields ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Document Detected Banner */}
          {docTypeLabel && (
            <div className="alert-info" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--csc-blue)' }}>📄 पहचाना गया: {docTypeLabel}</div>
                {targetServiceInfo && <div style={{ fontSize: 11, color: 'var(--csc-muted)', marginTop: 2 }}>→ सुझाव: {targetServiceInfo.name} फॉर्म</div>}
              </div>
              <select
                value={selectedService || extractedFields?.detected_service || ''}
                onChange={e => setSelectedService(e.target.value)}
                className="csc-input"
                style={{ width: 'auto', fontSize: 11, padding: '4px 8px' }}
              >
                <option value="">-- सेवा चुनें --</option>
                {Object.values(SERVICE_MAP).map((svc: any) => (
                  <option key={svc.id} value={svc.id}>{svc.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Extracted Fields Card */}
          <div className="csc-card" style={{ flex: 1 }}>
            <div className="csc-card-header">
              <Check size={14} color="var(--csc-green)" />
              निकाले गए विवरण
              {extractedFields && (
                <span style={{ marginLeft: 'auto' }}>
                  <span className="badge-green">{extractedFields.fields_found || 0} फ़ील्ड</span>
                </span>
              )}
            </div>
            <div style={{ padding: '8px 0' }}>
              {extractedFields ? (
                Object.entries(FIELD_LABELS).map(([key, label]) => {
                  const val = key === 'income' && extractedFields[key]
                    ? `₹${Number(extractedFields[key]).toLocaleString('hi-IN')}`
                    : extractedFields[key];
                  const isAnimating = animatingFields.has(key);
                  const isDone = doneFields.has(key);

                  return (
                    <div key={key} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '9px 16px', borderBottom: '1px solid var(--csc-border)',
                      background: isAnimating ? 'var(--csc-orange-light)' : isDone && val ? 'var(--csc-green-light)' : 'transparent',
                      transition: 'background 0.4s ease',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {val && isDone
                          ? <CheckCircle2 size={13} color="var(--csc-green)" />
                          : val && isAnimating
                            ? <Loader2 size={13} color="var(--csc-orange)" style={{ animation: 'spin 0.6s linear infinite' }} />
                            : <XCircle size={13} color="var(--csc-border)" />
                        }
                        <span style={{ fontSize: 12, color: 'var(--csc-muted)', fontWeight: 600 }}>{label}</span>
                      </div>
                      <span style={{
                        fontSize: 12, fontWeight: val ? 600 : 400,
                        color: val ? 'var(--csc-text)' : 'var(--csc-border)',
                        maxWidth: 200, textAlign: 'right', wordBreak: 'break-all',
                        ...(isAnimating ? { animation: 'slideInBadge 0.3s ease', color: 'var(--csc-orange)' } : {}),
                        ...(isDone && val ? { color: 'var(--csc-green)' } : {}),
                      }}>
                        {val || '—'}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--csc-border)' }}>
                  <ScanLine size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                  <div style={{ fontSize: 12 }}>दस्तावेज़ स्कैन करने के बाद यहाँ विवरण दिखेंगे</div>
                </div>
              )}

              {extractedFields && (extractedFields.fields_found || 0) > 0 && (
                <div style={{ padding: '12px 16px' }}>
                  <button onClick={handleUseFields} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    <ArrowRight size={14} />
                    {targetServiceInfo ? `${targetServiceInfo.name} फॉर्म में जाएं` : 'फॉर्म में ऑटो-फिल करें'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
