import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, X, Bot, Volume2, VolumeX, Minimize2, Maximize2, Loader2, Zap, StopCircle, MessageSquare } from 'lucide-react';
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
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
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
        if (audioBlob.size < 1000) return;

        setIsTranscribing(true);
        try {
          const result = await api.voiceTranscribe(audioBlob);
          if (result.text.trim()) {
            setInputText(result.text);
            handleSend(result.text, true);  // wasVoice = true → TTS on
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

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: response.answer,
        source: response.source,
        actions: actions.length > 0 ? actions : undefined,
      };
      setMessages(prev => [...prev, botMsg]);

      // ── TTS only when the user spoke (not typed) AND speaker is on ──
      if (voiceEnabled && wasVoice && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();  // cancel any ongoing
        const utterance = new SpeechSynthesisUtterance(response.answer.slice(0, 280));
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
        className="fixed bottom-6 right-6 p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-blue-500/25 transition-all hover:scale-105 z-50 flex items-center gap-2">
        <Bot className="w-6 h-6" />
        <span className="font-medium pr-1 hidden md:block">
          {serviceContext ? `${serviceContext.serviceName} सहायक` : 'सहायक से पूछें'}
        </span>
        {serviceContext?.errors?.length ? (
          <span className="bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {serviceContext.errors.length}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <div className={`fixed right-6 bottom-6 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 flex flex-col transition-all duration-300 ease-in-out ${
      isMinimized ? 'h-14 w-80' : 'h-[560px] w-[420px]'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-2xl cursor-pointer" 
        onClick={() => setIsMinimized(!isMinimized)}>
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl"><Bot className="w-5 h-5" /></div>
          <div>
            <h3 className="font-semibold text-sm">सहायक AI</h3>
            {!isMinimized && (
              <p className="text-xs text-blue-100">
                {serviceContext ? serviceContext.serviceName : 'Whisper Voice + Groq LLM'}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => setVoiceEnabled(!voiceEnabled)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-sm'
                    : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'
                }`}>
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                  {/* Agentic action badges */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                      {msg.actions.map((action, i) => (
                        <span key={i} className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 text-xs px-2 py-0.5 rounded-full">
                          <Zap className="w-2.5 h-2.5" />
                          {action.label || action.field}: {action.value}
                        </span>
                      ))}
                      <span className="text-xs text-green-600 font-medium w-full mt-0.5">✅ फॉर्म में भर दिया!</span>
                    </div>
                  )}
                  {msg.source && msg.sender === 'bot' && (
                    <div className="text-xs mt-1.5 opacity-60">स्रोत: {msg.source}</div>
                  )}
                </div>
              </div>
            ))}
            {(isLoading || isTranscribing) && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm p-3 text-sm shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  <span className="text-slate-400 text-xs">
                    {isTranscribing ? '🎙️ Whisper सुन रहा है...' : 'सोच रहा हूँ...'}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Question Chips */}
          <div className="px-3 py-2 border-t bg-white overflow-x-auto">
            <div className="flex gap-2 pb-1" style={{ minWidth: 'max-content' }}>
              {chips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleSend(chip)}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full hover:bg-blue-100 whitespace-nowrap transition-colors disabled:opacity-50 border border-blue-100"
                >
                  <MessageSquare className="w-3 h-3" />
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Recording Banner */}
          {isRecording && (
            <div className="px-4 py-2 bg-red-50 border-t border-red-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-red-700">रिकॉर्डिंग... {recordingTime}s</span>
              </div>
              <button onClick={stopRecording}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors">
                <StopCircle className="w-3 h-3" />
                बंद करें
              </button>
            </div>
          )}

          <div className="p-3 border-t bg-white rounded-b-2xl flex items-center gap-2">
            {isRecording ? (
              <button onClick={stopRecording}
                className="p-2.5 rounded-full bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/25 flex-shrink-0 transition-all"
                title="रिकॉर्डिंग बंद करें">
                <MicOff className="w-5 h-5" />
              </button>
            ) : (
              <button onClick={startRecording}
                className={`p-2.5 rounded-full flex-shrink-0 transition-all ${
                  isTranscribing ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-600'
                }`}
                disabled={isTranscribing}
                title="Whisper से बोलें">
                {isTranscribing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
              </button>
            )}
            <input type="text" value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={serviceContext ? `${serviceContext.serviceName} के बारे में पूछें...` : 'हिंदी में पूछें...'}
              className="flex-1 bg-slate-100 px-4 py-2.5 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button onClick={() => handleSend()} disabled={!inputText.trim() || isLoading}
              className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-full disabled:opacity-50 hover:shadow-lg transition-all flex-shrink-0">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
