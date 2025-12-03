import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SubtitleSegment } from "../types";

const SYSTEM_INSTRUCTION = `
You are an expert transcriber and translator. 
Your task is to:
1. Listen to the audio file provided.
2. Transcribe the spoken content accurately in its original language.
3. Translate the content into Simplified Chinese (zh-CN) sentence by sentence.
4. Provide precise timestamps (start and end time in seconds) for each sentence or logical segment.
5. Ensure the timestamps align perfectly with the audio for subtitle synchronization.

Return the result STRICTLY as a JSON array of objects.
`;

const RESPONSE_SCHEMA: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      startTime: {
        type: Type.NUMBER,
        description: "Start time of the segment in seconds (e.g., 1.5)",
      },
      endTime: {
        type: Type.NUMBER,
        description: "End time of the segment in seconds (e.g., 4.2)",
      },
      originalText: {
        type: Type.STRING,
        description: "The original transcribed text",
      },
      translatedText: {
        type: Type.STRING,
        description: "The Simplified Chinese translation",
      },
    },
    required: ["startTime", "endTime", "originalText", "translatedText"],
  },
};

// Threshold to trigger chunking. 
// 2.5MB allows for plenty of headroom before hitting typical browser XHR limits (often ~10MB, but sometimes stricter).
const CHUNK_THRESHOLD_BYTES = 2.5 * 1024 * 1024;

// Chunk duration in seconds. 
// 16kHz mono 16-bit WAV is ~32KB/s. 
// 60s = ~1.92MB. With Base64 overhead (~33%), this is ~2.56MB per request. Very safe.
const CHUNK_DURATION_SECONDS = 60;

export const processAudioWithGemini = async (
  audioFile: File
): Promise<SubtitleSegment[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing from environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    // Strategy: If file is small, send directly. If large, decode and chunk.
    if (audioFile.size < CHUNK_THRESHOLD_BYTES) {
        return await processSingleChunk(ai, audioFile);
    } else {
        console.log("File larger than threshold, switching to robust chunked processing...");
        return await processChunkedAudio(ai, audioFile);
    }

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes("Rpc failed") || error.message?.includes("xhr error")) {
        throw new Error("Network error during upload. The file size might exceed the API's payload limit. Please try a smaller file or ensure your network is stable.");
    }
    throw error;
  }
};

async function processSingleChunk(ai: GoogleGenAI, blob: Blob): Promise<SubtitleSegment[]> {
    const base64Data = await blobToBase64(blob);
    // Determine mimeType. For chunks created by us, it's audio/wav.
    // For original files, use file type or fallback.
    const mimeType = blob.type || "audio/mp3";

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data,
              },
            },
            {
              text: "Transcribe and translate this audio to Chinese with timestamps.",
            },
          ],
        },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.2, 
        },
      });
  
      const jsonText = response.text;
      if (!jsonText) throw new Error("No response text received.");
  
      let parsedData;
      try {
          parsedData = JSON.parse(jsonText);
      } catch (e) {
          throw new Error("Failed to parse JSON response.");
      }
  
      if (!Array.isArray(parsedData)) throw new Error("Model response was not an array.");
  
      return parsedData.map((item: any, index: number) => ({
        id: `seg-${Date.now()}-${index}`,
        startTime: item.startTime,
        endTime: item.endTime,
        originalText: item.originalText,
        translatedText: item.translatedText,
      }));
}

async function processChunkedAudio(ai: GoogleGenAI, file: File): Promise<SubtitleSegment[]> {
    // 1. Decode Audio
    const audioContext = new AudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // 2. Resample to 16kHz Mono to save space
    const offlineCtx = new OfflineAudioContext(1, audioBuffer.duration * 16000, 16000);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start();
    const resampledBuffer = await offlineCtx.startRendering();

    // 3. Slice and Process
    const totalDuration = resampledBuffer.duration;
    let currentTime = 0;
    let allSegments: SubtitleSegment[] = [];

    const pcmData = resampledBuffer.getChannelData(0);
    const sampleRate = 16000;

    // Add a slight overlap or buffer if needed, but clean cuts usually work fine for sentence detection if segments are long enough.
    while (currentTime < totalDuration) {
        const chunkEnd = Math.min(currentTime + CHUNK_DURATION_SECONDS, totalDuration);
        const startIndex = Math.floor(currentTime * sampleRate);
        const endIndex = Math.floor(chunkEnd * sampleRate);
        
        const chunkPCM = pcmData.slice(startIndex, endIndex);
        const chunkWavBlob = encodeWAV(chunkPCM, sampleRate);

        console.log(`Processing chunk: ${currentTime.toFixed(1)}s to ${chunkEnd.toFixed(1)}s (Size: ${(chunkWavBlob.size / 1024 / 1024).toFixed(2)} MB)`);
        
        try {
            const segments = await processSingleChunk(ai, chunkWavBlob);
            
            // Adjust timestamps relative to the whole file
            const adjustedSegments = segments.map(seg => ({
                ...seg,
                id: `seg-${currentTime}-${seg.id}`,
                startTime: seg.startTime + currentTime,
                endTime: seg.endTime + currentTime
            }));

            allSegments = [...allSegments, ...adjustedSegments];
        } catch (err) {
            console.error(`Error processing chunk starting at ${currentTime}`, err);
            // If a specific chunk fails, we propagate the error to stop the process and alert the user, 
            // rather than producing a partial/broken subtitle file.
            throw new Error(`Failed to process audio segment at ${formatTime(currentTime)}. API Error.`);
        }

        currentTime = chunkEnd;
    }

    return allSegments.sort((a, b) => a.startTime - b.startTime);
}

// --- Utils ---

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
  
    const writeString = (view: DataView, offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
  
    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);
  
    // write PCM samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      let s = Math.max(-1, Math.min(1, samples[i]));
      s = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(offset, s, true);
      offset += 2;
    }
  
    return new Blob([view], { type: 'audio/wav' });
  }