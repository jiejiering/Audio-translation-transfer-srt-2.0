export interface SubtitleSegment {
  id: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  originalText: string;
  translatedText: string;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface ProcessingError {
  message: string;
}