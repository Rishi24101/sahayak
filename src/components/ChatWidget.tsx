import { useState, useEffect, useRef } from 'react';
import { Mic, Send, X, Bot, Volume2, VolumeX, Minimize2, Maximize2, Loader2 } from 'lucide-react';
import { api } from '../utils/api';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  source?: string;
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'bot', text: 'नमस्ते! मैं सहायक हूँ। योजनाओं, दस्तावेज़ों, या फॉर्म के बारे में पूछें। 🙏\n\n🎙️ माइक बटन दबाकर हिंदी में बोलें — Groq Whisper AI सुनेगा!', source: 'system' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        if (audioBlob.size < 1000) return; // Too short

        setIsTranscribing(true);
        try {
          const result = await api.voiceTranscribe(audioBlob);
          if (result.text.trim()) {
            setInputText(result.text);
            handleSend(result.text);
          }
        } catch (err) {
          console.error('Whisper transcription failed:', err);
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            sender: 'bot',
            text: '🎙️ वॉइस ट्रांसक्रिप्शन विफल। कृपया बैकएंड चालू करें।',
            source: 'error'
          }]);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('माइक्रोफोन की अनुमति दें।');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSend = async (text: string = inputText) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), sender: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await api.query(text);
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: response.answer,
        source: response.source
      };
      setMessages(prev => [...prev, botMsg]);

      if (voiceEnabled && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(response.answer);
        utterance.lang = 'hi-IN';
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: 'AI सर्वर से कनेक्ट नहीं हो पा रहा। कृपया बैकएंड चालू करें।',
        source: 'error'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-blue-500/25 transition-all hover:scale-105 z-50 flex items-center gap-2">
        <Bot className="w-6 h-6" />
        <span className="font-medium pr-1 hidden md:block">सहायक से पूछें</span>
      </button>
    );
  }

  return (
    <div className={`fixed right-6 bottom-6 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 flex flex-col transition-all duration-300 ease-in-out ${
      isMinimized ? 'h-14 w-80' : 'h-[520px] w-[400px]'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-2xl cursor-pointer" 
        onClick={() => setIsMinimized(!isMinimized)}>
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl"><Bot className="w-5 h-5" /></div>
          <div>
            <h3 className="font-semibold text-sm">सहायक AI</h3>
            {!isMinimized && <p className="text-xs text-blue-100">Whisper Voice + Groq LLM</p>}
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
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-sm'
                    : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'
                }`}>
                  <div className="whitespace-pre-wrap">{msg.text}</div>
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

          <div className="p-3 border-t bg-white rounded-b-2xl flex items-center gap-2">
            <button onClick={toggleRecording}
              className={`p-2.5 rounded-full transition-all flex-shrink-0 ${
                isRecording ? 'bg-red-500 text-white animate-pulse scale-110 shadow-lg shadow-red-500/25' 
                : isTranscribing ? 'bg-amber-100 text-amber-600'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              disabled={isTranscribing}
              title={isRecording ? 'रिकॉर्डिंग बंद करें' : 'Whisper से बोलें'}>
              {isTranscribing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
            </button>
            <input type="text" value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="हिंदी में पूछें..."
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
