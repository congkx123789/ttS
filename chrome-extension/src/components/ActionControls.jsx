import React from 'react';

export default function ActionControls() {
  return (
    <div className="flex items-center gap-inline-gap mt-2">
      <button className="flex-1 bg-primary text-on-primary h-[36px] rounded-DEFAULT flex items-center justify-center gap-2 hover:bg-primary-container transition-colors shadow-sm text-label-md font-label-md">
        <span className="material-symbols-outlined icon-fill text-[18px]">play_arrow</span>
        Listen via TTS
      </button>
      <button className="w-[36px] h-[36px] border border-outline-variant text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface rounded-DEFAULT flex items-center justify-center transition-colors">
        <span className="material-symbols-outlined text-[18px]">content_copy</span>
      </button>
      <button className="w-[36px] h-[36px] border border-outline-variant text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface rounded-DEFAULT flex items-center justify-center transition-colors">
        <span className="material-symbols-outlined text-[18px]">share</span>
      </button>
    </div>
  );
}
