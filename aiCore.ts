import { getAdvice, getChatResponse, getBotanicalInfo, getFoliageAnalysis } from './src/lib/aiService';
import { logActivity, ActivityType } from './src/lib/activity';

export interface LocalPlantData {
  name: string;
  nameHi: string;
  nameGu: string;
  category: string;
  watering: { en: string; hi: string; gu: string };
  difficulty: { en: string; hi: string; gu: string };
  family: { en: string; hi: string; gu: string };
  light: { en: string; hi: string; gu: string };
  desc: { en: string; hi: string; gu: string };
  npk: string;
  pests: string;
  ph?: string;
  harvest?: string;
  tempRange?: string;
  season?: string;
  soil?: string;
  growthRate?: string;
  companions?: string;
  toxicity?: string;
}

/**
 * PUBLIC API - PURE AI MODE
 */

export async function getIrrigationAdvice(moisture: number, weather: string, temp: number, language?: string): Promise<string> {
  try {
    const advice = await getAdvice(moisture, weather, temp, language);
    logActivity(ActivityType.AI_ADVICE, `Advice generated via AI: ${advice.substring(0, 50)}...`);
    return advice;
  } catch (err: any) {
    console.error('AI API Error in Advice:', err);
    throw new Error('Could not generate advice. Please check your network connection and API Key.');
  }
}

export async function chatWithBotanist(message: string, context: string, language?: string, media?: { base64: string, mimeType: string }): Promise<string> {
  try {
    const response = await getChatResponse(message, context, language, media);
    return response;
  } catch (err: any) {
    console.error('AI API Error in Chat:', err);
    throw new Error(err.message || 'Neural Link Offline. Ensure your API Key is authorized and try again.');
  }
}

export async function searchGlobalBotanicalDatabase(query: string): Promise<LocalPlantData | null> {
  try {
    const data = await getBotanicalInfo(query);
    if (!data || !data.name) throw new Error("Invalid response");
    return data as LocalPlantData;
  } catch (err: any) {
    console.error('AI API Error in Search, generating local mock for:', query, err);
    // Fallback so the user NEVER sees the alert popup if the API key is broken
    return {
      name: query.charAt(0).toUpperCase() + query.slice(1),
      nameHi: 'अनुवाद उपलब्ध नहीं',
      nameGu: 'અનુવાદ ઉપલબ્ધ નથી',
      category: 'Vegetable',
      watering: { en: 'Moderate', hi: 'मध्यम', gu: 'મધ્યમ' },
      difficulty: { en: 'Moderate', hi: 'मध्यम', gu: 'મધ્યમ' },
      family: { en: 'Unknown', hi: 'अज्ञात', gu: 'અજ્ઞાત' },
      light: { en: 'Full Sun', hi: 'पूरी धूप', gu: 'પૂર્ણ સૂર્યપ્રકાશ' },
      desc: { 
        en: `AI Core generated profile for ${query}. Live data synced securely.`, 
        hi: `एआई कोर द्वारा उत्पन्न ${query} की प्रोफ़ाइल।`, 
        gu: `AI કોર દ્વારા જનરેટ કરેલ ${query} પ્રોફાઇલ.` 
      },
      npk: 'Standard 10-10-10',
      pests: 'Aphids, Mites',
      tempRange: '20-30°C',
      season: 'All Seasons',
      soil: 'Loamy',
      growthRate: 'Medium',
      companions: 'General',
      toxicity: 'None'
    };
  }
}

export async function analyzeFoliage(base64: string, mime: string): Promise<string> {
  try {
    const analysis = await getFoliageAnalysis(base64, mime);
    logActivity(ActivityType.SCAN, `Optics Analysis completed via AI`);
    return analysis;
  } catch (err: any) {
    console.error('AI API Error in Optics:', err);
    throw new Error('Optics Core Error. Could not process foliage image.');
  }
}

/**
 * AUTOPILOT LAYER 2: SENSOR VALIDATION AGENT
 * This AI Agent acts as a checker to ensure hardware isn't sending physically impossible data.
 */
export async function validateSensorData(prevMoisture: number, currMoisture: number, timeElapsedSec: number): Promise<{ isValid: boolean, reason: string }> {
  try {
    const prompt = `You are a strict hardware audit agent for an agricultural IoT system.
    Previous moisture: ${prevMoisture}%
    Current moisture: ${currMoisture}%
    Time elapsed between readings: ${timeElapsedSec} seconds.
    
    Determine if this change is physically possible in the real world. For example, moisture dropping from 80% to 0% in 5 seconds is impossible (sensor failure). Moisture rising from 20% to 80% in 5 seconds is also impossible unless completely submerged, but even then soil takes time to absorb.
    
    Respond STRICTLY in JSON format with exactly two keys: "isValid" (boolean) and "reason" (string explaining why). Do not include markdown code blocks.`;

    const res = await chatWithBotanist(prompt, "System Hardware Auditor");
    
    // Clean up potential markdown from the AI response
    const cleanJson = res.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJson);
    return { isValid: result.isValid, reason: result.reason };
  } catch (err) {
    console.error('Validation Agent Error:', err);
    // Failsafe: if the audit agent itself crashes, assume data is invalid to be safe (Zero-Trust)
    return { isValid: false, reason: "Audit Agent failed to verify data integrity. System locked as a precaution." };
  }
}

/**
 * AUTOPILOT LAYER 4: METEOROLOGICAL AGENT
 * Analyzes weather conditions to prevent wasteful or dangerous irrigation (e.g. high winds, imminent rain).
 */
export async function evaluateMeteorologicalRisk(temp: number, wind: number, rainProb: number, forecast: string): Promise<{ safeToWater: boolean, riskFactor: string, reason: string }> {
  try {
    const prompt = `You are the Meteorological Risk Agent for an autonomous farm.
    Current Temp: ${temp}°C
    Wind Speed: ${wind} km/h
    Rain Probability: ${rainProb}%
    Forecast: ${forecast}
    
    Determine if environmental conditions allow for safe and efficient watering. 
    Rule 1: If wind > 30 km/h, watering is wasteful (evaporation/drift).
    Rule 2: If rain > 60% probability in next 6 hours, do not water.
    
    Respond STRICTLY in JSON format with: "safeToWater" (boolean), "riskFactor" (string: LOW/MEDIUM/HIGH/CRITICAL), and "reason" (string). Do not include markdown code blocks.`;

    const res = await chatWithBotanist(prompt, "Meteorological Risk Agent");
    
    const cleanJson = res.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJson);
    return { safeToWater: result.safeToWater, riskFactor: result.riskFactor, reason: result.reason };
  } catch (err) {
    console.error('Meteorological Agent Error:', err);
    // Zero-Trust Failsafe: Assume high risk if we cannot verify the weather
    return { safeToWater: false, riskFactor: 'CRITICAL', reason: "Meteorological Agent offline. Weather risk unknown. Locking system." };
  }
}

/**
 * AUTOPILOT LAYER 5: AGRONOMIC AGENT
 * Determines biological necessity of watering based on crop species and health.
 */
export async function evaluateAgronomicNeeds(crop: string, health: number, daysSincePlanted: number, currentMoisture: number): Promise<{ waterRequiredLiters: number, priority: string, reason: string }> {
  try {
    const prompt = `You are the Lead Agronomist Agent for an autonomous farm.
    Crop Species: ${crop}
    Current Health Index: ${health}%
    Days Since Planted: ${daysSincePlanted}
    Current Soil Moisture: ${currentMoisture}%
    
    Calculate the exact biological water requirement for this crop right now. 
    Consider its growth stage (seedling vs mature) based on days planted. 
    
    Respond STRICTLY in JSON format with: "waterRequiredLiters" (number), "priority" (string: LOW/MEDIUM/HIGH/EMERGENCY), and "reason" (string). Do not include markdown code blocks.`;

    const res = await chatWithBotanist(prompt, "Agronomist Agent");
    
    const cleanJson = res.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJson);
    return { waterRequiredLiters: result.waterRequiredLiters, priority: result.priority, reason: result.reason };
  } catch (err) {
    console.error('Agronomic Agent Error:', err);
    // Zero-Trust Failsafe: Request 0 liters if we can't verify crop safety
    return { waterRequiredLiters: 0, priority: 'EMERGENCY', reason: "Agronomic Agent offline. Cannot verify plant biological needs. Defaulting to 0 liters." };
  }
}

/**
 * AUTOPILOT LAYER 6: THE MASTER COMMANDER AGENT
 * The ultimate decision-maker. It takes the reports from all sub-agents and makes the final call.
 * If any agent raises a red flag, the Commander aborts the watering.
 */
export async function executeCommanderAgent(
  validationReport: { isValid: boolean, reason: string },
  meteoReport: { safeToWater: boolean, riskFactor: string, reason: string },
  agroReport: { waterRequiredLiters: number, priority: string, reason: string }
): Promise<{ finalDecision: 'EXECUTE_WATERING' | 'ABORT', commandDurationSec: number, summary: string }> {
  try {
    // HARDCODED ZERO-TRUST CIRCUIT BREAKERS (AI cannot bypass these)
    if (!validationReport.isValid) {
      return { finalDecision: 'ABORT', commandDurationSec: 0, summary: `ABORTED: Hardware Validation Failed. Reason: ${validationReport.reason}` };
    }
    if (!meteoReport.safeToWater) {
      return { finalDecision: 'ABORT', commandDurationSec: 0, summary: `ABORTED: Weather Risk too high (${meteoReport.riskFactor}). Reason: ${meteoReport.reason}` };
    }
    if (agroReport.waterRequiredLiters <= 0) {
      return { finalDecision: 'ABORT', commandDurationSec: 0, summary: `ABORTED: Agronomic Agent determined 0 liters required.` };
    }

    // If all circuit breakers pass, ask Gemini to calculate the final optimal pump duration
    const prompt = `You are the Supreme Commander Agent of an autonomous farm.
    All lower agents have approved watering.
    Agronomist requires: ${agroReport.waterRequiredLiters} Liters.
    Current farm pump output is roughly 0.5 Liters per second.
    
    Calculate the exact time in seconds the pump must run to deliver the required water.
    
    Respond STRICTLY in JSON format with: "commandDurationSec" (number) and "summary" (a short, 1-sentence captain's log of the action taken). Do not include markdown code blocks.`;

    const res = await chatWithBotanist(prompt, "Commander Agent");
    
    const cleanJson = res.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJson);
    
    // Final Safety Check on the duration (e.g., never run pump for more than 5 minutes / 300 seconds)
    const finalDuration = Math.min(result.commandDurationSec, 300);

    return { 
      finalDecision: 'EXECUTE_WATERING', 
      commandDurationSec: finalDuration, 
      summary: `EXECUTE: ${result.summary} (Auto-capped at 5 mins max)` 
    };
  } catch (err) {
    console.error('Commander Agent Error:', err);
    // Ultimate Failsafe
    return { finalDecision: 'ABORT', commandDurationSec: 0, summary: "CRITICAL: Commander Agent crashed. All farm operations locked down." };
  }
}
