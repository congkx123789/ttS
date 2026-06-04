import React, { useState, useEffect } from 'react';

export default function NovelReader({ onBack }) {
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [readProgress, setReadProgress] = useState(0);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const progress = (scrollTop / (scrollHeight - clientHeight)) * 100;
    setReadProgress(progress);
  };

  return (
    <div className="absolute inset-0 z-50 bg-paper text-on-surface flex flex-col overflow-hidden">
      
      {/* TopAppBar */}
      <header className="bg-surface flex justify-between items-center h-[48px] px-4 w-full shrink-0 border-b border-outline-variant z-10 sticky top-0 shadow-sm">
        <button 
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors rounded-full"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <h1 className="text-headline-sm font-headline-sm font-bold text-primary truncate px-4 max-w-[250px]">
          Vạn Đạo Kiếm Tôn
        </h1>
        <button 
          onClick={() => { setIsSettingsOpen(!isSettingsOpen); setIsAIOpen(false); }}
          className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors rounded-full"
        >
          <span className="material-symbols-outlined text-[20px]">format_size</span>
        </button>
      </header>

      {/* Main Content Canvas */}
      <main 
        className="flex-1 overflow-y-auto px-6 py-8 pb-32 custom-scrollbar" 
        onScroll={handleScroll}
      >
        <h2 className="font-serif font-bold text-2xl text-center mb-8 text-on-surface">Chương 1: Thụ Kiếm</h2>
        <div className="font-serif text-[18px] leading-[1.8] text-[#2c2c2c]">
          <p className="mb-[1.5em] indent-[1.5em]">Trời nhá nhem tối, mây đen vần vũ che kín bầu trời, những hạt mưa lất phất bắt đầu rơi xuống những mái nhà ngói đỏ của Kiếm Tông. Tiếng mưa rơi rả rích như một bản nhạc buồn bã, vang vọng khắp sơn môn tĩnh lặng.</p>
          <p className="mb-[1.5em] indent-[1.5em]">Trong một căn phòng nhỏ xập xệ nằm ở góc hẻo lánh nhất của ngoại môn, Lâm Dật đang ngồi bó gối trên chiếc giường tre ọp ẹp. Cậu thiếu niên mười sáu tuổi, thân hình gầy gò, khuôn mặt thanh tú nhưng nhợt nhạt vì thiếu dinh dưỡng và những trận đòn roi triền miên. Đôi mắt đen láy của cậu nhìn chằm chằm vào thanh kiếm rỉ sét đặt trên bàn, ánh mắt chứa đựng sự bướng bỉnh và không cam lòng.</p>
          <p className="mb-[1.5em] indent-[1.5em]">"Chỉ là một phế vật không có linh căn, mười sáu năm qua vẫn dậm chân ở Luyện Khí kỳ tầng một, mày lấy tư cách gì mà đòi tham gia tỷ võ ngoại môn?" Giọng nói the thé đầy vẻ chế giễu của gã quản sự ngoại môn ban sáng vẫn văng vẳng bên tai Lâm Dật.</p>
          <p className="mb-[1.5em] indent-[1.5em]">Cậu cắn chặt môi, vị máu tanh nhàn nhạt tràn trong khoang miệng. Đúng vậy, ở cái thế giới tu tiên cá lớn nuốt cá bé này, không có thực lực, cậu chẳng là gì cả. Thậm chí còn không bằng một con chó canh cửa cho những kẻ có tiền tài, thế lực.</p>
          <p className="mb-[1.5em] indent-[1.5em]">Nhưng Lâm Dật không cam tâm. Cậu không muốn sống một cuộc đời vô danh tiểu tốt, để người khác chà đạp, nhục mạ. Cậu muốn trở nên mạnh mẽ, muốn nắm giữ vận mệnh của chính mình.</p>
          <p className="mb-[1.5em] indent-[1.5em]">Bỗng nhiên, thanh kiếm rỉ sét trên bàn rung lên bần bật. Một luồng ánh sáng yếu ớt lóe lên, rồi nhanh chóng vụt tắt. Lâm Dật kinh ngạc mở to mắt, không thể tin vào những gì mình vừa nhìn thấy. Thanh kiếm này là di vật duy nhất mẹ để lại cho cậu trước khi qua đời. Cậu đã cất giữ nó cẩn thận suốt mười mấy năm qua, nhưng chưa bao giờ thấy nó có bất kỳ biểu hiện lạ nào.</p>
          <p className="mb-[1.5em] indent-[1.5em]">Run rẩy vươn tay, Lâm Dật chạm vào thanh kiếm. Ngay khoảnh khắc ngón tay cậu tiếp xúc với lớp kim loại rỉ sét, một luồng khí lạnh lẽo nhưng đầy sức sống truyền thẳng vào cơ thể cậu, chạy dọc theo kinh mạch, đánh thức những tế bào đang say ngủ.</p>
          <p className="mb-[1.5em] indent-[1.5em]">Cậu nhắm mắt lại, cảm nhận luồng sức mạnh kỳ lạ đang cuộn trào trong cơ thể. Một giọng nói trầm thấp, cổ xưa vang lên trong đầu cậu: "Kẻ được chọn, cuối cùng ngươi cũng đã thức tỉnh..."</p>
          <p className="mb-[1.5em] indent-[1.5em]">Một thế giới mới, một vận mệnh mới, đang mở ra trước mắt Lâm Dật. Và hành trình của Vạn Đạo Kiếm Tôn, chính thức bắt đầu từ đêm mưa gió này.</p>
        </div>
        
        {/* Next Chapter Button */}
        <div className="mt-12 flex justify-center pb-8">
          <button className="bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md px-6 py-3 rounded-full shadow-sm transition-colors w-[200px] flex items-center justify-center gap-2 active:scale-95 duration-100">
            Chương tiếp theo
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </main>

      {/* Reading Progress Bar */}
      <div className="fixed bottom-0 left-0 w-[450px] mx-auto h-1 bg-surface-container-highest z-40">
        <div className="h-full bg-primary" style={{ width: `${readProgress}%` }}></div>
      </div>

      {/* AI Assistant FAB */}
      <div className="fixed bottom-6 right-4 z-40">
        <button 
          onClick={() => { setIsAIOpen(!isAIOpen); setIsSettingsOpen(false); }}
          className="bg-surface shadow-md border border-outline-variant rounded-full p-1 flex items-center justify-center hover:bg-surface-container-low transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-surface-container-high border-2 border-primary flex items-center justify-center overflow-hidden">
            <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
          </div>
        </button>
      </div>

      {/* AI Overlay */}
      {isAIOpen && (
        <div className="fixed bottom-20 right-4 w-[280px] bg-surface rounded-xl shadow-lg border border-outline-variant p-4 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
          <div className="flex items-center gap-3 mb-3 border-b border-outline-variant pb-3">
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-on-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            </div>
            <div>
              <p className="text-label-md font-label-md text-on-surface font-bold">Zhaojun AI</p>
              <p className="text-label-sm font-label-sm text-outline">Trợ lý đọc</p>
            </div>
            <button className="ml-auto text-outline hover:text-on-surface" onClick={() => setIsAIOpen(false)}>
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
          <div className="space-y-2">
            <button className="w-full text-left px-3 py-2 text-body-sm font-body-sm text-on-surface hover:bg-surface-container rounded-md transition-colors flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-primary">translate</span>
              Giải thích đoạn này
            </button>
            <button className="w-full text-left px-3 py-2 text-body-sm font-body-sm text-on-surface hover:bg-surface-container rounded-md transition-colors flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-primary">summarize</span>
              Tóm tắt chương
            </button>
          </div>
        </div>
      )}

      {/* Settings Overlay */}
      {isSettingsOpen && (
        <div className="fixed top-14 right-4 w-[240px] bg-surface rounded-xl shadow-lg border border-outline-variant p-4 z-50 animate-in slide-in-from-top-2 fade-in duration-200">
          <p className="text-label-md font-label-md text-on-surface mb-4 font-bold border-b border-outline-variant pb-2">Tùy chỉnh hiển thị</p>
          <div className="mb-4">
            <p className="text-label-sm font-label-sm text-outline mb-2">Cỡ chữ</p>
            <div className="flex items-center gap-4 bg-surface-container-low p-1 rounded-lg">
              <button className="flex-1 py-1 text-center text-on-surface hover:bg-surface rounded-md">A-</button>
              <button className="flex-1 py-1 text-center text-on-surface hover:bg-surface rounded-md font-bold">A+</button>
            </div>
          </div>
          <div>
            <p className="text-label-sm font-label-sm text-outline mb-2">Chủ đề</p>
            <div className="flex gap-2">
              <button className="w-8 h-8 rounded-full bg-[#F9F7F1] border-2 border-primary"></button>
              <button className="w-8 h-8 rounded-full bg-white border border-outline-variant"></button>
              <button className="w-8 h-8 rounded-full bg-[#121212] border border-outline-variant"></button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
