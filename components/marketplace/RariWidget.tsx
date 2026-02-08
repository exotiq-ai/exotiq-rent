'use client';

import { useState } from 'react';
import { Mic, X, Send, Sparkles } from 'lucide-react';
import { PageType } from './data';
import { Logo } from './shared';

interface RariMessage {
  role: 'user' | 'rari';
  text: string;
}

export default function RariWidget({
  isOpen,
  onToggle,
  navigate,
}: {
  isOpen: boolean;
  onToggle: () => void;
  navigate: (page: PageType, vehicleId?: number) => void;
}) {
  const [messages, setMessages] = useState<RariMessage[]>([
    { role: 'rari', text: "Hey, I'm Rari — your AI concierge. What kind of ride are you looking for?" },
  ]);
  const [input, setInput] = useState('');

  const cannedResponses = [
    "Supercar for a weekend",
    "Best car under $800/day",
    "What's available in Miami?",
  ];

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    const userMsg = text.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');

    // Show typing indicator
    setMessages(prev => [...prev, { role: 'rari', text: '__TYPING__' }]);

    setTimeout(() => {
      let reply = '';
      if (userMsg.toLowerCase().includes('miami')) {
        reply = "I found 8 exotic cars available in Miami! The Ferrari 296 GTB is our top pick at $1,299/day. Want me to show you the full selection?";
      } else if (userMsg.toLowerCase().includes('supercar') || userMsg.toLowerCase().includes('weekend')) {
        reply = "Great choice! I've got 12 supercars available this weekend. The McLaren 750S Spider is the most popular — $1,199/day with AI-optimized pricing. Shall I book it?";
      } else if (userMsg.toLowerCase().includes('under') || userMsg.toLowerCase().includes('budget')) {
        reply = "For under $800/day, I recommend the Mercedes-AMG GT 63 at $599/day or the Bentley Continental GT at $799/day. Both are incredible drives. Want details?";
      } else {
        reply = "I can help with that! Let me search our curated fleet across 25+ cities. Any preference on vehicle type or dates?";
      }
      // Replace typing indicator with actual reply
      setMessages(prev => prev.map((m, i) => i === prev.length - 1 && m.text === '__TYPING__' ? { ...m, text: reply } : m));
    }, 1200);
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed bottom-24 right-6 sm:bottom-6 z-50 flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-all duration-300 hover:scale-105"
          style={{
            backgroundColor: '#6EC1E4',
            boxShadow: '0 4px 24px rgba(110, 193, 228, 0.4)',
          }}
        >
          <Mic size={22} color="#0B0B0F" />
          {/* Pulse animation */}
          <span
            className="absolute inset-0 rounded-full animate-ping pointer-events-none"
            style={{ backgroundColor: 'rgba(110, 193, 228, 0.3)', animationDuration: '2s' }}
          />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[380px] max-h-[480px] sm:max-h-[560px] rounded-2xl overflow-hidden flex flex-col shadow-2xl"
          style={{
            backgroundColor: 'rgba(17, 17, 24, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(110, 193, 228, 0.2)',
            boxShadow: '0 8px 48px rgba(0,0,0,0.5), 0 0 48px rgba(110, 193, 228, 0.08)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid rgba(110, 193, 228, 0.1)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(110, 193, 228, 0.15)' }}
              >
                <Sparkles size={16} color="#6EC1E4" />
              </div>
              <div>
                <p className="text-sm font-semibold font-mont" style={{ color: '#F0F0F5' }}>Rari</p>
                <p className="text-[10px]" style={{ color: '#6EC1E4' }}>AI Concierge · Online</p>
              </div>
            </div>
            <button
              onClick={onToggle}
              className="p-1.5 rounded-full transition-colors hover:bg-white/5"
            >
              <X size={16} color="#8888A0" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[280px] max-h-[360px]">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                  style={
                    msg.role === 'user'
                      ? { backgroundColor: '#6EC1E4', color: '#0B0B0F' }
                      : { backgroundColor: 'rgba(255,255,255,0.06)', color: '#F0F0F5' }
                  }
                >
                  {msg.text === '__TYPING__' ? (
                    <span className="flex items-center gap-1.5 py-1 px-1">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </span>
                  ) : msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Replies */}
          {messages.length <= 2 && (
            <div className="px-4 pb-2 flex flex-wrap gap-2">
              {cannedResponses.map((r, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(r)}
                  className="text-xs px-3 py-1.5 rounded-full transition-all duration-200 hover:bg-[rgba(110,193,228,0.2)]"
                  style={{
                    border: '1px solid rgba(110, 193, 228, 0.25)',
                    color: '#6EC1E4',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div
            className="px-4 py-3 flex items-center gap-2"
            style={{ borderTop: '1px solid rgba(110, 193, 228, 0.1)' }}
          >
            <button
              className="p-2 rounded-full transition-colors hover:bg-[rgba(110,193,228,0.1)]"
            >
              <Mic size={18} color="#6EC1E4" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
              placeholder="Ask Rari anything..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#555570]"
              style={{ color: '#F0F0F5' }}
            />
            <button
              onClick={() => handleSend(input)}
              className="p-2 rounded-full transition-all duration-200 hover:bg-[rgba(110,193,228,0.15)]"
              style={{ backgroundColor: input.trim() ? '#6EC1E4' : 'transparent' }}
            >
              <Send size={16} color={input.trim() ? '#0B0B0F' : '#555570'} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
