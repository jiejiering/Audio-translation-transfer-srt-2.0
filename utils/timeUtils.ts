import { SubtitleSegment } from '../types';

/**
 * Formats seconds into SRT timestamp format (HH:MM:SS,mmm)
 */
export const formatSRTTimestamp = (seconds: number): string => {
  const date = new Date(0);
  date.setMilliseconds(seconds * 1000);
  const isoString = date.toISOString();
  // Extract HH:MM:SS.mmm from 1970-01-01THH:MM:SS.mmmZ
  // ISO string is 24 chars. HH is at 11, mmm ends at 23
  let timePart = isoString.substring(11, 23); 
  // Replace dot with comma for SRT format
  return timePart.replace('.', ',');
};

/**
 * Formats seconds into display format (MM:SS)
 */
export const formatDisplayTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Generates SRT file content from segments
 */
export const generateSRT = (segments: SubtitleSegment[]): string => {
  return segments
    .map((segment, index) => {
      const indexLine = index + 1;
      const timeLine = `${formatSRTTimestamp(segment.startTime)} --> ${formatSRTTimestamp(segment.endTime)}`;
      // SRT typically has one language, but we can put Chinese (or both)
      // Here we output the Translated text as primary, as requested
      const textLine = segment.translatedText;
      
      return `${indexLine}\n${timeLine}\n${textLine}\n`;
    })
    .join('\n');
};

/**
 * Downloads a string as a file
 */
export const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};