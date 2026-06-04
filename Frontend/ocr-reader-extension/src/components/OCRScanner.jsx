import React from 'react';

export default function OCRScanner() {
  return (
    <div className="relative w-full h-[240px] rounded-lg border border-outline-variant overflow-hidden bg-surface-container-lowest shadow-inner group">
      {/* Scanned Document Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-70 filter blur-[0.5px] scale-105" 
        style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBR1TgTGOANi1WN8R0Exc9H32rPZNbS9EFl157Hu5H7i7OPpsil0VH2KtNaoQWVccIvrj-l-AlMSnRTSGLgOQ1fiGqEU-uKcuX5f5ahtAyGoKaw7FH6g5MAwY86h25BBiHsGD33eAG02kh27Xj6qYNY7jP5dnCZmsuiDf70f2EcK6PFdf9zUlbACipzu-aoLEupb3ncha8tg0V0hess7bGS0wp9IJVBbKgOx--XBR3XP9zNb-8wbG5rqguic6jI2hYolqSsM6wpWjo')" }}
      >
      </div>
      
      {/* Scanning Line */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-primary shadow-[0_0_12px_theme(colors.primary)] animate-scan z-10 flex justify-center">
        <div className="w-1/2 h-[1px] bg-white opacity-50 mt-[0.5px]"></div>
      </div>
      
      {/* OCR Active Badge */}
      <div className="absolute top-3 right-3 bg-surface/90 backdrop-blur-sm border border-primary-fixed-dim px-2 py-1 rounded-DEFAULT shadow-sm z-20 flex items-center gap-1.5 animate-pulse-slow">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
        <span className="w-1.5 h-1.5 rounded-full bg-primary absolute"></span>
        <span className="text-label-sm font-label-sm text-primary uppercase tracking-wider">OCR Active</span>
      </div>
      
      {/* Extracted Text Overlay (Glassmorphism) */}
      <div className="absolute bottom-0 left-0 w-full p-3 bg-gradient-to-t from-surface via-surface/90 to-transparent pt-12 z-10">
        <div className="bg-surface-container-lowest/80 backdrop-blur-md border border-outline-variant rounded-DEFAULT p-2 shadow-sm">
          <p className="text-body-sm font-body-sm text-on-surface line-clamp-2 leading-relaxed">
            <span className="bg-primary-fixed text-on-primary-fixed px-1 rounded-sm">Anti-scraping</span> mechanisms detected. Proceeding with deep optical character recognition to extract semantic data...
          </p>
        </div>
      </div>
    </div>
  );
}
