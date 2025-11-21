
import { InspectionStatus } from '../types';

type GenAiModule = typeof import('@google/genai');
type GoogleGenAIClient = InstanceType<GenAiModule['GoogleGenAI']>;

const AI_PROXY_URL = import.meta.env.VITE_AI_PROXY_URL || '/api/ai/voice-command';
const AI_PROXY_KEY = import.meta.env.VITE_AI_PROXY_KEY || '';
const FRONTEND_GEMINI_API_KEY =
  import.meta.env.VITE_GEMINI_API_KEY ||
  import.meta.env.VITE_API_KEY ||
  '';

let genAiModulePromise: Promise<GenAiModule> | null = null;
const loadGenAiModule = () => {
  if (!genAiModulePromise) {
    genAiModulePromise = import('@google/genai');
  }
  return genAiModulePromise;
};

let cachedAiClient: GoogleGenAIClient | null = null;

const getAi = async () => {
  if (!FRONTEND_GEMINI_API_KEY) {
    console.error('Missing VITE_GEMINI_API_KEY for fallback AI processing');
    return null;
  }
  if (cachedAiClient) return cachedAiClient;
  const { GoogleGenAI } = await loadGenAiModule();
  cachedAiClient = new GoogleGenAI({ apiKey: FRONTEND_GEMINI_API_KEY });
  return cachedAiClient;
};

const mapStatus = (status?: string | null): InspectionStatus | null => {
  if (!status) return InspectionStatus.PENDING;
  const normalized = status.toUpperCase();
  if (normalized === 'PASS') return InspectionStatus.PASS;
  if (normalized === 'FAIL') return InspectionStatus.FAIL;
  if (normalized === 'N/A' || normalized === 'NOT_APPLICABLE') {
    return InspectionStatus.NOT_APPLICABLE;
  }
  if (normalized === 'INCONCLUSIVE') return InspectionStatus.INCONCLUSIVE;
  return InspectionStatus.PENDING;
};

const buildProxyHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  const token = typeof window !== 'undefined' ? localStorage.getItem('hqs_token') : null;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (AI_PROXY_KEY) {
    headers['x-api-key'] = AI_PROXY_KEY;
  }
  return headers;
};

const callProxy = async (transcript: string, sections: any[]) => {
  const response = await fetch(AI_PROXY_URL, {
    method: 'POST',
    headers: buildProxyHeaders(),
    body: JSON.stringify({ transcript, sections })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI proxy error: ${response.status} ${errorText}`);
  }

  return response.json();
};

const callGeminiDirect = async (transcript: string, sections: any[]) => {
  const ai = await getAi();
  if (!ai) {
    throw new Error('Gemini client not configured');
  }

  const contextMap = sections.map((s: any) => ({
    id: s.id,
    title: s.title,
    items: s.items.map((i: any) => ({
      id: i.id,
      label: i.label,
      status: i.status
    }))
  }));

  const prompt = `
    You are an HQS (Housing Quality Standards) Inspection assistant. 
    The user is speaking an observation or providing a note.

    Current Form Structure & Status:
    ${JSON.stringify(contextMap).substring(0, 15000)}

    User Input: "${transcript}"

    Your Tasks:
    1. Identify the most relevant Section ID and Item ID.
    2. Determine the status: PASS, FAIL, INCONCLUSIVE, or N/A.
    3. Summarize the input into professional HQS short-form language (<= 220 characters).
    4. Determine if this is a 24-Hour Fail.
    5. Determine Responsibility (owner vs tenant). Default owner.

    Return JSON only with keys:
    sectionId, itemId, status, comment, is24Hour, responsibility
  `;

  const { Type } = await loadGenAiModule();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sectionId: { type: Type.STRING },
          itemId: { type: Type.STRING },
          status: { type: Type.STRING },
          comment: { type: Type.STRING },
          is24Hour: { type: Type.BOOLEAN },
          responsibility: { type: Type.STRING, enum: ['owner', 'tenant'] }
        }
      }
    }
  });

  const text = response.text;
  if (!text) {
    throw new Error('Gemini returned empty response');
  }

  return JSON.parse(text);
};

const normalizeResult = (
  result: any,
  transcript: string
): {
  sectionId: string | null;
  itemId: string | null;
  status: InspectionStatus | null;
  comment: string | null;
  is24Hour: boolean;
  responsibility: 'owner' | 'tenant' | null;
  success: boolean;
} => ({
  success: true,
  sectionId: result.sectionId || null,
  itemId: result.itemId || null,
  status: mapStatus(result.status),
  comment: result.comment || transcript,
  is24Hour: Boolean(result.is24Hour),
  responsibility: result.responsibility === 'tenant' ? 'tenant' : 'owner'
});

export const processVoiceCommand = async (
  transcript: string,
  currentSections: any[]
) => {
  // Try proxy first
  if (AI_PROXY_URL) {
    try {
      const proxyResult = await callProxy(transcript, currentSections);
      return normalizeResult(proxyResult, transcript);
    } catch (proxyError) {
      console.warn('AI proxy failed, falling back to local Gemini:', proxyError);
    }
  }

  // Fallback to direct Gemini call
  try {
    const fallbackResult = await callGeminiDirect(transcript, currentSections);
    return normalizeResult(fallbackResult, transcript);
  } catch (error) {
    console.error('Gemini Error:', error);
    return {
      success: false,
      sectionId: null,
      itemId: null,
      status: null,
      comment: null,
      is24Hour: false,
      responsibility: 'owner'
    };
  }
};
