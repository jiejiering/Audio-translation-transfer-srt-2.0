import React, { useState } from 'react';
import FileUploader from './components/FileUploader';
import SubtitleEditor from './components/SubtitleEditor';
import { processAudioWithGemini } from './services/geminiService';
import { generateSRT, downloadFile } from './utils/timeUtils';
import { SubtitleSegment, ProcessingStatus, ProcessingError } from './types';

export default function App() {
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [file, setFile] = useState<File | null>(null);
  const [segments, setSegments] = useState<SubtitleSegment[]>([]);
  const [error, setError] = useState<ProcessingError | null>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setStatus(ProcessingStatus.PROCESSING);
    setError(null);
    setSegments([]);

    try {
      const generatedSegments = await processAudioWithGemini(selectedFile);
      setSegments(generatedSegments);
      setStatus(ProcessingStatus.COMPLETED);
    } catch (err: any) {
      console.error(err);
      setStatus(ProcessingStatus.ERROR);
      setError({ message: err.message || "An unexpected error occurred during processing." });
    }
  };

  const handleUpdateSegment = (id: string, field: 'originalText' | 'translatedText', value: string) => {
    setSegments((prev) =>
      prev.map((seg) => (seg.id === id ? { ...seg, [field]: value } : seg))
    );
  };

  const handleDownloadSRT = () => {
    if (!file || segments.length === 0) return;
    const content = generateSRT(segments);
    const fileName = file.name.replace(/\.[^/.]+$/, "") + "_zh.srt";
    downloadFile(content, fileName, 'text/plain');
  };

  const handleDownloadTXT = () => {
    if (!file || segments.length === 0) return;
    const content = segments.map(seg => 
      `[${new Date(seg.startTime * 1000).toISOString().substring(14, 19)} - ${new Date(seg.endTime * 1000).toISOString().substring(14, 19)}] ${seg.originalText}\n${seg.translatedText}\n`
    ).join('\n');
    const fileName = file.name.replace(/\.[^/.]+$/, "") + "_transcript.txt";
    downloadFile(content, fileName, 'text/plain');
  };

  const handleReset = () => {
    setStatus(ProcessingStatus.IDLE);
    setFile(null);
    setSegments([]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 selection:bg-blue-500/30">
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7 2a1 1 0 011 1v1h3a1 1 0 110 2H9.578a18.87 18.87 0 01-1.724 4.78c.279.16.59.383.755.635l2.5 3.75a1 1 0 01-1.664 1.11l-2.13-3.195a9.89 9.89 0 01-5.176-.565 1 1 0 11.758-1.85 7.9 7.9 0 003.5 0 20.9 20.9 0 001.62-3.87H4a1 1 0 110-2h4V3a1 1 0 011-1zM6.65 16.5a1 1 0 10-1.3 1.5 8.956 8.956 0 01-1.332-1.479 1 1 0 00-1.442 1.385A10.957 10.957 0 006.65 16.5z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              AudioTranscribe <span className="text-blue-500">&</span> Translate
            </h1>
          </div>
          
          {status === ProcessingStatus.COMPLETED && (
             <div className="flex space-x-3">
                <button 
                  onClick={handleDownloadSRT}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-lg shadow-blue-600/20"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export SRT
                </button>
                <button 
                  onClick={handleDownloadTXT}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 hover:text-white transition-colors"
                >
                  Export Doc
                </button>
                <button 
                  onClick={handleReset}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                  title="Start Over"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
             </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* State: IDLE */}
        {status === ProcessingStatus.IDLE && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-10">
              <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl mb-4">
                Globalize your audio content.
              </h2>
              <p className="max-w-2xl mx-auto text-xl text-slate-400">
                Instantly transcribe audio, translate accurately to Chinese, and align subtitles for professional production.
              </p>
            </div>
            <FileUploader onFileSelect={handleFileSelect} />
          </div>
        )}

        {/* State: PROCESSING */}
        {status === ProcessingStatus.PROCESSING && (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="relative w-24 h-24 mb-8">
              <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <h3 className="text-2xl font-semibold text-white mb-2">Processing Audio...</h3>
            <p className="text-slate-400 text-center max-w-md">
              Gemini is listening to your audio, transcribing, and translating sentence by sentence. This may take a moment depending on file length.
            </p>
          </div>
        )}

        {/* State: ERROR */}
        {status === ProcessingStatus.ERROR && (
          <div className="max-w-lg mx-auto bg-red-500/10 border border-red-500/20 rounded-xl p-8 text-center animate-fade-in">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Processing Failed</h3>
            <p className="text-red-300 mb-6">{error?.message}</p>
            <button 
              onClick={handleReset}
              className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* State: COMPLETED */}
        {status === ProcessingStatus.COMPLETED && (
          <div className="animate-fade-in">
             <div className="mb-6 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Review & Edit Subtitles</h2>
                <div className="text-sm text-slate-400">
                  {segments.length} segments detected
                </div>
             </div>
             <SubtitleEditor 
                segments={segments} 
                onUpdateSegment={handleUpdateSegment} 
             />
          </div>
        )}

      </main>
    </div>
  );
}