import React from 'react';

export default function ChapterList({ onBack }) {
  return (
    <div className="absolute inset-0 z-50 bg-surface text-on-surface flex flex-col overflow-hidden">
      
      {/* Top App Bar */}
      <div className="flex justify-between items-center h-[48px] px-4 w-full border-b border-outline-variant bg-surface sticky top-0 z-10 shrink-0">
        <button 
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low rounded-full transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">keyboard_arrow_left</span>
        </button>
        <h1 className="text-headline-sm font-headline-sm text-on-surface font-bold">Mục lục & Chi tiết</h1>
        <div className="flex items-center gap-1">
          <button className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low rounded-full transition-colors">
            <span className="material-symbols-outlined text-[20px]">search</span>
          </button>
          <button className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low rounded-full transition-colors">
            <span className="material-symbols-outlined text-[20px]">swap_vert</span>
          </button>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar relative flex">
        
        {/* Main Content Column */}
        <div className="flex-1 px-4 py-5 flex flex-col gap-5 pb-8">
          
          {/* Book Info Header (Bento-style card) */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex gap-4 items-center shadow-sm relative overflow-hidden">
            {/* Subtle background glow */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary-container rounded-full opacity-10 blur-2xl pointer-events-none"></div>
            
            <img 
              alt="Book Cover" 
              className="w-[60px] h-[80px] object-cover rounded-md shadow-sm border border-outline-variant/50 shrink-0" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAnOdwg-NozzO37Vbquy07w5EdsKfyXwoI8gWtGvj-I3eX16p7fQQQkBGdjZbhu1_9orpJW8bSBxCWvNiMhjTU7GwJcYr7sNWijxFkZYnJjd7H0vNbFipBm8NqLwtPQ2XffWexL_YHuX3Dv5-T5gO5xleXnSEVV86RovcwtFCDmpviZZ9DqDjI6BTMMi728ZSwta68_AF5evQNvvNLqfU0KIkyt58Pyw_9rFQbTUJHG6bDvtfjg6-DZCmhRaLdtAtxfBEOGCVx7d5M"
            />
            
            <div className="flex flex-col gap-1 min-w-0">
              <h2 className="text-headline-xs font-headline-xs text-on-surface truncate">Vạn Đạo Kiếm Tôn</h2>
              <p className="text-body-sm font-body-sm text-on-surface-variant truncate">Đả Tử Đô Yếu Tiền</p>
              
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="bg-surface-container-high px-2 py-0.5 rounded text-[10px] font-label-sm text-on-surface-variant border border-outline-variant/30">
                  6505 Chương
                </span>
                <span className="bg-primary/10 px-2 py-0.5 rounded text-[10px] font-label-sm text-primary border border-primary/20">
                  Đang ra
                </span>
                <span className="bg-surface-container-high px-2 py-0.5 rounded text-[10px] font-label-sm text-on-surface-variant flex items-center gap-1 border border-outline-variant/30">
                  <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>headphones</span> 
                  1.2M
                </span>
              </div>
            </div>
          </div>

          {/* Chapter List Header */}
          <div className="flex justify-between items-end border-b border-outline-variant/50 pb-2">
            <h3 className="text-body-md font-headline-xs text-on-surface font-semibold">Danh sách chương</h3>
            <span className="text-label-md font-label-md text-on-surface-variant">Tổng: 6505</span>
          </div>

          {/* Chapter List Items */}
          <div className="flex flex-col gap-1">
            
            {/* Chapter 1 (Read state) */}
            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-low transition-colors group cursor-pointer">
              <div className="flex flex-col gap-0.5 min-w-0 pr-4 opacity-60">
                <h4 className="text-body-md font-body-md text-on-surface truncate">Chương 1: Thụ Kiếm</h4>
                <span className="text-label-sm font-label-sm text-on-surface-variant">2 ngày trước</span>
              </div>
              <button className="w-8 h-8 flex items-center justify-center text-outline hover:text-on-surface rounded-full transition-colors shrink-0">
                <span className="material-symbols-outlined text-[18px]">download</span>
              </button>
            </div>
            <div className="w-full h-px bg-outline-variant/30 ml-3"></div>

            {/* Chapter 2 (Read state) */}
            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-low transition-colors group cursor-pointer">
              <div className="flex flex-col gap-0.5 min-w-0 pr-4 opacity-60">
                <h4 className="text-body-md font-body-md text-on-surface truncate">Chương 2: Kiếm Vô Song</h4>
                <span className="text-label-sm font-label-sm text-on-surface-variant">2 ngày trước</span>
              </div>
              <button className="w-8 h-8 flex items-center justify-center text-outline hover:text-on-surface rounded-full transition-colors shrink-0">
                <span className="material-symbols-outlined text-[18px]">download</span>
              </button>
            </div>
            <div className="w-full h-px bg-outline-variant/30 ml-3"></div>

            {/* Chapter 3 (Currently Playing/Active) */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-high border border-primary/20 shadow-sm relative overflow-hidden group cursor-pointer">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
              <div className="flex flex-col gap-0.5 min-w-0 pr-4 pl-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-primary">volume_up</span>
                  <h4 className="text-body-md font-body-md text-primary font-bold truncate">Chương 3: Diệt Sát</h4>
                </div>
                <span className="text-label-sm font-label-sm text-primary/70">1 ngày trước • Đang nghe (12:45)</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <div className="flex items-end gap-0.5 h-4 w-4 mr-2">
                  <div className="w-1 bg-primary rounded-t-sm h-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1 bg-primary rounded-t-sm h-2/3 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1 bg-primary rounded-t-sm h-4/5 animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                </div>
                <button className="w-8 h-8 flex items-center justify-center text-primary/70 hover:text-primary rounded-full transition-colors">
                  <span className="material-symbols-outlined text-[18px]">download_done</span>
                </button>
              </div>
            </div>
            <div className="w-full h-px bg-outline-variant/30 ml-3"></div>

            {/* Chapter 4 (Unread) */}
            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-low transition-colors group cursor-pointer">
              <div className="flex flex-col gap-0.5 min-w-0 pr-4">
                <h4 className="text-body-md font-body-md text-on-surface truncate font-medium">Chương 4: Tranh Đoạt</h4>
                <span className="text-label-sm font-label-sm text-on-surface-variant">10 giờ trước</span>
              </div>
              <button className="w-8 h-8 flex items-center justify-center text-outline hover:text-on-surface rounded-full transition-colors shrink-0">
                <span className="material-symbols-outlined text-[18px]">download</span>
              </button>
            </div>
            <div className="w-full h-px bg-outline-variant/30 ml-3"></div>

            {/* Chapter 5 (Unread) */}
            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-low transition-colors group cursor-pointer">
              <div className="flex flex-col gap-0.5 min-w-0 pr-4">
                <h4 className="text-body-md font-body-md text-on-surface truncate font-medium">Chương 5: Phá Trận</h4>
                <span className="text-label-sm font-label-sm text-on-surface-variant">8 giờ trước</span>
              </div>
              <button className="w-8 h-8 flex items-center justify-center text-outline hover:text-on-surface rounded-full transition-colors shrink-0">
                <span className="material-symbols-outlined text-[18px]">download</span>
              </button>
            </div>
            <div className="w-full h-px bg-outline-variant/30 ml-3"></div>

            {/* Chapter 6 (Unread) */}
            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-low transition-colors group cursor-pointer">
              <div className="flex flex-col gap-0.5 min-w-0 pr-4">
                <h4 className="text-body-md font-body-md text-on-surface truncate font-medium">Chương 6: Huyết Mạch Giác Tỉnh</h4>
                <span className="text-label-sm font-label-sm text-on-surface-variant">5 giờ trước</span>
              </div>
              <button className="w-8 h-8 flex items-center justify-center text-outline hover:text-on-surface rounded-full transition-colors shrink-0">
                <span className="material-symbols-outlined text-[18px]">download</span>
              </button>
            </div>
            <div className="w-full h-px bg-outline-variant/30 ml-3"></div>

            {/* Chapter 7 (Unread) */}
            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-low transition-colors group cursor-pointer">
              <div className="flex flex-col gap-0.5 min-w-0 pr-4">
                <h4 className="text-body-md font-body-md text-on-surface truncate font-medium">Chương 7: Rời Đi</h4>
                <span className="text-label-sm font-label-sm text-on-surface-variant">2 giờ trước</span>
              </div>
              <button className="w-8 h-8 flex items-center justify-center text-outline hover:text-on-surface rounded-full transition-colors shrink-0">
                <span className="material-symbols-outlined text-[18px]">download</span>
              </button>
            </div>

          </div>
        </div>

        {/* Quick Navigation Sidebar (Index) */}
        <div className="w-[24px] shrink-0 border-l border-outline-variant/30 flex flex-col items-center py-4 gap-1 text-[9px] font-label-sm text-outline select-none sticky top-0 h-full bg-surface/50 backdrop-blur-sm custom-scrollbar">
          <span className="text-primary font-bold cursor-pointer hover:scale-125 transition-transform w-full text-center py-1 bg-primary/10 rounded-sm">1</span>
          <span className="cursor-pointer hover:scale-125 hover:text-on-surface transition-transform w-full text-center py-1">1k</span>
          <span className="cursor-pointer hover:scale-125 hover:text-on-surface transition-transform w-full text-center py-1">2k</span>
          <span className="cursor-pointer hover:scale-125 hover:text-on-surface transition-transform w-full text-center py-1">3k</span>
          <span className="cursor-pointer hover:scale-125 hover:text-on-surface transition-transform w-full text-center py-1">4k</span>
          <span className="cursor-pointer hover:scale-125 hover:text-on-surface transition-transform w-full text-center py-1">5k</span>
          <span className="cursor-pointer hover:scale-125 hover:text-on-surface transition-transform w-full text-center py-1">6k</span>
          <span className="mt-auto material-symbols-outlined text-[12px] cursor-pointer hover:text-on-surface pb-4">vertical_align_bottom</span>
        </div>
        
      </main>
    </div>
  );
}
