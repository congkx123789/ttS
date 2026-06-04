import React from 'react';

export default function URLInputSection() {
  return (
    <section className="space-y-3">
      <div className="relative">
        <input 
          className="w-full h-10 px-4 pr-10 rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-body-md font-body-md transition-all" 
          placeholder="Nhập URL trang web..." 
          type="text" 
        />
        <span className="absolute right-3 top-2.5 material-symbols-outlined text-outline text-[20px]" data-icon="link">link</span>
      </div>
      <button className="w-full h-10 bg-primary text-on-primary font-headline-xs text-headline-xs rounded-lg shadow-sm hover:bg-primary-container transition-all active:scale-[0.98] flex items-center justify-center gap-2">
        <span className="material-symbols-outlined" data-icon="translate">translate</span>
        Dịch ngay
      </button>
    </section>
  );
}
