
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getIrrigationAdvice(
  soilMoisture: number, 
  weather: string, 
  temperature: number,
  plantType: string = "general garden plants"
) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `My soil moisture is currently ${soilMoisture}%. The weather is ${weather} with a temperature of ${temperature}°C. I am growing ${plantType}. Should I irrigate now? Give me a concise recommendation and a tip for water conservation.`,
      config: {
        systemInstruction: "You are an expert horticultural assistant specializing in smart irrigation. Provide brief, actionable, and scientific advice.",
        temperature: 0.7,
      },
    });

    return response.text || "I'm unable to provide advice right now. Please check your sensor data manually.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error connecting to AI Assistant. Please try again later.";
  }
}

export async function chatWithBotanist(message: string, context: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Context: ${context}\n\nUser Question: ${message}`,
      config: {
        systemInstruction: "You are 'EcoBot', a friendly AI botanist. You help users manage their smart irrigation systems and care for their plants.",
      },
    });
    return response.text;
  } catch (error) {
    return "I'm having trouble thinking right now. Could you ask again?";
  }
}
