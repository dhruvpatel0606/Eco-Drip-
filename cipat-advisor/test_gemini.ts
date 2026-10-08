import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error('No API key found in .env');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(key);

async function test() {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    const result = await model.generateContent('Hi');
    console.log('SUCCESS gemini-1.5-pro:', result.response.text());
  } catch (e) {
    console.error('ERROR gemini-1.5-pro:', e.message);
  }

  try {
    const model2 = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result2 = await model2.generateContent('Hi');
    console.log('SUCCESS gemini-1.5-flash:', result2.response.text());
  } catch (e) {
    console.error('ERROR gemini-1.5-flash:', e.message);
  }

  try {
    const model4 = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: { 
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    });
    const result4 = await model4.generateContent(`Act as a Global Botanical Database API. Search for precise species info on: "apple".
    Return ONLY valid JSON.
    JSON Schema:
    {
      "name": "Botanical Name (Common Name)",
      "nameHi": "Common Name in Hindi",
      "nameGu": "Common Name in Gujarati",
      "category": "Cereal/Vegetable/Flower/Fruit",
      "watering": { "en": "Specific pattern", "hi": "हिंदी में विवरण", "gu": "ગુજરાતીમાં વર્ણન" },
      "difficulty": { "en": "Easy/Moderate/Hard", "hi": "आसान/मध्यम/कठिन", "gu": "સરળ/મધ્યમ/કઠિન" },
      "family": { "en": "Scientific family", "hi": "वैज्ञानिक परिवार", "gu": "વૈજ્ઞાનિક કુટુંબ" },
      "light": { "en": "Sun requirement", "hi": "धूप की आवश्यकता", "gu": "સૂર્યની જરૂરિયાત" },
      "desc": { "en": "1-sentence summary", "hi": "हिंदी में विवरण", "gu": "ગુજરાતીમાં સારાંશ" },
      "npk": "Ratio like 10-10-10",
      "pests": "Key pests list"
    }
    If the species is common in India (like Rose, Wheat, rice, etc), ensure high accuracy in Hindi/Gujarati.`);
    console.log('SUCCESS gemini-2.5-flash:', result4.response.text());
  } catch (e) {
    console.error('ERROR gemini-2.5-flash:', e.message);
  }
}

test();
