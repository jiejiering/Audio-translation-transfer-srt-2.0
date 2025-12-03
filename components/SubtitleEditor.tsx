import React from 'react';
import { SubtitleSegment } from '../types';
import { formatDisplayTime } from '../utils/timeUtils';

interface SubtitleEditorProps {
  segments: SubtitleSegment[];
  onUpdateSegment: (id: string, field: 'originalText' | 'translatedText', value: string) => void;
}

const SubtitleEditor: React.FC<SubtitleEditorProps> = ({ segments, onUpdateSegment }) => {
  if (segments.length === 0) {
    return <div className="text-center text-slate-500 py-10">No subtitles generated yet.</div>;
  }

  return (
    <div className="w-full max-w-5xl mx-auto bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden shadow-2xl">
      <div className="grid grid-cols-12 bg-slate-900/80 border-b border-slate-700 p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider sticky top-0 z-10 backdrop-blur-md">
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-2 text-center">Time</div>
        <div className="col-span-9 grid grid-cols-2 gap-4">
          <div>Original Audio</div>
          <div>Chinese Translation (Proofread)</div>
        </div>
      </div>

      <div className="divide-y divide-slate-700/50 max-h-[600px] overflow-y-auto">
        {segments.map((segment, index) => (
          <div key={segment.id} className="grid grid-cols-12 hover:bg-slate-700/20 transition-colors group">
            {/* Index */}
            <div className="col-span-1 p-4 flex items-center justify-center text-slate-500 text-sm font-mono">
              {index + 1}
            </div>

            {/* Timestamps */}
            <div className="col-span-2 p-4 flex flex-col items-center justify-center text-xs text-blue-400 font-mono bg-slate-900/20">
              <span className="bg-slate-800 px-2 py-1 rounded mb-1">{formatDisplayTime(segment.startTime)}</span>
              <span className="text-slate-600">↓</span>
              <span className="bg-slate-800 px-2 py-1 rounded mt-1">{formatDisplayTime(segment.endTime)}</span>
            </div>

            {/* Editor Area */}
            <div className="col-span-9 grid grid-cols-2 gap-4 p-4">
              {/* Original Text */}
              <div className="relative">
                <textarea
                  value={segment.originalText}
                  onChange={(e) => onUpdateSegment(segment.id, 'originalText', e.target.value)}
                  className="w-full h-full min-h-[80px] bg-transparent border border-slate-700 hover:border-slate-500 focus:border-blue-500 rounded p-3 text-slate-300 text-sm resize-none focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all"
                  placeholder="Original transcript..."
                />
              </div>

              {/* Translated Text */}
              <div className="relative">
                <textarea
                  value={segment.translatedText}
                  onChange={(e) => onUpdateSegment(segment.id, 'translatedText', e.target.value)}
                  className="w-full h-full min-h-[80px] bg-slate-900/30 border border-slate-700 hover:border-slate-500 focus:border-green-500 rounded p-3 text-emerald-100 text-sm resize-none focus:ring-1 focus:ring-green-500 focus:outline-none transition-all"
                  placeholder="Chinese translation..."
                />
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] bg-green-900/50 text-green-400 px-1.5 py-0.5 rounded border border-green-800">
                    ZH-CN
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SubtitleEditor;
