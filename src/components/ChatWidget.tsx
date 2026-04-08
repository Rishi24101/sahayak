import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, X, Bot, Volume2, VolumeX, Minimize2, Maximize2, Loader2, StopCircle, MessageSquare } from 'lucide-react';
import { api } from '../utils/api';
import type { FormAction } from '../utils/api';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  source?: string;
  actions?: FormAction[];  // Agentic: filled fields
}

interface ServiceContext {
  serviceId: string;
  serviceName: string;
  errors?: string[];
  missingDocs?: string[];
}

interface Props {
  serviceContext?: ServiceContext | null;
}

// Quick-question chips — service-sensitive
const QUICK_CHIPS: Record<string, string[]> = {
  old_age_pension: ['क्या दस्तावेज़ चाहिए?', 'आयु सीमा क्या है?', 'बैंक खाता क्यों ज़रूरी है?', 'फॉर्म कहाँ जमा होता है?'],
  widow_pension: ['पात्रता की शर्तें बताओ', 'मृत्यु प्रमाण कहाँ बनता है?', 'कौन से दस्तावेज़ चाहिए?'],
  ration_card: ['BPL कार्ड कैसे बनता है?', 'आय सीमा क्या है?', 'सभी सदस्यों का आधार क्यों चाहिए?'],
  income_certificate: ['आय प्रमाण पत्र कितने दिन में बनता है?', 'स्व-घोषणा पत्र क्या है?', 'कौन से दस्तावेज़ चाहिए?'],
  caste_certificate: ['पटवारी रिपोर्ट कैसे मिलती है?', 'शपथ पत्र कहाँ बनता है?', 'पिता का जाति प्रमाण क्यों चाहिए?'],
  ayushman: ['पात्रता कैसे जानें?', 'OTP किस नंबर पर आएगा?', 'कितने परिवारों को लाभ मिलता है?'],
  domicile_certificate: ['निवास प्रमाण के लिए क्या चाहिए?', 'कितने साल का निवास ज़रूरी है?'],
  default: ['योजनाओं की जानकारी दो', 'दस्तावेज़ सूची बताओ', 'पात्रता नियम क्या हैं?', 'CSC हेल्पलाइन नंबर'],
};

export default function ChatWidget({ serviceContext }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'bot',
      text: `नमस्ते! मैं सहायक हूँ। 🙏\n${
        serviceContext
          ? `आप अभी **${serviceContext.serviceName}** का फॉर्म भर रहे हैं। इस योजना से जुड़े सवाल पूछें।`
          : 'योजनाओं, दस्तावेज़ों, या फॉर्म के बारे में पूछें।'
      }\n\n🎙️ माइक बटन दबाकर हिंदी में बोलें!`,
      source: 'system',
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastInputWasVoice = useRef(false);  // ← TTS fires only when this is true

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Update welcome message when service context changes
  useEffect(() => {
    if (serviceContext) {
      setMessages([{
        id: Date.now().toString(),
        sender: 'bot',
        text: `नमस्ते! मैं सहायक हूँ। 🙏\n\nआप अभी **${serviceContext.serviceName}** का फॉर्म भर रहे हैं।${
          serviceContext.errors?.length
            ? `\n⚠️ ${serviceContext.errors.length} त्रुटि मिली। नीचे से सवाल चुनें।`
            : '\n\n💬 कोई भी सवाल पूछें, या "फॉर्म भरो" कहें!'
        }`,
        source: 'system',
      }]);
    }
  }, [serviceContext?.serviceId]);

  // ── Listen for live form data updates from ApplicationForm ──────────────
  const liveFormData = useRef<Record<string, string>>({});
  const liveOcrData = useRef<Record<string, string>>({});
  useEffect(() => {
    const handler = (e: Event) => {
      const { form_data, ocr_data } = (e as CustomEvent).detail || {};
      if (form_data) liveFormData.current = form_data;
      if (ocr_data) liveOcrData.current = ocr_data;
    };
    window.addEventListener('sahayak:context-update', handler);
    return () => window.removeEventListener('sahayak:context-update', handler);
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMime = 'audio/webm;codecs=opus';
      const canUsePreferred = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(preferredMime);
      const mediaRecorder = canUsePreferred
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setRecordingTime(0);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setRecordingTime(0);
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size < 1000) {
          setMessages(prev => [...prev, {
            id: Date.now().toString(), sender: 'bot',
            text: 'रिकॉर्डिंग बहुत छोटी थी। कृपया 1-2 सेकंड साफ बोलकर दोबारा कोशिश करें।', source: 'warning'
          }]);
          return;
        }

        setIsTranscribing(true);
        try {
          const result = await api.voiceTranscribe(audioBlob);
          if (result.text.trim()) {
            setInputText(result.text);
            await handleSend(result.text, true);  // wasVoice = true -> TTS on
          } else {
            setMessages(prev => [...prev, {
              id: Date.now().toString(), sender: 'bot',
              text: 'Whisper ने ऑडियो सुना, लेकिन टेक्स्ट नहीं निकाल पाया। कृपया माइक्रोफोन के पास स्पष्ट बोलें।', source: 'warning'
            }]);
          }
        } catch (err) {
          console.error('Whisper transcription failed:', err);
          setMessages(prev => [...prev, {
            id: Date.now().toString(), sender: 'bot',
            text: '🎙️ वॉइस ट्रांसक्रिप्शन विफल। कृपया बैकएंड चालू करें।', source: 'error'
          }]);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('माइक्रोफोन की अनुमति दें।');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleSend = async (text: string = inputText, wasVoice = false) => {
    if (!text.trim()) return;
    lastInputWasVoice.current = wasVoice;
    const userMsg: ChatMessage = { id: Date.now().toString(), sender: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const formCtx = {
        service_id: serviceContext?.serviceId,
        service_name: serviceContext?.serviceName,
        errors: serviceContext?.errors || [],
        missing_docs: serviceContext?.missingDocs || [],
        form_data: liveFormData.current,    // live form state
        ocr_data: liveOcrData.current,      // OCR-extracted doc data
      };

      const response = await api.query(text, serviceContext?.serviceId || '', formCtx);

      // ── Agentic: if the bot returned form-fill actions, dispatch them ────
      const actions = response.form_actions || [];
      if (actions.length > 0) {
        window.dispatchEvent(new CustomEvent('sahayak:fill-fields', { detail: { actions } }));
      }

      const finalAnswer = (response.answer || '').trim() || 'मुझे स्पष्ट उत्तर नहीं मिला। कृपया प्रश्न थोड़ा और स्पष्ट करके पूछें।';
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: finalAnswer,
        source: response.source,
        actions: actions.length > 0 ? actions : undefined,
      };
      setMessages(prev => [...prev, botMsg]);

      // ── TTS only when the user spoke (not typed) AND speaker is on ──
      if (voiceEnabled && wasVoice && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();  // cancel any ongoing
        const utterance = new SpeechSynthesisUtterance(finalAnswer.slice(0, 280));
        utterance.lang = 'hi-IN';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), sender: 'bot',
        text: 'AI सर्वर से कनेक्ट नहीं हो पा रहा। कृपया बैकएंड चालू करें।', source: 'error'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const chips = serviceContext
    ? (QUICK_CHIPS[serviceContext.serviceId] || QUICK_CHIPS.default)
    : QUICK_CHIPS.default;

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 50,
          width: 52, height: 52, borderRadius: 6,
          background: 'var(--csc-blue)', color: 'white',
          border: '2px solid var(--csc-orange)',
          boxShadow: '0 4px 18px rgba(26,63,111,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        } as React.CSSProperties}>
        <Bot size={22} />
        {serviceContext?.errors?.length ? (
          <span style={{
            position: 'absolute', top: -6, right: -6,
            background: 'var(--csc-red)', color: 'white',
            fontSize: 10, fontWeight: 700,
            width: 18, height: 18, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{serviceContext.errors.length}</span>
        ) : null}
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', right: 24, bottom: 24, zIndex: 50,
      background: '#fff', border: '1px solid var(--csc-border)',
      borderRadius: 6, boxShadow: '0 8px 32px rgba(26,63,111,0.18)',
      display: 'flex', flexDirection: 'column',
      width: isMinimized ? 300 : 400, height: isMinimized ? 52 : 540,
      transition: 'all 0.25s ease', overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', background: 'var(--csc-blue)', color: 'white', cursor: 'pointer',
          borderBottom: '2px solid var(--csc-orange)', flexShrink: 0,
        }}
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 4, padding: 6 }}>
            <Bot size={16} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>सहायक AI</div>
            {!isMinimized && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>
                {serviceContext ? serviceContext.serviceName : 'Whisper Voice + Groq LLM'}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => setVoiceEnabled(!voiceEnabled)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', cursor: 'pointer', padding: 5 }}>
            {voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <button onClick={() => setIsMinimized(!isMinimized)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', cursor: 'pointer', padding: 5 }}>
            {isMinimized ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
          </button>
          <button onClick={() => setIsOpen(false)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', cursor: 'pointer', padding: 5 }}>
            <X size={15} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', background: 'var(--csc-bg)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {messages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', borderRadius: 5, padding: '7px 11px', fontSize: 12, lineHeight: 1.65,
                  background: msg.sender === 'user' ? 'var(--csc-blue)' : '#fff',
                  color: msg.sender === 'user' ? '#fff' : 'var(--csc-text)',
                  border: msg.sender === 'bot' ? '1px solid var(--csc-border)' : 'none',
                  borderLeft: msg.sender === 'bot' ? '3px solid var(--csc-blue-mid)' : undefined,
                }}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                  {msg.actions && msg.actions.length > 0 && (
                    <div style={{ marginTop: 5, paddingTop: 5, borderTop: '1px solid rgba(255,255,255,0.2)', display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {msg.actions.map((action, i) => (
                        <span key={i} className="badge-green ocr-badge-new" style={{ fontSize: 10 }}>
                          ⚡ {action.label || action.field}: {action.value}
                        </span>
                      ))}
                      <span style={{ fontSize: 10, color: 'var(--csc-green)', fontWeight: 700, width: '100%', marginTop: 2 }}>✅ फॉर्म में भर दिया!</span>
                    </div>
                  )}
                  {msg.source && msg.sender === 'bot' && (
                    <div style={{ fontSize: 10, marginTop: 3, color: 'var(--csc-muted)', opacity: 0.7 }}>स्रोत: {msg.source}</div>
                  )}
                </div>
              </div>
            ))}
            {(isLoading || isTranscribing) && (
              <div style={{ display: 'flex' }}>
                <div style={{ background: '#fff', border: '1px solid var(--csc-border)', borderLeft: '3px solid var(--csc-blue-mid)', borderRadius: 5, padding: '7px 11px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Loader2 size={12} color="var(--csc-blue)" style={{ animation: 'spin 0.8s linear infinite' }} />
                  <span style={{ color: 'var(--csc-muted)', fontSize: 11 }}>{isTranscribing ? '🎙️ Whisper सुन रहा है...' : 'सोच रहा हूँ...'}</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Question Chips */}
          <div style={{ padding: '5px 10px', borderTop: '1px solid var(--csc-border)', background: '#fff', overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: 5, paddingBottom: 2, minWidth: 'max-content' }}>
              {chips.map(chip => (
                <button key={chip} onClick={() => handleSend(chip)} disabled={isLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 3, background: 'var(--csc-orange-light)', color: 'var(--csc-orange)', border: '1px solid #f0c090', fontSize: 10, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <MessageSquare size={9} />
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Recording Banner */}
          {isRecording && (
            <div style={{ padding: '6px 12px', background: '#fdf0ef', borderTop: '1px solid #e8b0ac', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--csc-red)', animation: 'pulse 1s infinite' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--csc-red)' }}>रिकॉर्डिंग... {recordingTime}s</span>
              </div>
              <button onClick={stopRecording} style={{ background: 'var(--csc-red)', color: 'white', border: 'none', borderRadius: 3, padding: '4px 10px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <StopCircle size={11} /> बंद करें
              </button>
            </div>
          )}

          {/* Input Bar */}
          <div style={{ padding: '8px 10px', borderTop: '1px solid var(--csc-border)', background: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
            {isRecording ? (
              <button onClick={stopRecording} style={{ width: 34, height: 34, borderRadius: 4, background: 'var(--csc-red)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MicOff size={16} />
              </button>
            ) : (
              <button onClick={startRecording} disabled={isTranscribing}
                style={{ width: 34, height: 34, borderRadius: 4, background: isTranscribing ? 'var(--csc-orange-light)' : 'var(--csc-blue-light)', color: 'var(--csc-blue)', border: '1px solid var(--csc-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {isTranscribing ? <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Mic size={15} />}
              </button>
            )}
            <input type="text" value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={serviceContext ? `${serviceContext.serviceName} के बारे में पूछें...` : 'हिंदी में पूछें...'}
              className="csc-input" style={{ flex: 1, borderRadius: 4 }}
            />
            <button onClick={() => handleSend()} disabled={!inputText.trim() || isLoading}
              style={{ width: 34, height: 34, borderRadius: 4, background: 'var(--csc-blue)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: (!inputText.trim() || isLoading) ? 0.5 : 1 }}>
              <Send size={15} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
