import React, { useState, useRef, useEffect } from 'react';
import { NeoCard } from '../components/ui/NeoCard';
import { NeoButton } from '../components/ui/NeoButton';
import { getAiResponse } from '../services/aiService';
import { ChatMessage, UserStats } from '../types';
import { Send, Bot, User, AlertCircle, RefreshCw, XCircle, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';

interface AiAssistantProps {
  userStats?: UserStats;
}

const SUGGESTED_QUESTIONS = [
  "How do I start composting? 🍌",
  "Reduce plastic usage 🛍️",
  "Energy saving hacks 💡",
  "What is a carbon footprint? 👣"
];

export const AiAssistant: React.FC<AiAssistantProps> = ({ userStats }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
      id: '0', 
      role: 'model', 
      text: '### Hey there! 👋\nI\'m your **Sustainability Consultant**. \n\nReady to save the planet (and maybe some money)? Ask me anything!', 
      timestamp: new Date() 
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages, loading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim() || loading) return;

    setInput('');
    setError(null);
    setLoading(true);

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: textToSend, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);

    try {
      // Prepare history for API
      const history = messages.map(m => ({ role: m.role, text: m.text }));
      
      // Pass userStats to the service
      const responseText = await getAiResponse(history, userMsg.text, userStats);
      
      const botMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: responseText, timestamp: new Date() };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error("Failed to get response:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      // Enhance error visibility in chat
      const errorMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        text: `**System Error:** ${err instanceof Error ? err.message : "Service unavailable."}`, 
        timestamp: new Date() 
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      // Keep input focused for rapid chatting
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const clearChat = () => {
    setMessages([
      { 
        id: Date.now().toString(), 
        role: 'model', 
        text: '### Chat Cleared! ✨\nFresh start. What\'s on your mind now?', 
        timestamp: new Date() 
      }
    ]);
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col max-w-5xl mx-auto pb-6 px-4 md:px-0 font-sans">
      <div className="flex-none mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black flex items-center gap-3 text-gray-900 tracking-tight">
            <motion.div 
              whileHover={{ scale: 1.1, rotate: 10 }}
              whileTap={{ scale: 0.9 }}
              className="p-3 bg-neo-green rounded-xl border-4 border-black shadow-neo-sm cursor-pointer"
            >
              <Bot className="text-black" size={32} />
            </motion.div>
            AI Consultant
          </h2>
          <p className="text-lg text-gray-700 font-medium ml-1 mt-2 flex items-center gap-2">
            Your witty guide to saving the world. <Sparkles size={16} className="text-neo-yellow animate-pulse" />
          </p>
        </div>
        <NeoButton onClick={clearChat} size="sm" variant="secondary" className="hidden md:flex items-center gap-2">
          <RefreshCw size={16} /> Reset
        </NeoButton>
      </div>

      <NeoCard className="flex-1 flex flex-col overflow-hidden !p-0 bg-white border-4 relative">
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50 scrollbar-thin scrollbar-thumb-gray-900 scrollbar-track-transparent">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div 
                key={msg.id} 
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start gap-3 max-w-[90%] md:max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  
                  {/* Avatar */}
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`w-10 h-10 rounded-xl border-2 border-black flex items-center justify-center flex-shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-neo-yellow' : 'bg-neo-green'}`}
                  >
                    {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                  </motion.div>

                  {/* Message Bubble */}
                  <div className={`
                    p-4 rounded-2xl border-2 border-black shadow-neo-sm text-sm md:text-base leading-relaxed
                    ${msg.role === 'user' 
                      ? 'bg-neo-blue text-white rounded-tr-none' 
                      : 'bg-white text-gray-900 rounded-tl-none'
                    }
                  `}>
                    {msg.role === 'user' ? (
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                    ) : (
                      <div className="markdown-content">
                         <ReactMarkdown
                          components={{
                            h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-2 mt-4 border-b-2 border-gray-200 pb-1" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-lg font-bold mb-2 mt-3" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-base font-bold mb-1 mt-2" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
                            li: ({node, ...props}) => <li className="mb-1" {...props} />,
                            p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-bold text-black" {...props} />,
                            a: ({node, ...props}) => <a className="text-blue-600 hover:underline font-medium" target="_blank" rel="noopener noreferrer" {...props} />,
                            blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-neo-green pl-4 italic my-2 text-gray-600 bg-gray-50 py-1" {...props} />,
                            code: ({node, ...props}) => <code className="bg-gray-200 px-1 py-0.5 rounded text-sm font-mono text-pink-600" {...props} />,
                          }}
                        >
                          {msg.text}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {loading && (
             <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className="flex justify-start"
             >
               <div className="flex items-start gap-3">
                 <div className="w-10 h-10 rounded-xl border-2 border-black flex items-center justify-center flex-shrink-0 bg-neo-green shadow-sm">
                    <Bot size={20} />
                 </div>
                 <div className="bg-white p-4 rounded-2xl rounded-tl-none border-2 border-black shadow-neo-sm">
                   <div className="flex items-center gap-2">
                     <span className="text-sm font-bold text-gray-500">Thinking...</span>
                     <motion.div 
                       animate={{ y: [0, -5, 0] }} 
                       transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                       className="w-2 h-2 bg-neo-green rounded-full"
                     />
                     <motion.div 
                       animate={{ y: [0, -5, 0] }} 
                       transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                       className="w-2 h-2 bg-neo-blue rounded-full"
                     />
                     <motion.div 
                       animate={{ y: [0, -5, 0] }} 
                       transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                       className="w-2 h-2 bg-neo-pink rounded-full"
                     />
                   </div>
                 </div>
               </div>
             </motion.div>
          )}
          
          {error && !loading && (
            <div className="flex justify-center my-4">
              <div className="flex items-center gap-2 bg-red-50 border-2 border-red-500 text-red-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm">
                <AlertCircle size={16} />
                <span>Error connecting to AI service.</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Questions */}
        {!loading && messages.length < 4 && (
          <div className="px-6 pb-2 bg-white flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <motion.button
                key={i}
                whileHover={{ scale: 1.05, backgroundColor: '#FEF08A' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSend(q)}
                className="text-xs md:text-sm font-bold px-3 py-1.5 rounded-full border-2 border-black bg-gray-100 hover:bg-neo-yellow transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                {q}
              </motion.button>
            ))}
          </div>
        )}

        <div className="p-4 border-t-4 border-black bg-white">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask away! (e.g. 'How to recycle glass?')"
              className="flex-1 border-2 border-black rounded-xl px-5 py-3 focus:outline-none focus:ring-4 focus:ring-neo-green/30 font-medium text-lg placeholder:text-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
              disabled={loading}
            />
            <NeoButton 
              onClick={() => handleSend()} 
              disabled={loading || !input.trim()} 
              size="lg"
              className={`transition-all ${!input.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
            >
              <Send size={24} />
            </NeoButton>
          </div>
          <div className="text-xs text-gray-400 mt-2 text-center font-medium flex justify-center items-center gap-1">
             AI can make mistakes. Verify important info. 
             {messages.length > 2 && <button onClick={clearChat} className="text-red-400 hover:text-red-600 underline ml-1">Clear Chat</button>}
          </div>
        </div>
      </NeoCard>
    </div>
  );
};