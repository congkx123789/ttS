import React from 'react';

export default function LibraryDashboard() {
  const novels = [
    {
      title: "Vạn Đạo Kiếm Tôn",
      source: "metruyenchu.com",
      chapter: "Chương 6505",
      progress: 75,
      image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCAMhIh2sVrp_iQxFrMudmY_zU0ShtG7-dVC8Ht1Eyy0nDdJsPPEUFdfnQdrmxyLW05vGxjZfXiKbgA1nuwlH6IEJKRRb7qunSQlCN1SeCRCJCmrYlgH4DAITLJoFIyv_8ZoOANr-NxD2-461A1FrvIzcdHZ5YF9D6-T0XMyltN3CxCnM63PGNTmDZBIbnAhTS33QNbAnTQ4QtyhD4FuLHJdkH0GdfFmKHEf2ckxpBpnTAe2oyWF4W4gTjsR92eyUGRDtCF6SM8r34",
    },
    {
      title: "Tu La Võ Thần",
      source: "metruyenchu.com",
      chapter: "Chương 830",
      progress: 30,
      image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCNZzI5srFH0tel1w9RuRe2xa9cwA0RWu53dBkyvPjwE8gbVOHMBUx5LgGCkm3pd3dugeQLIYZRDMdydspkTq9hwLuiZhduNKbwzFb8LhPT4lt30GiLEr7YFa6w12YZCDNCIMR8YreuPk5hL67DRUbqzybQPww5W3cV0Cpve_Vc53XZM4M4hRj2Y_fBo4PfGqByOcLx6Ma3BFA0DMDd-eLfg-nJPNLgk8_mrDvUSFUtpXbUpPKTPKwLoQxNCYICf6HK6WYCf47Kja0",
    },
    {
      title: "Tu La Võ Thần",
      source: "metruyenchu.com",
      chapter: "Chương 700",
      progress: 50,
      image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAaEz-uZyPqQ9I4xTCP0faND9rKYmcYuVs7uIYkCx6sv_1cA3T6YO1T_9gVGODwcjXzLnrCucwkkBqEQKGyWsOQ2vhDv1IDfXEYDd9vNlf64JroPUX4AVJliSjlxPQXPovGwmzysaijE7LrAKD7jGXoaystvoj3ANPXRmTbZx3IvOwtvXCkuy6dZSlrqXU6Ca4E_pi6DejfiHxvCt3mr8CMDBrc6SCD-dJxgsd8VtRiQh-3T-Sq2kr4Or_Dtm6jrEyHymHajr8382s",
    },
    {
      title: "Aninbit",
      source: "metruyenchu.com",
      chapter: "Chương 120",
      progress: 10,
      image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDX1J0q6n5--56Y_kOB68dWkk0rHxi8STYvRLSNHWyA8NHua2LyG2ZVr6Vkb17sqQAXHqcXp7lm5_kCxIJhydAPEgz3R8F6FBJkNjDoLgFuAqe0S-TCVvtTJ-s_D0rHLXS7YhbmzHo2W3F6m9WqUvG4lRKi5ZpAnf5qbWmjL5luEB05IWd9wIDoe1npu77Hox-v7Q0qMkpuM2h3X_hYxM7-p6oT8GhK5Hh7-cIH4wQ4L41MZBA9TAq-stoQF1XYEjjfqnZ-eNDpdZE",
    },
    {
      title: "Tu La Võ Thần",
      source: "metruyenchu.com",
      chapter: "Chương 6505",
      progress: 80,
      image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCNZzI5srFH0tel1w9RuRe2xa9cwA0RWu53dBkyvPjwE8gbVOHMBUx5LgGCkm3pd3dugeQLIYZRDMdydspkTq9hwLuiZhduNKbwzFb8LhPT4lt30GiLEr7YFa6w12YZCDNCIMR8YreuPk5hL67DRUbqzybQPww5W3cV0Cpve_Vc53XZM4M4hRj2Y_fBo4PfGqByOcLx6Ma3BFA0DMDd-eLfg-nJPNLgk8_mrDvUSFUtpXbUpPKTPKwLoQxNCYICf6HK6WYCf47Kja0",
    },
    {
      title: "Đạo Lướt Irg",
      source: "metruyenchu.com",
      chapter: "Chương 830",
      progress: 45,
      image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAaEz-uZyPqQ9I4xTCP0faND9rKYmcYuVs7uIYkCx6sv_1cA3T6YO1T_9gVGODwcjXzLnrCucwkkBqEQKGyWsOQ2vhDv1IDfXEYDd9vNlf64JroPUX4AVJliSjlxPQXPovGwmzysaijE7LrAKD7jGXoaystvoj3ANPXRmTbZx3IvOwtvXCkuy6dZSlrqXU6Ca4E_pi6DejfiHxvCt3mr8CMDBrc6SCD-dJxgsd8VtRiQh-3T-Sq2kr4Or_Dtm6jrEyHymHajr8382s",
    }
  ];

  return (
    <div className="w-[450px] h-[600px] flex overflow-hidden shadow-2xl rounded-xl border border-slate-800 mx-auto bg-slate-900 text-slate-200 font-sans">
      
      {/* Left Sidebar */}
      <nav className="w-[72px] h-full bg-[#1e293b] border-r border-slate-700/50 flex flex-col items-center py-4 space-y-6 shrink-0 z-20">
        <button className="group flex flex-col items-center space-y-1 text-indigo-400 mt-2">
          <span className="material-symbols-outlined text-[24px]">library_books</span>
          <span className="text-[10px] font-medium tracking-tighter">Library</span>
        </button>
        <button className="group flex flex-col items-center space-y-1 text-slate-400 hover:text-indigo-400 transition-colors">
          <span className="material-symbols-outlined text-[24px]">menu_book</span>
          <span className="text-[10px] font-medium tracking-tighter">Dictionaries</span>
        </button>
        <button className="group flex flex-col items-center space-y-1 text-slate-400 hover:text-indigo-400 transition-colors">
          <span className="material-symbols-outlined text-[24px]">cloud_upload</span>
          <span className="text-[10px] font-medium tracking-tighter text-center leading-tight">Cloud Sync</span>
        </button>
        <button className="group flex flex-col items-center space-y-1 text-slate-400 hover:text-indigo-400 transition-colors mt-auto">
          <span className="material-symbols-outlined text-[24px]">settings</span>
          <span className="text-[10px] font-medium tracking-tighter text-center leading-tight">Advanced<br/>Settings</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0f172a] relative">
        
        {/* Header Section (Sticky) */}
        <header className="pt-5 px-4 pb-3 flex flex-col gap-4 bg-[#0f172a] sticky top-0 z-10">
          <h1 className="text-[22px] font-bold text-white tracking-tight">Thư Viện & Lịch Sử</h1>
          
          {/* Quick Stats Block */}
          <div className="flex bg-[#1e293b] rounded-xl p-3 items-center divide-x divide-slate-700">
            <div className="flex-1 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-white">15</span>
              <span className="text-[11px] text-slate-300">Chương đã đọc</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-white">3</span>
              <span className="text-[11px] text-slate-300">Truyện đang đọc</span>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <span className="absolute left-3 top-2 text-slate-400 material-symbols-outlined text-[20px]">search</span>
              <input 
                type="text" 
                placeholder="Search" 
                className="w-full h-[36px] bg-[#1e293b] text-sm text-slate-200 rounded-lg pl-9 pr-3 border-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500"
              />
            </div>
            <button className="w-[36px] h-[36px] bg-[#1e293b] rounded-lg flex items-center justify-center text-slate-300 hover:text-white transition-colors">
              <span className="material-symbols-outlined text-[18px]">filter_alt</span>
            </button>
            <button className="w-[36px] h-[36px] bg-[#1e293b] rounded-lg flex items-center justify-center text-slate-300 hover:text-white transition-colors">
              <span className="material-symbols-outlined text-[18px]">sort</span>
            </button>
          </div>
        </header>

        {/* Grid Area */}
        <section className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
          <div className="grid grid-cols-3 gap-3">
            {novels.map((novel, idx) => (
              <div key={idx} className="flex flex-col bg-[#1e293b] rounded-xl overflow-hidden p-2 gap-2 hover:ring-1 hover:ring-indigo-500 transition-all cursor-pointer">
                {/* Cover Image */}
                <div className="relative aspect-[3/4] overflow-hidden rounded-lg">
                  <img 
                    src={novel.image} 
                    alt={novel.title} 
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* Info */}
                <div className="flex flex-col flex-1">
                  <h3 className="text-[12px] font-semibold text-slate-100 line-clamp-1 leading-tight mb-1">{novel.title}</h3>
                  <div className="inline-block self-start bg-teal-500/20 text-teal-400 text-[9px] px-1.5 py-0.5 rounded-full font-medium mb-2 border border-teal-500/30">
                    {novel.source}
                  </div>
                  
                  <div className="mt-auto space-y-1.5">
                    <p className="text-[10px] text-slate-300">{novel.chapter}</p>
                    <div className="h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${novel.progress}%` }}></div>
                    </div>
                    <button className="w-full h-7 mt-2 rounded-lg bg-[#4f46e5] hover:bg-indigo-500 text-white text-[11px] font-medium transition-colors">
                      Resume
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}
