import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleGenAI, Modality } from '@google/genai';
import { WebSocketServer } from 'ws';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Initialize AI
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
    return text.replace(/^\`\`\`json\n?/, '').replace(/\n?\`\`\`$/, '').trim();
  }

  // OTP Authentication Backend System
  const otpStore = new Map<string, { otp: string; expiresAt: number; phone?: string; method?: string }>();

  function formatDiditPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned; // Assume India country code if 10 digits
    }
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    return cleaned;
  }

  // WhatsApp Client Setup & Helper Functions
  let whatsappClient: any = null;
  let isWhatsAppReady = false;

  function formatWhatsAppNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned; // Default to India country code if 10 digits
    }
    return cleaned + '@c.us';
  }

  async function initWhatsAppClient() {
    const method = process.env.WHATSAPP_METHOD || 'simulate';
    if (method !== 'whatsapp-web') {
      console.log('[WhatsApp] Operating in simulation mode (WHATSAPP_METHOD is not whatsapp-web).');
      return;
    }

    try {
      console.log('[WhatsApp] Initializing whatsapp-web.js...');
      // @ts-ignore
      const { Client, LocalAuth } = await import('whatsapp-web.js');
      // @ts-ignore
      const qrcode = await import('qrcode-terminal');

      whatsappClient = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      });

      whatsappClient.on('qr', (qr: string) => {
        console.log('\n============================================================');
        console.log('[WhatsApp] Scan this QR Code with your WhatsApp app (Linked Devices):');
        qrcode.generate(qr, { small: true });
        console.log(`QR Code Text: ${qr}`);
        console.log('============================================================\n');
      });

      whatsappClient.on('ready', () => {
        console.log('[WhatsApp] Client is successfully authenticated and ready!');
        isWhatsAppReady = true;
      });

      whatsappClient.on('auth_failure', (msg: any) => {
        console.error('[WhatsApp] Authentication failure:', msg);
        isWhatsAppReady = false;
      });

      whatsappClient.on('disconnected', (reason: any) => {
        console.log('[WhatsApp] Client was disconnected:', reason);
        isWhatsAppReady = false;
      });

      await whatsappClient.initialize();
    } catch (err: any) {
      console.warn('[WhatsApp] whatsapp-web.js setup failed. Running in simulation mode. Reason:', err.message);
    }
  }

  async function sendWhatsAppOtp(phone: string, otp: string): Promise<boolean> {
    const method = process.env.WHATSAPP_METHOD || 'simulate';
    const message = `Your Eco-Drip verification code is: ${otp}. It is valid for 5 minutes.`;
    
    if (method === 'whatsapp-web' && whatsappClient && isWhatsAppReady) {
      try {
        const chatId = formatWhatsAppNumber(phone);
        await whatsappClient.sendMessage(chatId, message);
        console.log(`[WhatsApp] OTP message successfully dispatched to ${chatId}`);
        return true;
      } catch (err: any) {
        console.error(`[WhatsApp] Failed to dispatch WhatsApp OTP:`, err.message);
      }
    }

    // Console Simulation Mode Fallback
    console.log(`\n============================================================`);
    console.log(`[WHATSAPP SIMULATOR] To: ${phone}`);
    console.log(`[WHATSAPP SIMULATOR] Code: ${otp}`);
    console.log(`[WHATSAPP SIMULATOR] Message: ${message}`);
    console.log(`============================================================\n`);
    return false;
  }

  function getEmailTransporter() {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    
    if (!user || !pass) {
      console.warn("EMAIL_USER or EMAIL_PASS not set. Email OTPs will be simulated in console.");
      return null;
    }
    
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: user,
        pass: pass
      }
    });
  }

  app.post('/api/auth/send-otp', async (req: any, res: any) => {
    try {
      const { email, phone, method } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
      
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 mins
      
      otpStore.set(email.toLowerCase(), { otp, expiresAt });
      console.log(`[OTP] Code ${otp} generated for ${email} (Method: ${method || 'email'})`);
      
      if (method === 'whatsapp') {
        if (!phone) {
          return res.status(400).json({ error: 'Phone number is required for WhatsApp verification' });
        }
        
        // Use Didit API if key is set
        const diditApiKey = process.env.DIDIT_API_KEY;
        if (diditApiKey && diditApiKey.trim()) {
          try {
            const formattedPhone = formatDiditPhoneNumber(phone);
            console.log(`[Didit WhatsApp] Requesting OTP code send to: ${formattedPhone}`);
            
            const response = await fetch('https://verification.didit.me/v3/phone/send/', {
              method: 'POST',
              headers: {
                'x-api-key': diditApiKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                phone_number: formattedPhone,
                options: {
                  code_size: 6,
                  preferred_channel: 'whatsapp',
                  locale: 'en-US'
                }
              })
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Didit API error: ${response.status} - ${errorText}`);
            }
            
            // Set the record in otpStore to know that we should verify via Didit
            otpStore.set(email.toLowerCase(), { 
              otp: 'DIDIT_VERIFIED_OUTSIDE', 
              expiresAt: Date.now() + 5 * 60 * 1000,
              phone: formattedPhone,
              method: 'didit'
            });
            
            return res.json({ 
              success: true, 
              simulated: false,
              message: 'WhatsApp verification code successfully dispatched.'
            });
          } catch (err: any) {
            console.warn(`[Didit WhatsApp] Send failed (${err.message}). Falling back to local/simulation mode.`);
            // Fall through to local simulation/whatsapp-web handler
          }
        }
        
        const sentReal = await sendWhatsAppOtp(phone, otp);
        const isSimulated = !sentReal;
        return res.json({ 
          success: true, 
          simulated: isSimulated, 
          otp: isSimulated ? otp : undefined, 
          message: isSimulated 
            ? 'WhatsApp OTP sent (simulated). Check server console.' 
            : 'WhatsApp OTP sent successfully.' 
        });
      }
      
      const transporter = getEmailTransporter();
      if (!transporter) {
        console.log(`[OTP SIMULATOR] To: ${email} | Code: ${otp}`);
        return res.json({ success: true, simulated: true, otp: otp, message: 'OTP sent (simulated). Check server console.' });
      }
      
      const mailOptions = {
        from: `"Eco-Drip Security" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Eco-Drip Authentication OTP Code',
        attachments: [{
          filename: 'icon.png',
          path: path.resolve('assets/icon.png'),
          cid: 'logo'
        }],
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>Eco-Drip Node Verification</title>
              <style>
                @media only screen and (max-width: 600px) {
                  .main-card {
                    padding: 32px 20px !important;
                    border-radius: 16px !important;
                  }
                }
                @keyframes pulse-glow {
                  0% { opacity: 0.3; transform: scale(0.98); }
                  50% { opacity: 0.7; transform: scale(1.02); }
                  100% { opacity: 0.3; transform: scale(0.98); }
                }
                @keyframes slide-fade {
                  from { transform: translateY(16px); opacity: 0; }
                  to { transform: translateY(0); opacity: 1; }
                }
                @keyframes bounce-in {
                  0% { transform: translateY(12px); opacity: 0; }
                  50% { transform: translateY(-3px); opacity: 0.8; }
                  100% { transform: translateY(0); opacity: 1; }
                }
                @keyframes border-glow {
                  0% { border-color: #27272a; box-shadow: 0 0 0 rgba(0, 242, 254, 0); }
                  50% { border-color: #00f2fe; box-shadow: 0 0 10px rgba(0, 242, 254, 0.4); }
                  100% { border-color: #27272a; box-shadow: 0 0 0 rgba(0, 242, 254, 0); }
                }
                .glow-circle {
                  animation: pulse-glow 3s infinite ease-in-out;
                }
                .content-card {
                  animation: slide-fade 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .otp-box {
                  animation: bounce-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards, border-glow 3s infinite ease-in-out;
                }
                .otp-box-1 { animation-delay: 0.1s, 0s; }
                .otp-box-2 { animation-delay: 0.2s, 0.5s; }
                .otp-box-3 { animation-delay: 0.3s, 1.0s; }
                .otp-box-4 { animation-delay: 0.4s, 1.5s; }
                .otp-box-5 { animation-delay: 0.5s, 2.0s; }
                .otp-box-6 { animation-delay: 0.6s, 2.5s; }
              </style>
            </head>
            <body style="background-color: #030303; margin: 0; padding: 0;">
              <div style="background-color: #030303; padding: 60px 20px; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" class="content-card" style="max-width: 480px; margin: 0 auto; background-color: #09090b; border: 1px solid #00f2fe; border-radius: 28px; overflow: hidden; border-collapse: separate; box-shadow: 0 20px 40px rgba(0, 242, 254, 0.15);">
                  <tr>
                    <td class="main-card" style="padding: 48px 32px; text-align: center;">
                      
                      <!-- Animated Glowing Logo Card (Project Logo Attached Inline) -->
                      <div style="position: relative; width: 80px; height: 80px; margin: 0 auto 28px auto; text-align: center;">
                        <!-- Pulse glow bg (shown in supporting mail clients) -->
                        <div class="glow-circle" style="position: absolute; top: -4px; left: -4px; right: -4px; bottom: -4px; border-radius: 20px; background: linear-gradient(135deg, #00f2fe 0%, #4facfe 50%, #00f2fe 100%); opacity: 0.3; filter: blur(8px);"></div>
                        <!-- Logo Card Wrapper -->
                        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; border-radius: 16px; background-color: #121214; border: 1px solid #00f2fe; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px rgba(0, 242, 254, 0.25);">
                          <img src="cid:logo" alt="Eco-Drip Logo" style="width: 52px; height: 52px; object-fit: contain; vertical-align: middle; border: 0;" />
                        </div>
                      </div>

                      <!-- Header -->
                      <h1 style="color: #ffffff; font-size: 24px; font-weight: 900; letter-spacing: -0.03em; margin: 0 0 8px 0; text-transform: uppercase; font-family: system-ui, sans-serif; text-shadow: 0 0 10px rgba(0, 242, 254, 0.4);">Eco-Drip</h1>
                      <div style="display: inline-block; font-size: 9px; font-weight: 800; color: #ffffff; background: linear-gradient(135deg, #0d9488 0%, #06b6d4 100%); border-radius: 9999px; padding: 6px 16px; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 32px; box-shadow: 0 0 15px rgba(6, 182, 212, 0.4);">
                        Node Verification
                      </div>

                      <!-- Text Block -->
                      <p style="color: #a1a1aa; font-size: 13px; line-height: 1.6; margin: 0 0 24px 0; font-weight: 500;">
                        Please verify your email address to establish your node on the Eco-Drip smart irrigation cloud. Use the temporary token below:
                      </p>

                      <!-- Digital Grid OTP with inline neon glow -->
                      <div style="margin: 24px 0; text-align: center;">
                        <table align="center" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                          <tr>
                            ${otp.split('').map((d, i) => `
                              <td style="padding: 0 4px;">
                                <div class="otp-box otp-box-${i+1}" style="width: 44px; height: 52px; line-height: 52px; text-align: center; background-color: #121214; border: 1.5px solid #00f2fe; border-radius: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 26px; font-weight: 900; color: #00f2fe; text-shadow: 0 0 8px rgba(0, 242, 254, 0.6); box-shadow: 0 0 12px rgba(0, 242, 254, 0.4), inset 0 1px 0 rgba(255,255,255,0.05);">${d}</div>
                              </td>
                            `).join('')}
                          </tr>
                        </table>
                      </div>

                      <!-- Typography Information / Security Tips -->
                      <div style="text-align: left; margin: 28px 0; background-color: #121214; border: 1px solid rgba(0, 242, 254, 0.25); border-radius: 16px; padding: 20px; box-shadow: 0 0 10px rgba(0, 242, 254, 0.05);">
                        <div style="font-size: 10px; font-weight: 800; color: #00f2fe; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 8px; font-family: system-ui, sans-serif; text-shadow: 0 0 5px rgba(0, 242, 254, 0.3);">Security Notice</div>
                        <p style="color: #a1a1aa; font-size: 13px; line-height: 1.5; margin: 0 0 12px 0; font-weight: 500;">
                          To safeguard your irrigation systems, please do not forward or share this code. Eco-Drip representatives will never ask for this token.
                        </p>
                        <p style="color: #71717a; font-size: 12px; line-height: 1.5; margin: 0; font-weight: 400; font-style: italic;">
                          Node configuration sequence initiated from a web interface.
                        </p>
                      </div>

                      <!-- Warning / Expiration -->
                      <p style="color: #71717a; font-size: 11px; margin: 28px 0 0 0; line-height: 1.5;">
                        This token is single-use and will expire in <strong style="color: #d4d4d8;">5 minutes</strong>.<br />
                        If you did not initiate this sequence, please ignore this transmission.
                      </p>

                      <!-- Divider -->
                      <div style="height: 1px; background-color: #1c1c1e; margin: 28px 0 20px 0;"></div>

                      <!-- Tech Details Footer -->
                      <div style="text-align: center; font-size: 9px; color: #3f3f46; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;">
                        Secure Authorization Link &bull; Node: ${email.toLowerCase()}
                      </div>
                      
                    </td>
                  </tr>
                </table>
              </div>
            </body>
          </html>
        `
      };
      
      await transporter.sendMail(mailOptions);
      return res.json({ success: true, simulated: false });
    } catch (err: any) {
      console.error('Failed to send OTP email:', err);
      return res.status(500).json({ error: `Failed to send email: ${err.message}` });
    }
  });

  app.post('/api/auth/verify-otp', async (req: any, res: any) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        return res.status(400).json({ error: 'Email and OTP code are required' });
      }
      
      const record = otpStore.get(email.toLowerCase());
      if (!record) {
        return res.status(400).json({ error: 'No active verification code found. Please request a new one.' });
      }
      
      if (Date.now() > record.expiresAt) {
        otpStore.delete(email.toLowerCase());
        return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
      }
      
      // Check if this session was verified using Didit API
      if (record.method === 'didit' && record.phone) {
        const diditApiKey = process.env.DIDIT_API_KEY;
        if (!diditApiKey) {
          return res.status(500).json({ error: 'Didit API key is missing on the server.' });
        }
        
        try {
          console.log(`[Didit WhatsApp] Verifying OTP code for phone: ${record.phone}`);
          const response = await fetch('https://verification.didit.me/v3/phone/check/', {
            method: 'POST',
            headers: {
              'x-api-key': diditApiKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              phone_number: record.phone,
              code: otp.trim()
            })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Didit API error: ${response.status} - ${errorText}`);
          }
          
          const result = await response.json();
          if (result.status !== 'Approved') {
            console.log(`[Didit WhatsApp] Verification failed. Status: ${result.status}`);
            return res.status(400).json({ error: `Invalid verification code or verification failed.` });
          }
        } catch (err: any) {
          console.error(`[Didit WhatsApp] Verification failed:`, err.message);
          return res.status(500).json({ error: `Didit verification failed: ${err.message}` });
        }
      } else {
        if (record.otp !== otp.trim()) {
          return res.status(400).json({ error: 'Invalid verification code. Please check and try again.' });
        }
      }
      
      // Success
      otpStore.delete(email.toLowerCase());
      
      const secret = process.env.SERVER_SECRET || 'eco-drip-fallback-secret-hash-key';
      const derivedPassword = crypto
        .createHmac('sha256', secret)
        .update(email.toLowerCase())
        .digest('hex')
        .substring(0, 16);
        
      return res.json({ success: true, password: derivedPassword });
    } catch (err: any) {
      console.error('OTP verify error:', err);
      return res.status(500).json({ error: err.message || 'Internal verification error' });
    }
  });

  // Middleware to authorize external API calls using Eco-Drip API Key
  const verifyEcoDripApiKey = (req: any, res: any, next: any) => {
    const serverApiKey = process.env.ECO_DRIP_API_KEY;
    if (!serverApiKey || !serverApiKey.trim()) {
      return next(); // Key not set on server, bypass verification
    }
    
    const clientKey = req.headers['x-ecodrip-api-key'] || req.headers['x-api-key'];
    if (!clientKey || clientKey.trim() !== serverApiKey.trim()) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid x-ecodrip-api-key header.' });
    }
    next();
  };

  // AI Endpoints
  app.post('/api/ai/advice', verifyEcoDripApiKey, async (req, res) => {
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
      const result = await model.generateContent(`Agricultural Intelligence Protocol:
  - Moisture Level: ${moisture}%
  - Environment: ${weather} (${temp}°C)
  
  Respond as Eco-Drip AI. Provide a professional, detailed irrigation recommendation based on these environmental parameters. Explain the scientific reasoning behind your advice. 
  IMPORTANT: You must respond fluently in ${language || 'the user\'s native language based on context'}.`);
      const response = await result.response;
      const text = cleanAIResponse(response.text());
      res.json({ text });
    } catch (error: any) {
      console.error('AI Advice Error:', error.message);
      res.status(500).json({ error: error.message || 'Internal AI Error' });
    }
  });

  app.post('/api/ai/chat', verifyEcoDripApiKey, async (req, res) => {
    try {
      const genAI = getGenAI();
      const { message, context, media, language } = req.body;

      if (!genAI) {
        return res.json({ text: "AI Core is currently offline. Please ensure the API_KEY is configured in the application secrets." });
      }

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const prompt = `Act as the Eco-Drip Neural Botanist, an advanced AI specialized in global agriculture and botany.
  Context: ${context}
  User Message: ${message}
  
  Instructions:
  - Use the conversation and farm telemetry above before answering; never ask for information the user already supplied.
  - Give evidence-based, practical agricultural guidance. Distinguish observations from assumptions and say what cannot be confirmed from a photo or description.
  - Lead with a direct recommendation. Then give 2–4 concise, actionable steps, including safe timing or quantities when the available data supports them.
  - For diagnoses, name the most likely cause, one or two alternatives, and the simplest low-risk confirmation step. Avoid claiming certainty from an image alone.
  - For safety-sensitive questions about pesticides, chemicals, food, animals or electrical equipment, include a short relevant safety caution.
  - If the user asks for a specific plant, include its botanical name, growth habits, watering needs, and a useful care detail.
  - Be warm, clear, and concise; use short sections or bullets only when they make the answer easier to act on.
  - IMPORTANT: Reply in the exact language used by the user. Their selected UI language is ${language || 'not provided'}, but the user message takes priority.`;

      let requestContent: any = prompt;
      if (media && media.base64 && media.mimeType) {
        const cleanBase64 = media.base64.replace(/^data:(image|video)\/\w+;base64,/, "");
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
      name: `${title} (Generated)`,
      nameHi: title,
      nameGu: title,
      category: category,
      watering: { en: wateringEn, hi: wateringHi, gu: wateringGu },
      difficulty: { en: difficultyEn, hi: difficultyHi, gu: difficultyGu },
      family: { en: familyEn, hi: familyHi, gu: familyGu },
      light: { en: lightEn, hi: lightHi, gu: lightGu },
      desc: { 
        en: `A popular ${category.toLowerCase()} species grown for agriculture or home gardening.`, 
        hi: `कृषि या घरेलू बागवानी के लिए उगाई जाने वाली एक लोकप्रिय ${category} प्रजाति।`,
        gu: `કૃષિ કે ઘરના બગીચા માટે ઉગાડવામાં આવતી એક લોકપ્રિય ${category} પ્રજાતિ.` 
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
      const result = await model.generateContent(`Act as a Global Botanical Database API. 
      Search for species info on: "${query}".
      
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
      If the species is common in India (like Rose, Wheat, rice, etc), ensure high accuracy in Hindi/Gujarati.`);
      
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

  app.post('/api/ai/foliage', verifyEcoDripApiKey, async (req, res) => {
    try {
      const genAI = getGenAI();
      const { base64, mime } = req.body;

      if (!genAI) {
        return res.json({ text: "Neural Scan complete. Chromatic analysis suggests stable chlorophyll. Morphological markers indicate a healthy specimen. Please connect neural suite for deep pathology diagnostics." });
      }

      const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");
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
    console.log(`Production mode: Serving static files from ${distPath}`);
    app.use(express.static(distPath));
    app.get(/.*/, (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Eco-Drip Server running on http://localhost:${PORT}`);
    initWhatsAppClient();
  });

  // Gemini Live stays server-side so the provider key is never exposed to the phone.
  // The browser has one WebSocket to this route; this server owns the second, persistent
  // WebSocket to Gemini Live and forwards only realtime media and events.
  const liveGateway = new WebSocketServer({ server: httpServer, path: '/api/live' });
  liveGateway.on('connection', (socket: any) => {
    let liveSession: any = null;
    let inputTranscript = '';
    let outputTranscript = '';

    const emit = (message: Record<string, unknown>) => {
      if (socket.readyState === 1) socket.send(JSON.stringify(message));
    };

    socket.on('message', async (raw: Buffer) => {
      try {
        const event = JSON.parse(raw.toString());
        if (event.type === 'start') {
          const key = (process.env.ECO_DRIP_NEURAL_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
          if (!key) throw new Error('Live AI is unavailable because the Gemini server key is not configured.');
          const ai = new GoogleGenAI({ apiKey: key });
          liveSession = await ai.live.connect({
            model: process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview',
            config: {
              responseModalities: [Modality.AUDIO],
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              enableAffectiveDialog: true,
              systemInstruction: `You are EcoBot, a helpful agricultural live assistant. Use the supplied conversation context. You can see live camera frames and hear the user. Be concise, conversational, and answer in the user's language. Do not mention internal systems. ${event.context || ''}`
            },
            callbacks: {
              onmessage: (message: any) => {
                const content = message.serverContent;
                if (!content) return;
                const input = content.inputTranscription?.text;
                const output = content.outputTranscription?.text;
                if (input) { inputTranscript += input; emit({ type: 'input_transcript', text: input }); }
                if (output) { outputTranscript += output; emit({ type: 'output_transcript', text: output }); }
                for (const part of content.modelTurn?.parts || []) {
                  if (part.inlineData?.data) emit({ type: 'audio', data: part.inlineData.data, mimeType: part.inlineData.mimeType });
                }
                if (content.interrupted) emit({ type: 'interrupted' });
                if (content.turnComplete) {
                  emit({ type: 'turn_complete', userText: inputTranscript.trim(), assistantText: outputTranscript.trim() });
                  inputTranscript = '';
                  outputTranscript = '';
                }
              },
              onerror: (error: any) => emit({ type: 'error', message: error?.message || 'Gemini Live connection error.' }),
              onclose: () => emit({ type: 'closed' })
            }
          });
          emit({ type: 'ready' });
          return;
        }
        if (!liveSession) throw new Error('Live AI session is not ready.');
        if (event.type === 'audio') liveSession.sendRealtimeInput({ audio: { data: event.data, mimeType: 'audio/pcm;rate=16000' } });
        if (event.type === 'video') liveSession.sendRealtimeInput({ video: { data: event.data, mimeType: 'image/jpeg' } });
        if (event.type === 'text') liveSession.sendRealtimeInput({ text: event.text });
        if (event.type === 'end') liveSession.close();
      } catch (error: any) {
        emit({ type: 'error', message: error.message || 'Unable to process Live AI event.' });
      }
    });
    socket.on('close', () => { try { liveSession?.close(); } catch { /* session already closed */ } });
  });
}

startServer();
