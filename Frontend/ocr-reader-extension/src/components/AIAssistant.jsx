import React, { useState, useEffect, useRef } from 'react';

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    {
      role: 'model',
      text: 'Chào bạn! Tôi là Trợ lý AI đồng hành đọc truyện. Tôi có thể giúp bạn dịch thuật nâng cao, tóm tắt chương truyện, giải thích các điển tích phức tạp hoặc sửa lỗi văn bản. Bạn cần hỗ trợ gì hôm nay? 📚'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [serverUrl, setServerUrl] = useState('https://tienhiep.lyvuha.com');
  const [settings, setSettings] = useState({
    aiModel: 'gemini-1.5-flash',
    aiKey: '',
    aiPrompt: 'Dịch đoạn văn bản tiếng Trung sau sang tiếng Việt mượt mà, văn phong truyện convert hay, giữ nguyên tên riêng Hán Việt.',
    membershipType: 'standard',
    vipKey: ''
  });

  const textareaRef = useRef(null);
  const chatEndRef = useRef(null);

  // Load AI configuration & server settings from chrome storage
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['settings', 'serverUrl'], (result) => {
        const loadedSettings = {};
        if (result.settings) Object.assign(loadedSettings, result.settings);
        if (result.serverUrl) setServerUrl(result.serverUrl);
        
        setSettings(prev => ({
          ...prev,
          ...loadedSettings
        }));
      });
    }
  }, []);

  // Auto scroll to chat bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  };

  const handleSend = async () => {
    const textToSend = inputText.trim();
    if (!textToSend || isSending) return;

    const isVip = settings.membershipType === 'vip';

    // Standard user MUST provide their own API Key
    if (!isVip && !settings.aiKey) {
      alert("Tài khoản Standard yêu cầu API Key cá nhân để sử dụng. Vui lòng bấm vào 'Cấu hình API Key' để tự cấu hình API Key của bạn!");
      return;
    }

    // Add user message to UI
    const newUserMessage = { role: 'user', text: textToSend };
    const conversationHistory = messages.concat(newUserMessage);
    
    setMessages(prev => [...prev, newUserMessage]);
    setInputText('');
    setIsSending(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      let responseText = "";

      // Case 1: VIP user without a personal API Key (Use server proxy trọn gói)
      if (isVip && !settings.aiKey) {
        const res = await fetch(`${serverUrl}/api/ai/chat`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-VIP-Key': settings.vipKey || ""
          },
          body: JSON.stringify({
            messages: conversationHistory,
            model: settings.aiModel,
            prompt: settings.aiPrompt,
            vip_key: settings.vipKey || ""
          }),
          credentials: 'include'
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `HTTP error ${res.status}`);
        }
        responseText = data.text || "Không nhận được phản hồi từ AI.";
      } 
      // Case 2: Standard user (or VIP user with personal key) -> Direct client-side API call
      else {
        if (settings.aiModel.startsWith('gemini')) {
          // Gemini API payload
          const geminiHistory = conversationHistory.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
          }));

          const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.aiModel}:generateContent?key=${settings.aiKey}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: geminiHistory,
              systemInstruction: {
                parts: [{ text: settings.aiPrompt }]
              }
            })
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData?.error?.message || `HTTP error ${res.status}`);
          }

          const data = await res.json();
          responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Không nhận được phản hồi từ AI.";
        } else {
          // OpenAI model (GPT-4o, etc.)
          const openAIHistory = conversationHistory.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.text
          }));

          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${settings.aiKey}`
            },
            body: JSON.stringify({
              model: settings.aiModel,
              messages: [
                { role: 'system', content: settings.aiPrompt },
                ...openAIHistory
              ]
            })
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData?.error?.message || `HTTP error ${res.status}`);
          }

          const data = await res.json();
          responseText = data.choices?.[0]?.message?.content || "Không nhận được phản hồi từ AI.";
        }
      }

      setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    } catch (error) {
      console.error("AI API Error:", error);
      setMessages(prev => [...prev, { 
        role: 'model', 
        text: `⚠️ Lỗi kết nối AI: ${error.message}. Vui lòng kiểm tra lại API Key hoặc cấu hình proxy trên Server.` 
      }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isVip = settings.membershipType === 'vip';

  return (
    <div className="flex flex-col h-full bg-surface-container-lowest overflow-hidden">
      
      {/* Header Info */}
      <div className="px-4 py-2 bg-surface-container-low border-b border-outline-variant flex items-center justify-between text-[11px] text-on-surface-variant shrink-0 select-none">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isVip ? 'bg-yellow-500' : 'bg-green-500'}`}></span>
          <span>Đang sử dụng: <strong>{settings.aiModel}</strong></span>
          <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded border uppercase ${isVip ? 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' : 'bg-outline-variant/30 text-on-surface-variant border-outline-variant'}`}>
            {isVip ? 'VIP trọn gói' : 'Standard'}
          </span>
        </div>
        <button 
          onClick={() => {
            if (typeof chrome !== 'undefined' && chrome.runtime.openOptionsPage) {
              chrome.runtime.openOptionsPage();
            } else {
              alert("Hãy mở Dashboard của Extension để cấu hình API Key.");
            }
          }}
          className="text-primary font-bold hover:underline"
        >
          Cấu hình API Key
        </button>
      </div>

      {/* Warning banner for Standard users without API Key */}
      {!isVip && !settings.aiKey && (
        <div className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-2 flex items-center gap-2 select-none text-[10px] text-orange-800 leading-normal shrink-0">
          <span className="material-symbols-outlined text-[15px] text-orange-600">info</span>
          <span>
            💡 <strong>Tài khoản Standard:</strong> Bạn cần cấu hình API Key cá nhân (Gemini/OpenAI) để trò chuyện. Bấm <strong>Cấu hình API Key</strong> ở trên để nhập.
          </span>
        </div>
      )}

      {/* VIP trọn gói hint when using system proxy */}
      {isVip && !settings.aiKey && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 flex items-center gap-2 select-none text-[10px] text-yellow-800 leading-normal shrink-0">
          <span className="material-symbols-outlined text-[15px] text-yellow-600" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
          <span>
            👑 <strong>Quyền lợi VIP:</strong> Bạn đang sử dụng API Key hệ thống (trọn gói miễn phí) từ máy chủ của chúng tôi.
          </span>
        </div>
      )}

      {/* Chat History Area */}
      <section className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div 
              key={index}
              className={`flex items-start gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${isUser ? 'bg-primary text-white' : 'bg-secondary-container text-white'}`}>
                <span className="material-symbols-outlined text-[16px]">
                  {isUser ? 'person' : 'smart_toy'}
                </span>
              </div>
              <div className={`p-3 rounded-xl border leading-relaxed text-xs ${
                isUser 
                  ? 'bg-primary text-white border-primary/20 rounded-tr-none shadow-sm' 
                  : 'bg-surface border-outline-variant text-on-surface rounded-tl-none'
              }`}>
                <p className="whitespace-pre-line">{msg.text}</p>
              </div>
            </div>
          );
        })}

        {/* AI Typing Indicator */}
        {isSending && (
          <div className="flex items-start gap-3 max-w-[85%]">
            <div className="w-8 h-8 rounded-full bg-secondary-container text-white flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
            </div>
            <div className="bg-surface border border-outline-variant text-on-surface p-3 rounded-xl rounded-tl-none flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </section>

      {/* Input Section */}
      <section className="bg-surface border-t border-outline-variant p-3 space-y-3 z-20 shrink-0 pb-[76px]">
        {/* Prompt Chips for Quick Suggestion */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
          {[
            "Dịch đoạn văn bản này",
            "Giải thích điển tích",
            "Tóm tắt chương truyện",
            "Tìm từ đồng nghĩa Hán Việt"
          ].map((chip, idx) => (
            <button 
              key={idx}
              onClick={() => {
                setInputText(prev => prev ? `${prev}\n- ${chip}: ` : `${chip}: `);
                textareaRef.current?.focus();
              }}
              className="whitespace-nowrap px-3 py-1 rounded-full border border-outline-variant bg-white text-[10px] font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer"
            >
              {chip}
            </button>
          ))}
        </div>
        
        {/* Chat Input */}
        <div className="relative flex items-center">
          <textarea 
            ref={textareaRef}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full bg-white border border-outline-variant rounded-xl py-2.5 pl-4 pr-12 text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none transition-all custom-scrollbar h-9" 
            placeholder="Nhập câu hỏi hoặc dán văn bản dịch tại đây..." 
            rows={1}
            style={{ maxHeight: '120px' }}
          ></textarea>
          <button 
            onClick={handleSend}
            disabled={isSending || !inputText.trim()}
            className="absolute right-2 w-8 h-8 flex items-center justify-center bg-primary text-white rounded-lg active:scale-95 transition-transform disabled:opacity-40 disabled:scale-100 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">send</span>
          </button>
        </div>
      </section>
    </div>
  );
}
