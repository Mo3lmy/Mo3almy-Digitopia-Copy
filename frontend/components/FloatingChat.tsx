'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import useAuthStore from '@/stores/useAuthStore';

interface ChatMessage {
  sender: 'user' | 'assistant';
  message: string;
  timestamp: Date;
}

export default function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const ws = useWebSocket();
  const { user } = useAuthStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // تحميل المحادثات المحفوظة
  useEffect(() => {
    const saved = localStorage.getItem('chatHistory');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMessages(parsed);
      } catch (e) {
        console.error('Error loading chat history');
      }
    }
  }, []);

  // حفظ المحادثات
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('chatHistory', JSON.stringify(messages.slice(-20))); // آخر 20 رسالة فقط
    }
  }, [messages]);

  // استمع للردود
  useEffect(() => {
    ws.on('chat_response', (data: any) => {
      setMessages(prev => [...prev, {
        sender: 'assistant',
        message: data.message,
        timestamp: new Date()
      }]);
      setIsTyping(false);
    });

    return () => {
      ws.off('chat_response');
    };
  }, [ws]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;

    // أضف رسالة المستخدم
    setMessages(prev => [...prev, {
      sender: 'user',
      message: input,
      timestamp: new Date()
    }]);

    // أرسل للـ backend
    ws.emit('chat_message', {
      message: input
    });

    setInput('');
    setIsTyping(true);
  };

  // رسالة ترحيب
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        sender: 'assistant',
        message: `مرحباً ${user?.firstName || ''} 👋\nكيف يمكنني مساعدتك اليوم؟`,
        timestamp: new Date()
      }]);
    }
  }, [isOpen, user]);

  // الزر العائم
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 bg-primary-600 text-white rounded-full p-4 shadow-lg hover:bg-primary-700 transition-all"
        aria-label="فتح الشات"
      >
        <MessageCircle size={24} />
      </button>
    );
  }

  // نافذة الشات
  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 h-[500px] bg-white rounded-lg shadow-2xl flex flex-col">
      {/* Header */}
      <div className="bg-primary-600 text-white p-4 rounded-t-lg flex justify-between items-center">
        <span className="font-bold">مساعدك الذكي</span>
        <button onClick={() => setIsOpen(false)} className="hover:opacity-80">
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`p-3 rounded-lg ${
              msg.sender === 'user'
                ? 'bg-primary-100 ml-8 text-right'
                : 'bg-gray-100 mr-8 text-right'
            }`}
          >
            {msg.message}
          </div>
        ))}

        {isTyping && (
          <div className="bg-gray-100 p-3 rounded-lg mr-8">
            <span className="inline-block animate-pulse">يكتب...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="اكتب رسالتك..."
          className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          dir="rtl"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim()}
          className="bg-primary-600 text-white p-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}