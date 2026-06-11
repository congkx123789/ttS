import React from 'react';

export default function SegmentedControl() {
  return (
    <div className="bg-surface-container p-1 rounded-lg flex items-center gap-1 border border-outline-variant">
      <button className="flex-1 bg-surface shadow-sm rounded-DEFAULT py-1.5 text-primary text-label-md font-label-md transition-all flex justify-center items-center gap-2">
        <span className="material-symbols-outlined text-[16px]">center_focus_weak</span>
        Dạng ảnh
      </button>
      <button className="flex-1 text-on-surface-variant hover:text-on-surface rounded-DEFAULT py-1.5 text-label-md font-label-md transition-all flex justify-center items-center gap-2">
        <span className="material-symbols-outlined text-[16px]">subject</span>
        Văn bản thô
      </button>
    </div>
  );
}
