
import { GoogleGenAI, Type } from "@google/genai";
import { InspectionData, InspectionStatus } from '../types';

const getAi = () => {
  if (!process.env.API_KEY) {
    console.error("API Key missing");
    return null;
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const processVoiceCommand = async (
  transcript: string, 
  currentSections: any[]
): Promise<{
  sectionId: string | null;
  itemId: string | null;
  status: InspectionStatus | null;
  comment: string | null;
  is24Hour: boolean;
  responsibility: 'Owner' | 'Tenant' | null;
  success: boolean;
}> => {
  const ai = getAi();
  if (!ai) return { success: false, sectionId: null, itemId: null, status: null, comment: null, is24Hour: false, responsibility: 'Owner' };

  // Map sections including item status for context awareness (crucial for 24h fail logic)
  const contextMap = currentSections.map(s => ({
    id: s.id,
    title: s.title,
    items: s.items.map((i: any) => ({ 
      id: i.id, 
      label: i.label,
      status: i.status
    }))
  }));

  const prompt = `
    You are an expert HQS (Housing Quality Standards) Inspection assistant. 
    The user is speaking an observation or providing a note during a HUD inspection.

    Current Form Structure & Status:
    ${JSON.stringify(contextMap).substring(0, 15000)} 

    User Input: "${transcript}"

    Your Tasks:
    1. Identify the most relevant Section ID and Item ID based on the input.
    2. Determine the status: PASS, FAIL, INCONCLUSIVE, or N/A.
    3. **CRITICAL: TRANSFORM THE COMMENT INTO STANDARD HQS DEFICIENCY LANGUAGE.**
       - If the status is FAIL, do NOT just transcribe the user. You must rewrite it into formal HUD deficiency language.
       - "The window is busted" -> "Severe window deterioration; broken glass/cutting hazard."
       - "Toilet won't flush" -> "Toilet inoperable; flush mechanism failure."
       - "No power in the outlet" -> "Inoperable outlet; failure to provide electricity."
       - "Cover plate missing" -> "Missing or broken cover plate; exposed electrical connections."
       - "Peeling paint" -> "Deteriorated paint surface; potential lead-based paint hazard."
    4. **Determine if this is a 24-Hour Fail** based on these STRICT rules:
       - **24-Hour Fails Include:**
         - No electricity (Unit-wide)
         - No running water (Unit-wide)
         - Electrical hazards (open plugs, exposed wires, frayed cords)
         - Security broken (exterior doors unlockable, accessible windows broken)
         - Serious cut hazards (broken glass)
         - No working toilet in unit (CRITICAL DISTINCTION: A toilet that is leaking or running is a regular FAIL, but is NOT "broken" for 24-hour purposes. A toilet is only considered "Not Working" if it is INOPERABLE/WILL NOT FLUSH. Logic: If the toilet is inoperable AND no other toilets in the unit are marked PASS, it is a 24-hour fail. If it is just leaking, it is NOT a 24-hour fail).
         - No working Smoke Detector (Check context: If OTHER smoke detectors are PASS, this is NOT 24-hour. If this is the only one, mark as 24-hour).
         - No working CO Detector (Check context: If OTHER CO detectors are PASS, this is NOT 24-hour).
    5. **Determine Responsibility:**
       - Default to 'Owner'.
       - If the user implies tenant negligence (e.g., "Tenant broke the door", "Hole in wall caused by tenant", "Tenant installed non-compliant lock"), set to 'Tenant'.
    
    Return JSON only.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sectionId: { type: Type.STRING },
            itemId: { type: Type.STRING },
            status: { type: Type.STRING },
            comment: { type: Type.STRING },
            is24Hour: { type: Type.BOOLEAN },
            responsibility: { type: Type.STRING, enum: ['Owner', 'Tenant'] }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No text returned");
    
    const result = JSON.parse(text);
    
    let statusEnum = InspectionStatus.PENDING;
    if (result.status?.toUpperCase() === 'PASS') statusEnum = InspectionStatus.PASS;
    if (result.status?.toUpperCase() === 'FAIL') statusEnum = InspectionStatus.FAIL;
    if (result.status?.toUpperCase() === 'N/A') statusEnum = InspectionStatus.NOT_APPLICABLE;
    if (result.status?.toUpperCase() === 'INCONCLUSIVE') statusEnum = InspectionStatus.INCONCLUSIVE;
    
    return {
      success: true,
      sectionId: result.sectionId || null,
      itemId: result.itemId || null,
      status: statusEnum,
      comment: result.comment || transcript,
      is24Hour: result.is24Hour || false,
      responsibility: (result.responsibility as 'Owner' | 'Tenant') || 'Owner'
    };

  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      success: false,
      sectionId: null,
      itemId: null,
      status: null,
      comment: null,
      is24Hour: false,
      responsibility: 'Owner'
    };
  }
};
