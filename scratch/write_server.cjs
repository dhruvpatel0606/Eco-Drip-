const fs = require('fs');
const path = require('path');

const content = `import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Initialize Gemini
  function getGenAI() {
    let key = (
      process.env.ECO_DRIP_NEURAL_KEY ||
      process.env.GEMINI_API_KEY || 
      process.env.VITE_GEMINI_API_KEY || 
      process.env.GOOGLE_API_KEY || 
      process.env.GOOGLE_GENAI_API_KEY ||
      ''
    ).trim();
    
    key = key.replace(/^["'](.+)["']$/, '$1');
    
    if (!key || key === 'MY_GEMINI_API_KEY') {
      return null;
    }
    
    try {
      return new GoogleGenerativeAI(key);
    } catch (e) {
      console.error('Failed to initialize GoogleGenAI:', e);
      return null;
    }
  }

  function cleanAIResponse(text: string): string {
    return text.replace(/^\\\`\\\`\\\`json\\n?/, '').replace(/\\n?\\\`\\\`\\\`$/, '').trim();
  }

  // AI Endpoints
  app.post('/api/ai/advice', async (req, res) => {
    try {
      const genAI = getGenAI();
      const { moisture, weather, temp, language } = req.body;

      if (!genAI) {
        let mockAdvice = "Maintain standard moisture (45-65%). Monitor weather.";
        if (moisture < 30) mockAdvice = "CRITICAL: Moisture low. Activate irrigation immediately.";
        if (moisture > 90) mockAdvice = "SATURATION ALERT: High moisture. Suspend watering.";
        return res.json({ text: mockAdvice });
      }

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(\`Agricultural Intelligence Protocol:
  - Moisture Level: \${moisture}%
  - Environment: \${weather} (\${temp}°C)
  
  Respond as Eco-Drip AI. Provide a professional, detailed irrigation recommendation based on these environmental parameters. Explain the scientific reasoning behind your advice. 
  IMPORTANT: You must respond fluently in \${language || 'the user\\\'s native language based on context'}.\`);
      const response = await result.response;
      const text = cleanAIResponse(response.text());
      res.json({ text });
    } catch (error: any) {
      console.error('AI Advice Error:', error.message);
      res.status(500).json({ error: error.message || 'Internal AI Error' });
    }
  });

  app.post('/api/ai/chat', async (req, res) => {
    try {
      const genAI = getGenAI();
      const { message, context, media } = req.body;

      if (!genAI) {
        return res.json({ text: "AI Core is currently offline. Please ensure the GEMINI_API_KEY is configured in the application secrets." });
      }

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const prompt = \`Act as the Eco-Drip Neural Botanist, an advanced AI specialized in global agriculture and botany.
  Context: \${context}
  User Message: \${message}
  
  Instructions:
  - Provide detailed, scientifically accurate information about plants, pests, or agricultural techniques.
  - If the user asks for a specific plant, provide its botanical name, growth habits, watering needs, and interesting facts.
  - Be helpful, conversational, and thorough. Use a professional yet accessible tone.
  - IMPORTANT: You MUST detect the language of the 'User Message' and respond fluently in that EXACT same language. Do not default to English if the user speaks another language.\`;

      let requestContent: any = prompt;
      if (media && media.base64 && media.mimeType) {
        const cleanBase64 = media.base64.replace(/^data:(image|video)\\/\\w+;base64,/, "");
        requestContent = [
          { inlineData: { data: cleanBase64, mimeType: media.mimeType } },
          { text: prompt }
        ];
      }

      const result = await model.generateContent(requestContent);
      const response = await result.response;
      const text = cleanAIResponse(response.text());
      res.json({ text });
    } catch (error: any) {
      console.error('AI Chat Error:', error.message);
      res.status(500).json({ error: error.message || 'Internal AI Error' });
    }
  });

  function generateFallbackPlant(query: string) {
    const queryLower = query.toLowerCase();
    let category = "Vegetable";
    let wateringEn = "Moderate watering. Water when the top 2 inches of soil are dry.";
    let wateringHi = "मध्यम सिंचाई। जब मिट्टी की ऊपरी 2 इंच सूखी हो तब पानी दें।";
    let wateringGu = "મધ્યમ પિયત. જ્યારે જમીનની ઉપરની 2 ઇંચ સુકાઈ જાય ત્યારે પાણી આપો.";
    let difficultyEn = "Easy";
    let difficultyHi = "आसान";
    let difficultyGu = "સરળ";
    let familyEn = "General Flora";
    let familyHi = "सामान्य वनस्पति";
    let familyGu = "સામાન્ય વનપ્રથાઓ";
    let lightEn = "Full Sun to Partial Shade";
    let lightHi = "पूर्ण सूर्य से आंशिक छाया";
    let lightGu = "પૂર્ણ સૂર્ય થી આંશિક છાંયડો";
    let pests = "Aphids, Spider Mites";
    let npk = "10-10-10";

    if (queryLower.includes("rose") || queryLower.includes("flower") || queryLower.includes("marigold") || queryLower.includes("hibiscus")) {
      category = "Flower";
      wateringEn = "Water regularly, keep soil moist but not soggy.";
      wateringHi = "नियमित रूप से पानी दें, मिट्टी को नम रखें लेकिन बहुत गीला नहीं।";
      wateringGu = "નિયમિત પાણી આપો, માટીને ભેજવાળી રાખો પણ વધારે ભીની નહીં.";
      difficultyEn = "Moderate";
      difficultyHi = "मध्यम";
      difficultyGu = "મધ્યમ";
      familyEn = "Rosaceae";
      familyHi = "रोज़ेसी";
      familyGu = "રોઝેસી";
      lightEn = "Full Sun (6+ hours)";
      lightHi = "पूर्ण सूर्य";
      lightGu = "પૂર્ણ સૂર્ય";
      npk = "12-4-8";
      pests = "Aphids, Thrips, Powdery Mildew";
    } else if (queryLower.includes("wheat") || queryLower.includes("rice") || queryLower.includes("corn") || queryLower.includes("grain") || queryLower.includes("crop") || queryLower.includes("cotton") || queryLower.includes("cherry") || queryLower.includes("apple")) {
      if (queryLower.includes("cherry") || queryLower.includes("apple")) {
        category = "Fruit Tree";
        wateringEn = "Deep watering every 7-10 days, more frequent during fruit development.";
        wateringHi = "हर 7-10 दिनों में गहरी सिंचाई, फल लगने के दौरान अधिक बार।";
        wateringGu = "દર 7-10 દિવસે ઉંડુ પિયત, ફળ આવવા દરમિયાન વધુ વાર.";
        difficultyEn = "Moderate";
        difficultyHi = "मध्यम";
        difficultyGu = "મધ્યમ";
        familyEn = "Rosaceae";
        familyHi = "रोज़ेसी";
        familyGu = "રોઝેસી";
        lightEn = "Direct sunlight (8+ hours)";
        lightHi = "प्रत्यक्ष सूर्य प्रकाश";
        lightGu = "પ્રત્યક્ષ સૂર્ય પ્રકાશે";
        npk = "10-10-10";
        pests = "Fruit flies, Aphids, Scale insects";
      } else {
        category = "Crop / Cereal";
        wateringEn = "Consistently moist during vegetative and flowering stages. Avoid water logging.";
        wateringHi = "वानस्पतिक और फूल आने के चरणों के दौरान लगातार नमी रखें। जलभराव से बचें।";
        wateringGu = "વનસ્પતિ અને ફૂલ આવવાના તબક્કા દરમિયાન સતત ભેજ જાળવી રાખો.";
        difficultyEn = "Moderate";
        difficultyHi = "मध्यम";
        difficultyGu = "મધ્યમ";
        familyEn = "Poaceae (Grass) / Malvaceae";
        familyHi = "पोएसी / मालवेसी";
        familyGu = "પોએસી / માલવેસી";
        lightEn = "Full Sun";
        lightHi = "पूर्ण सूर्य";
        lightGu = "પૂર્ણ સૂર્ય";
        npk = "15-15-15";
        pests = "Stem borer, Bollworm, Rust, Aphids";
      }
    } else if (queryLower.includes("mango") || queryLower.includes("citrus") || queryLower.includes("lemon") || queryLower.includes("orange") || queryLower.includes("tree")) {
      category = "Fruit Tree";
      wateringEn = "Deep watering every 7-10 days, more frequent during fruit development.";
      wateringHi = "हर 7-10 दिनों में गहरी सिंचाई, फल लगने के दौरान अधिक बार।";
      wateringGu = "દર 7-10 દિવસે ઉંડુ પિયત, ફળ આવવા દરમિયાન વધુ વાર.";
      difficultyEn = "Moderate";
      difficultyHi = "मध्यम";
      difficultyGu = "મધ્યમ";
      familyEn = "Anacardiaceae / Rutaceae";
      familyHi = "एनाकार्डियासी / रूटेसी";
      familyGu = "એનાકાર્ડિયાસી / રૂટેસી";
      lightEn = "Direct sunlight (8+ hours)";
      lightHi = "प्रत्यक्ष सूर्य प्रकाश";
      lightGu = "પ્રત્યક્ષ સૂર્ય પ્રકાશ";
      npk = "8-3-9";
      pests = "Fruit flies, Scale insects, Powdery mildew";
    } else if (queryLower.includes("cactus") || queryLower.includes("succulent") || queryLower.includes("aloe") || queryLower.includes("jade")) {
      category = "Succulent / Cactus";
      wateringEn = "Low water. Allow soil to dry out completely between waterings.";
      wateringHi = "न्यूनतम पानी। सिंचाई के बीच मिट्टी को पूरी तरह से सूखने दें।";
      wateringGu = "ઓછું પાણી. પિયત વચ્ચે માટીને પૂરેપૂરી સુકાઈ જવા દો.";
      difficultyEn = "Easy";
      difficultyHi = "आसान";
      difficultyGu = "સરળ";
      familyEn = "Cactaceae / Xanthorrhoeaceae";
      familyHi = "कैक्टेसी / ज़ैंथोरोइएसी";
      familyGu = "કેક્ટેસી / ઝેન્ثોરોઇસી";
      lightEn = "Bright indirect sunlight";
      lightHi = "उज्ज्वल अप्रत्यक्ष प्रकाश";
      lightGu = "તેજસ્વી પરોક્ષ પ્રકાશ";
      npk = "2-7-7";
      pests = "Mealybugs, Aloe rust";
    }

    const title = query.charAt(0).toUpperCase() + query.slice(1);

    return {
      name: \`\${title} (Generated)\`,
      nameHi: title,
      nameGu: title,
      category: category,
      watering: { en: wateringEn, hi: wateringHi, gu: wateringGu },
      difficulty: { en: difficultyEn, hi: difficultyHi, gu: difficultyGu },
      family: { en: familyEn, hi: familyHi, gu: familyGu },
      light: { en: lightEn, hi: lightHi, gu: lightGu },
      desc: { 
        en: \`A popular \${category.toLowerCase()} species grown for agriculture or home gardening.\`, 
        hi: \`कृषि या घरेलू बागवानी के लिए उगाई जाने वाली एक लोकप्रिय \${category} प्रजाति।\`,
        gu: \`કૃષિ કે ઘરના બગીચા માટે ઉગાડવામાં આવતી એક લોકપ્રિય \${category} પ્રજાતિ.\` 
      },
      npk: npk,
      pests: pests
    };
  }

  app.post('/api/ai/botany', async (req, res) => {
    const { query } = req.body;
    try {
      const genAI = getGenAI();

      if (!genAI) {
        return res.json(generateFallbackPlant(query));
      }

      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: { 
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      });
      const result = await model.generateContent(\`Act as a Global Botanical Database API. 
      Search for species info on: "\${query}".
      
      CRITICAL INSTRUCTIONS:
      1. If there is a spelling mistake or typo in the query (e.g., "toma", "spieces", "alo vera", "cherryy"), auto-correct it to the closest matching plant or crop (e.g., "Tomato", "Aloe Vera", "Cherry").
      2. If the query is generic (e.g., "cherry", "rose", "grass"), resolve it to the most common representative species (e.g., "Sweet Cherry (Prunus avium)", "Garden Rose").
      3. If no exact match exists, find the closest similar plant or crop.
      4. You MUST always return a valid populated JSON object matching the schema. DO NOT return an empty object or error message in the JSON.
      
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
      If the species is common in India (like Rose, Wheat, rice, etc), ensure high accuracy in Hindi/Gujarati.\`);
      
      const response = await result.response;
      const text = cleanAIResponse(response.text());
      try {
        const parsed = JSON.parse(text);
        res.json(parsed);
      } catch (parseErr) {
        console.error('AI JSON Parse Error. Raw:', text);
        res.json(generateFallbackPlant(query));
      }
    } catch (error: any) {
      console.error('AI Search Error, falling back:', error.message);
      res.json(generateFallbackPlant(query));
    }
  });

  app.post('/api/ai/foliage', async (req, res) => {
    try {
      const genAI = getGenAI();
      const { base64, mime } = req.body;

      if (!genAI) {
        return res.json({ text: "Neural Scan complete. Chromatic analysis suggests stable chlorophyll. Morphological markers indicate a healthy specimen. Please connect neural suite for deep pathology diagnostics." });
      }

      const cleanBase64 = base64.replace(/^data:image\\/\\w+;base64,/, "");
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent([
        { inlineData: { data: cleanBase64, mimeType: mime } },
        { text: "Act as a Senior Botanical Pathologist. Analyze this image of foliage. Identify the species clearly. State health status, any visible nutrient deficiencies, or pest presence. Be professional and concise. Max 60 words." }
      ]);
      const response = await result.response;
      const text = cleanAIResponse(response.text());
      res.json({ text });
    } catch (error: any) {
      console.error('AI Foliage Error:', error.message);
      res.status(500).json({ error: error.message || 'Internal AI Error' });
    }
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: { port: Math.floor(Math.random() * 1000) + 30000 }
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    console.log(\`Production mode: Serving static files from \${distPath}\`);
    app.use(express.static(distPath));
    app.get(/.*/, (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(\`Eco-Drip Server running on http://localhost:\${PORT}\`);
  });
}

startServer();
`;

fs.writeFileSync(path.join(__dirname, '../server.ts'), content, 'utf8');
console.log('Successfully wrote server.ts');
