import React, { useState } from 'react';

export default function NovelPlayer({ onBack, onReadText, onOpenIndex }) {
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);

  return (
    <div className="absolute inset-0 z-50 bg-gray-900 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center h-[48px] px-4 w-full shrink-0 z-10 bg-transparent">
        <button onClick={onBack} className="material-symbols-outlined text-white hover:bg-gray-800 p-1 rounded-full transition-colors" style={{ fontVariationSettings: "'FILL' 0" }}>
          keyboard_arrow_down
        </button>
        <h1 className="text-headline-xs font-headline-xs text-white">Trợ lý Văn học & Nghe AI</h1>
        <div className="flex gap-4">
          <span className="material-symbols-outlined text-white cursor-pointer hover:text-gray-300">refresh</span>
          <span className="material-symbols-outlined text-white cursor-pointer hover:text-gray-300">more_horiz</span>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-24 px-4 flex flex-col gap-5 relative">
        {/* Background Image Blur Effect */}
        <div className="absolute top-0 left-0 w-full h-[400px] -z-10 opacity-30">
          <img 
            alt="Background" 
            className="w-full h-full object-cover blur-2xl mask-image-linear-gradient" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuA1yai1yUA3rO4hord9nk_KMR3SVr8g8X9AlhvjuHNYMv5u7WG_eq-BwaPLeeJLiqL3aO3NSN_D9waJi-E_X6mCTRWFVOGq59hH0MBR73hDqD6lndU5o3bySJn9tFdvzTpTltfcNgK4TiGEzxOhPV4STthIeyoKiN1q0FcTcceBRC4KCsCvzIs1wRULYFClC_DxWKNkLoVFzfbC_IB56R2oMJWQeuL2mGEq9mxIjLzTdH4WOP61CtEhzRXDzlZ5jfTXyTB7WBufwDY"
          />
        </div>

        {/* Album Art */}
        <div className="w-full aspect-square max-h-[300px] mt-4 rounded-xl overflow-hidden relative shadow-lg mx-auto flex-shrink-0">
          <img 
            alt="Book Cover" 
            className="w-full h-full object-cover" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuB95siKszqrhov-X98bWFdjZX7XQxhfFX0pUOXkF6kzlsMGSX8kvDUqJbuhJSjkzXdBMMfwcV1T7gYXiPrPYkN1mWejvFoE_azvp6hRXNS4aM2d6-5a21DLx4vA-CQalnIHKKIkj5UIPOHRe0eFdyrWqGOlN9_yjC1gCv4oTVpH4EISm1cVHy3AnduZR2ou0YWYXtgavtJ-imRF2Q--D0DGhe6XHzqn8xQFvOQEjwT2W-HWvgSDO-l7q9obW6k-ctYhhhKUT2tWhdg"
          />
          <div className="absolute top-2 right-2 bg-[#d4af37] text-black text-[10px] font-bold px-2 py-0.5 rounded-sm">会员</div>
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-4 flex flex-col items-center">
            <h2 className="text-headline-sm font-headline-sm text-white">万道剑尊</h2>
            <p className="text-body-sm font-body-sm text-gray-300">第1章 授剑</p>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex flex-col gap-4 mt-2">
          {/* Progress Bar */}
          <div className="flex items-center gap-4 px-2">
            <div className="text-xs text-gray-400">03:19</div>
            <div className="flex-1 h-1 bg-gray-700 rounded-full relative cursor-pointer">
              <div className="absolute top-0 left-0 h-full w-1/2 bg-primary-container rounded-full"></div>
              <div className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-md"></div>
            </div>
            <div className="text-xs text-gray-400">06:28</div>
          </div>
          
          {/* Main Controls */}
          <div className="flex justify-between items-center px-6">
            <span className="material-symbols-outlined text-gray-400 text-2xl cursor-pointer hover:text-white transition-colors">replay_5</span>
            <span className="material-symbols-outlined text-gray-400 text-3xl cursor-pointer hover:text-white transition-colors">skip_previous</span>
            <button className="w-16 h-16 bg-primary-container rounded-full flex items-center justify-center shadow-lg hover:bg-primary transition-colors active:scale-95">
              <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>pause</span>
            </button>
            <span className="material-symbols-outlined text-gray-400 text-3xl cursor-pointer hover:text-white transition-colors">skip_next</span>
            <span className="material-symbols-outlined text-gray-400 text-2xl cursor-pointer hover:text-white transition-colors">forward_5</span>
          </div>

          {/* Sub Toolbar */}
          <div className="flex justify-between mt-4 px-2">
            <div className="flex flex-col items-center gap-1 cursor-pointer hover:text-white group">
              <span className="material-symbols-outlined text-gray-400 group-hover:text-white transition-colors">book</span>
              <span className="text-[10px] text-gray-400 group-hover:text-white transition-colors">Kệ sách</span>
            </div>
            <div className="flex flex-col items-center gap-1 cursor-pointer hover:text-white group">
              <span className="material-symbols-outlined text-gray-400 group-hover:text-white transition-colors">alarm</span>
              <span className="text-[10px] text-gray-400 group-hover:text-white transition-colors">Hẹn giờ tắt</span>
            </div>
            <div className="flex flex-col items-center gap-1 cursor-pointer hover:text-white group">
              <span className="material-symbols-outlined text-gray-400 group-hover:text-white transition-colors">speed</span>
              <span className="text-[10px] text-gray-400 group-hover:text-white transition-colors">Tốc độ phát</span>
            </div>
            <div className="flex flex-col items-center gap-1 cursor-pointer hover:text-white group">
              <span className="material-symbols-outlined text-gray-400 group-hover:text-white transition-colors">download</span>
              <span className="text-[10px] text-gray-400 group-hover:text-white transition-colors">Tải xuống</span>
            </div>
            <div 
              onClick={onOpenIndex}
              className="flex flex-col items-center gap-1 cursor-pointer hover:text-white group"
            >
              <span className="material-symbols-outlined text-gray-400 group-hover:text-white transition-colors">format_list_bulleted</span>
              <span className="text-[10px] text-gray-400 group-hover:text-white transition-colors">6505 chương</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mt-2 justify-center">
            <button className="bg-gray-800 text-gray-300 px-6 py-2 rounded-full text-sm font-medium hover:bg-gray-700 hover:text-white transition-colors">朗读人 · 昭君 &gt;</button>
            <button 
              onClick={onReadText}
              className="bg-gray-800 text-gray-300 px-6 py-2 rounded-full text-sm font-medium hover:bg-gray-700 hover:text-white transition-colors"
            >
              Xem nguyên văn
            </button>
          </div>
        </div>

        {/* AI Interaction Card */}
        <div 
          onClick={() => setIsAIChatOpen(true)}
          className="bg-gray-800/50 border border-primary-container/30 rounded-xl p-4 flex gap-4 items-center cursor-pointer hover:bg-gray-800 transition-colors"
        >
          <div className="w-12 h-12 bg-primary-container/20 rounded-full flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary-container text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
          </div>
          <div className="flex flex-col">
            <h3 className="text-headline-xs font-headline-xs text-white mb-1">Tương tác AI</h3>
            <p className="text-xs text-gray-400 line-clamp-2">Bắt đầu hội thoại để phân tích chương, giải thích cốt truyện, hoặc tra cứu nhân vật...</p>
          </div>
        </div>

        {/* Book Intro */}
        <div className="bg-gray-800/30 rounded-xl p-4">
          <h3 className="text-sm font-bold text-white mb-2">书籍简介</h3>
          <p className="text-sm text-gray-400 leading-relaxed">少年遭挚爱背叛，沦为万人唾弃的叛徒，一怒开启金手指，三天升了十八级，决战之日，挚爱懵了！</p>
        </div>

        {/* Recommendations */}
        <div className="bg-gray-800/30 rounded-xl p-4 pb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-white">猜你喜欢听</h3>
            <div className="flex items-center text-xs text-gray-400 gap-1 cursor-pointer hover:text-white transition-colors">
              换一换 <span className="material-symbols-outlined text-[14px]">refresh</span>
            </div>
          </div>
          
          <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2">
            {[
              "https://lh3.googleusercontent.com/aida-public/AB6AXuCX4w1nvTclviifGgFlNhW2iOz1zlF6jNxx4wUsUDk1I7uhZeeFYYYhTial8SyhB1Wd8bpZ8ZK3PXWsHnBU4-2H2xO9hrQ749hmkOnSRJMoBM2Pu5zvOcWyEfxlMuIeCWyyiovohbMuf05r3IQfW8z5uSHHysCeZYIsPUaoRq3AQT-hOBt-goG3DLqZprMrBpG1MRfo-xRSH2MRNcC0WQxEviuFaIXaojshT99YEvjDYfKLr0NX4ie1kUbbUnZqbijCiox1KkDUq3U",
              "https://lh3.googleusercontent.com/aida-public/AB6AXuCR9-8LXBMCROv-KZpUOhksSg88fNZvfKOAXqQmuysqgo56q6-50TtW_SZGexxL4Re7wXi9FwWqLV2r3rLEgElhlP2x8MwPktfV166QBD2NaOQfqiGX7jZXZBjQ0P2sQjkmOPGOeO1hm-hq_ypCxJ5ZdQ0lngw_MiSHQr6ywDgBNvHc33mr-CRPUFR3TU8NktYRmOSgg2Jsfn5yx-AMk4opNTbIMkehysIiKnJ_XshdvYALS7VPJ-LJncK4qZpTHUo18BZfW4u-Vzk",
              "https://lh3.googleusercontent.com/aida-public/AB6AXuD_vHxSZhAgOmDYDaxs7d1SoOkeO1dANEBLr6uScEN6Of_ZgnP_fvr3ftYCJWjfGIjcoPQ46fe2nnLmfTVoioE_RqCPVNTVNRv91XpUZqTr-REQnMyAWgKd4NFTZt6sWtfqbOEgYozOUCbw0PqUlS3ZljqTw3ws-DSoJ1G7nUEpT5o0g4qdfWG41Km4kqOWBwVUnr1nN0waVB-6g2k5upwRWjlUJGVXykop5tOdFiux5iFWGkjc6p337_2yClpNIFqoJTcHeCoxtBw"
            ].map((img, i) => (
              <div key={i} className="w-24 shrink-0 relative cursor-pointer hover:opacity-80 transition-opacity">
                <div className="absolute top-1 right-1 bg-[#d4af37] text-black text-[9px] font-bold px-1.5 py-0.5 rounded-sm z-10">会员</div>
                <img alt={`Rec ${i+1}`} className="w-full aspect-[3/4] object-cover rounded-md mb-2" src={img} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Sheet Simulation (AI Chat) - Toggleable */}
      <div 
        className={`absolute bottom-0 left-0 w-full h-[70%] bg-gray-900 rounded-t-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-gray-800 flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${isAIChatOpen ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* Sheet Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-800 rounded-full overflow-hidden">
              <img alt="AI Avatar" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCvy5Osg2Z_qY30TVEH49G1dlXevLBI-wV72r8HjSZOd4Ln4t1TdmCjYklDocom85lqlSHAbJaVi7_YeGWir8Zv-jpbyJBSBEk9fA40u5ihEMy6dHiie95AvjH0ES_fwA-mfA48vU3Q_WOVHXuPLsOk5SsE4fmZRtaRb8VssNVKKv38-xb7EkZ1kGRsp907mtoblWHGGM0cZHYi2e95QQBvr-AYTeBwG8CDw7zL9BOQapcSYoxTUj2ZJ71wTNyEljyMdX3XgSFnQtQ" />
            </div>
            <span className="text-sm font-semibold text-white">Zhaojun: Trợ lý Văn học</span>
          </div>
          <button onClick={() => setIsAIChatOpen(false)} className="material-symbols-outlined text-gray-400 hover:text-white transition-colors cursor-pointer p-1 rounded-full hover:bg-gray-800">
            close
          </button>
        </div>

        {/* Chat Canvas */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">
          {/* AI Message */}
          <div className="flex gap-3 max-w-[85%]">
            <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 mt-1">
              <img alt="AI Avatar" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCr8VNz-MqI-l2jRS4k5eV16T7VBEQoufjwp0pdCUi3REbdv1L9ubPITtH8KbmXPYFQDwsIoWW5O0sCHPB0-NQlBDKe_XRfIL8-wIgIGtN88J0qOMFk_KqFTGNFRbBy-8hiD6NNNHqBGGnhvVHXnfyty2roX1O-tAD_ctIf_XjBu6G16jVQpVmnRNMF0XDbCctC4adrp--Ky3mXC1jZBTGBg4CEtdtE8vxJC-vcbKieHu5udppqz8L40Hm2LqlkCs38AjqYUQJrbuI" />
            </div>
            <div className="bg-gray-800 text-sm text-gray-200 p-3 rounded-2xl rounded-tl-sm shadow-sm">
              Chào bạn. Tôi là Trợ lý Văn học AI. Tôi có thể giúp bạn phân tích chương này, giải thích các thuật ngữ, hoặc tóm tắt cốt truyện. Bạn muốn biết gì?
            </div>
          </div>

          {/* Chips */}
          <div className="flex flex-wrap gap-2 pl-9">
            <span className="text-xs bg-primary-container/20 text-primary-fixed border border-primary-container/30 px-3 py-1.5 rounded-full cursor-pointer hover:bg-primary-container/30 transition-colors">Phân tích âm mưu...</span>
            <span className="text-xs bg-primary-container/20 text-primary-fixed border border-primary-container/30 px-3 py-1.5 rounded-full cursor-pointer hover:bg-primary-container/30 transition-colors">Giải thích golden finger...</span>
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-800 bg-gray-900 shrink-0">
          <div className="flex items-center gap-2 bg-gray-800 rounded-full px-4 py-2 border border-gray-700 focus-within:border-primary-container transition-colors">
            <span className="material-symbols-outlined text-gray-400 cursor-pointer hover:text-white transition-colors">mic</span>
            <input 
              className="flex-1 bg-transparent border-none text-sm text-white focus:ring-0 focus:outline-none placeholder-gray-500" 
              placeholder="Hỏi AI về cuốn sách..." 
              type="text" 
            />
            <span className="material-symbols-outlined text-primary-container cursor-pointer hover:text-primary-fixed transition-colors" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
          </div>
        </div>
      </div>
    </div>
  );
}
