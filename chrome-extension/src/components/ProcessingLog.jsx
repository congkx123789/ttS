import React from 'react';

export default function ProcessingLog() {
  return (
    <div className="mt-section-margin bg-surface-container-low rounded-lg p-3 border border-outline-variant">
      <div className="flex justify-between items-center mb-2">
        <span className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">Processing Log</span>
        <span className="text-label-sm font-label-sm text-primary">98% Confidence</span>
      </div>
      <div className="space-y-1">
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined text-[14px] text-primary mt-0.5">check_circle</span>
          <span className="text-label-md font-label-md text-on-surface">Image noise reduction applied.</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined text-[14px] text-primary mt-0.5">check_circle</span>
          <span className="text-label-md font-label-md text-on-surface">Text block bounding boxes identified.</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined text-[14px] text-outline mt-0.5 animate-spin">sync</span>
          <span className="text-label-md font-label-md text-on-surface-variant">Synthesizing speech engine...</span>
        </div>
      </div>
    </div>
  );
}
