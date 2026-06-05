import React, { useState, useEffect } from 'react';

export default function AnalysisResult({ data, onBack }) {
  const [translation, setTranslation] = useState('Đang phân tích...');
  const [activeHost, setActiveHost] = useState('https://tienhiep.lyvuha.com');

  useEffect(() => {
    const getHostAndTranslate = async () => {
      let host = 'https://tienhiep.lyvuha.com';
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const stored = await new Promise((resolve) => {
          chrome.storage.local.get(['settings'], (result) => {
            resolve(result.settings);
          });
        });
        if (stored && stored.apiHost) {
          host = stored.apiHost.replace(/\/$/, '');
        }
      }
      
      const candidates = [
        host,
        'https://tienhiep.lyvuha.com'
      ];
      
      let workingHost = null;
      for (const candidate of candidates) {
        try {
          const res = await fetch(`${candidate}/api/stats`);
          if (res.ok) {
            workingHost = candidate;
            break;
          }
        } catch (e) {}
      }
      
      if (!workingHost) {
        workingHost = candidates[0]; // fallback
      }
      
      setActiveHost(workingHost);
      
      if (data && data.title) {
        try {
          const res = await fetch(`${workingHost}/translate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texts: [data.title] })
          });
          const resData = await res.json();
          if (resData.translations && resData.translations.length > 0) {
            setTranslation(resData.translations[0]);
          }
        } catch (err) {
          setTranslation('Không thể dịch tựa đề');
        }
      }
    };

    getHostAndTranslate();
  }, [data]);


  return (
    <div className="flex flex-col gap-4">
      {/* Back Button */}
      <button 
        onClick={onBack}
        className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors self-start text-label-md font-label-md font-semibold"
      >
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Quay lại
      </button>

      {/* Top: Selected Sentence */}
      <section className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col gap-2">
        <div className="flex justify-between items-start">
          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-label-sm font-label-sm uppercase tracking-wider">Tựa đề trang web</span>
          <button className="text-outline hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[18px]">volume_up</span>
          </button>
        </div>
        <p className="text-headline-sm font-headline-sm text-on-surface mb-1">{data?.title || 'Không có tựa đề'}</p>
        <p className="text-body-md font-body-md text-on-surface-variant">{translation}</p>
      </section>

      {/* Middle: AI Breakdown */}
      <section className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="bg-surface-container-low px-4 py-2 border-b border-slate-100 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[18px]">psychology</span>
          <h2 className="text-label-md font-label-md font-bold text-on-surface">Kết quả dịch trang</h2>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <div className="mt-2 p-3 bg-surface rounded border border-slate-100">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
              <span className="text-label-sm font-bold text-secondary uppercase">Trạng thái</span>
            </div>
            <p className="text-body-sm text-on-surface-variant">
              Toàn bộ nội dung chữ Hán trên trang <strong>{data?.url}</strong> đã được dịch và lấp đè thành công bằng TreeWalker Algorithm. Mọi định dạng HTML đều được giữ nguyên.
            </p>
          </div>
        </div>
      </section>

      {/* Bottom: Save to Flashcard */}
      <section className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col gap-4">
        <h2 className="text-label-md font-label-md font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">style</span>
          Lưu tựa đề vào Thẻ Nhớ
        </h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-label-sm font-label-sm text-on-surface-variant mb-1">Mặt trước (Original)</label>
            <input 
              className="w-full border border-slate-200 rounded px-2 py-1.5 text-body-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow bg-slate-50" 
              type="text" 
              defaultValue={data?.title || ''} 
            />
          </div>
          <div>
            <label className="block text-label-sm font-label-sm text-on-surface-variant mb-1">Mặt sau (Translation)</label>
            <textarea 
              className="w-full border border-slate-200 rounded px-2 py-1.5 text-body-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow bg-slate-50 resize-none" 
              rows="3"
              defaultValue={translation}
            ></textarea>
          </div>
        </div>
        <button className="w-full h-9 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded font-label-md text-label-md flex items-center justify-center gap-2 transition-colors mt-2 active:scale-95 duration-100">
          <span className="material-symbols-outlined text-[18px]">upload</span>
          Xuất sang Anki
        </button>
      </section>
    </div>
  );
}
