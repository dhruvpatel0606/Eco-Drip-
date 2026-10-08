const getApiKey = () => {
  let key = '';
  try {
    key = import.meta.env.VITE_GEMINI_API_KEY ||
          import.meta.env.VITE_GOOGLE_API_KEY ||
          import.meta.env.VITE_ECO_DRIP_NEURAL_KEY ||
          key;
  } catch (e) {}
  try {
    if (!key || key === 'PLACEHOLDER_API_KEY' || key.startsWith('AQ.')) {
      key = process.env.GEMINI_API_KEY ||
            process.env.GOOGLE_API_KEY ||
            process.env.ECO_DRIP_NEURAL_KEY ||
            key;
    }
  } catch(e) {}
  
  if (!key || key.startsWith('AQ.')) {
    key = 'AIzaSyBXGpIDCquZM7fI-blBQkPPhXlciwXlsuY';
  }
  
  return key?.toString().trim();
};

const normalizeModel = (model: string) => {
  if (model.startsWith('gemini-')) return model;
  return 'gemini-2.5-flash';
};

const getGroqApiKey = () => {
  let key = '';
  try {
    key = import.meta.env.VITE_GROQ_API_KEY || key;
  } catch (e) {}
  try {
    if (!key) key = process.env.VITE_GROQ_API_KEY || key;
  } catch(e) {}
  return key?.toString().trim();
};

const getGroqApiKey2 = () => {
  let key = '';
  try {
    key = import.meta.env.VITE_GROQ_API_KEY_2 || key;
  } catch (e) {}
  try {
    if (!key) key = process.env.VITE_GROQ_API_KEY_2 || key;
  } catch(e) {}
  return key?.toString().trim();
};

const fetchGroqFallback = async (prompt: string, jsonMode: boolean = false) => {
  const key = getGroqApiKey();
  if (!key) throw new Error('No Groq API key found for backup');

  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const payload: any = {
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }]
  };
  
  if (jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq Backup Error: ${res.status} ${err}`);
  }

  const json = await res.json();
  return json?.choices?.[0]?.message?.content || '';
};

const fetchGroqFallback2 = async (prompt: string, jsonMode: boolean = false) => {
  const key = getGroqApiKey2();
  if (!key) throw new Error('No secondary Groq API key found for backup');

  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const payload: any = {
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }]
  };

  if (jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq Backup 2 Error: ${res.status} ${err}`);
  }

  const json = await res.json();
  return json?.choices?.[0]?.message?.content || '';
};

const getGroqApiKey3 = () => {
  let key = '';
  try {
    key = import.meta.env.VITE_GROQ_API_KEY_3 || key;
  } catch (e) {}
  try {
    if (!key) key = process.env.VITE_GROQ_API_KEY_3 || key;
  } catch(e) {}
  return key?.toString().trim();
};

const fetchGroqFallback3 = async (prompt: string, jsonMode: boolean = false) => {
  const key = getGroqApiKey3();
  if (!key) throw new Error('No tertiary Groq API key found for backup');

  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const payload: any = {
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }]
  };

  if (jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq Backup 3 Error: ${res.status} ${err}`);
  }

  const json = await res.json();
  return json?.choices?.[0]?.message?.content || '';
};

const getGroqApiKey4 = () => {
  let key = '';
  try {
    key = import.meta.env.VITE_GROQ_API_KEY_4 || key;
  } catch (e) {}
  try {
    if (!key) key = process.env.VITE_GROQ_API_KEY_4 || key;
  } catch(e) {}
  return key?.toString().trim();
};

const fetchGroqFallback4 = async (prompt: string, jsonMode: boolean = false) => {
  const key = getGroqApiKey4();
  if (!key) throw new Error('No quaternary Groq API key found for backup');

  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const payload: any = {
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }]
  };

  if (jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq Backup 4 Error: ${res.status} ${err}`);
  }

  const json = await res.json();
  return json?.choices?.[0]?.message?.content || '';
};

const getGroqApiKey5 = () => {
  let key = '';
  try {
    key = import.meta.env.VITE_GROQ_API_KEY_5 || key;
  } catch (e) {}
  try {
    if (!key) key = process.env.VITE_GROQ_API_KEY_5 || key;
  } catch(e) {}
  return key?.toString().trim();
};

const fetchGroqFallback5 = async (prompt: string, jsonMode: boolean = false) => {
  const key = getGroqApiKey5();
  if (!key) throw new Error('No quinary Groq API key found for backup');

  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const payload: any = {
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }]
  };

  if (jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq Backup 5 Error: ${res.status} ${err}`);
  }

  const json = await res.json();
  return json?.choices?.[0]?.message?.content || '';
};

const getGroqApiKey6 = () => {
  let key = '';
  try {
    key = import.meta.env.VITE_GROQ_API_KEY_6 || key;
  } catch (e) {}
  try {
    if (!key) key = process.env.VITE_GROQ_API_KEY_6 || key;
  } catch(e) {}
  return key?.toString().trim();
};

const fetchGroqFallback6 = async (prompt: string, jsonMode: boolean = false) => {
  const key = getGroqApiKey6();
  if (!key) throw new Error('No senary Groq API key found for backup');

  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const payload: any = {
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }]
  };

  if (jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq Backup 6 Error: ${res.status} ${err}`);
  }

  const json = await res.json();
  return json?.choices?.[0]?.message?.content || '';
};

const getGroqApiKey7 = () => {
  let key = '';
  try {
    key = import.meta.env.VITE_GROQ_API_KEY_7 || key;
  } catch (e) {}
  try {
    if (!key) key = process.env.VITE_GROQ_API_KEY_7 || key;
  } catch(e) {}
  return key?.toString().trim();
};

const fetchGroqFallback7 = async (prompt: string, jsonMode: boolean = false) => {
  const key = getGroqApiKey7();
  if (!key) throw new Error('No septenary Groq API key found for backup');

  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const payload: any = {
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }]
  };

  if (jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq Backup 7 Error: ${res.status} ${err}`);
  }

  const json = await res.json();
  return json?.choices?.[0]?.message?.content || '';
};

const getGroqApiKey8 = () => {
  let key = '';
  try {
    key = import.meta.env.VITE_GROQ_API_KEY_8 || key;
  } catch (e) {}
  try {
    if (!key) key = process.env.VITE_GROQ_API_KEY_8 || key;
  } catch(e) {}
  return key?.toString().trim();
};

const fetchGroqFallback8 = async (prompt: string, jsonMode: boolean = false) => {
  const key = getGroqApiKey8();
  if (!key) throw new Error('No octonary Groq API key found for backup');

  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const payload: any = {
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }]
  };

  if (jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq Backup 8 Error: ${res.status} ${err}`);
  }

  const json = await res.json();
  return json?.choices?.[0]?.message?.content || '';
};

const getBackupGeminiApiKey = () => {
  let key = '';
  try {
    key = import.meta.env.VITE_BACKUP_GEMINI_KEY || key;
  } catch (e) {}
  try {
    if (!key) key = process.env.VITE_BACKUP_GEMINI_KEY || key;
  } catch(e) {}
  return key?.toString().trim();
};

const fetchBackupGeminiFallback = async (prompt: string, media?: any, jsonMode: boolean = false, model: string = 'gemini-2.5-flash') => {
  const key = getBackupGeminiApiKey();
  if (!key) throw new Error('No Backup Gemini API key found');

  const parts: any[] = [{ text: prompt }];
  if (media && media.base64) {
    parts.push({
      inlineData: {
        mimeType: media.mimeType || 'image/jpeg',
        data: media.base64
      }
    });
  }

  const modelName = normalizeModel(model);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;

  const payload: any = { contents: [{ parts }] };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Backup Gemini Error: ${res.status} ${err}`);
  }

  const json = await res.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

const getBackupGeminiApiKey2 = () => {
  let key = '';
  try {
    key = import.meta.env.VITE_BACKUP_GEMINI_KEY_2 || key;
  } catch (e) {}
  try {
    if (!key) key = process.env.VITE_BACKUP_GEMINI_KEY_2 || key;
  } catch(e) {}
  return key?.toString().trim();
};

const fetchBackupGeminiFallback2 = async (prompt: string, media?: any, jsonMode: boolean = false, model: string = 'gemini-2.5-flash') => {
  const key = getBackupGeminiApiKey2();
  if (!key) throw new Error('No Quaternary Gemini API key found');

  const parts: any[] = [{ text: prompt }];
  if (media && media.base64) {
    parts.push({
      inlineData: {
        mimeType: media.mimeType || 'image/jpeg',
        data: media.base64
      }
    });
  }

  const modelName = normalizeModel(model);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;

  const payload: any = { contents: [{ parts }] };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Quaternary Gemini Error: ${res.status} ${err}`);
  }

  const json = await res.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

const getBackupGeminiApiKey3 = () => {
  let key = '';
  try {
    key = import.meta.env.VITE_BACKUP_GEMINI_KEY_3 || key;
  } catch (e) {}
  try {
    if (!key) key = process.env.VITE_BACKUP_GEMINI_KEY_3 || key;
  } catch(e) {}
  return key?.toString().trim();
};

const fetchBackupGeminiFallback3 = async (prompt: string, media?: any, jsonMode: boolean = false, model: string = 'gemini-2.5-flash') => {
  const key = getBackupGeminiApiKey3();
  if (!key) throw new Error('No Quinary Gemini API key found');

  const parts: any[] = [{ text: prompt }];
  if (media && media.base64) {
    parts.push({
      inlineData: {
        mimeType: media.mimeType || 'image/jpeg',
        data: media.base64
      }
    });
  }

  const modelName = normalizeModel(model);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;

  const payload: any = { contents: [{ parts }] };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Quinary Gemini Error: ${res.status} ${err}`);
  }

  const json = await res.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

const getBackupGeminiApiKey4 = () => {
  let key = '';
  try {
    key = import.meta.env.VITE_BACKUP_GEMINI_KEY_4 || key;
  } catch (e) {}
  try {
    if (!key) key = process.env.VITE_BACKUP_GEMINI_KEY_4 || key;
  } catch(e) {}
  return key?.toString().trim();
};

const fetchBackupGeminiFallback4 = async (prompt: string, media?: any, jsonMode: boolean = false, model: string = 'gemini-2.5-flash') => {
  const key = getBackupGeminiApiKey4();
  if (!key) throw new Error('No Senary Gemini API key found');

  const parts: any[] = [{ text: prompt }];
  if (media && media.base64) {
    parts.push({
      inlineData: {
        mimeType: media.mimeType || 'image/jpeg',
        data: media.base64
      }
    });
  }

  const modelName = normalizeModel(model);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;

  const payload: any = { contents: [{ parts }] };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Senary Gemini Error: ${res.status} ${err}`);
  }

  const json = await res.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

const getBackupGeminiApiKey5 = () => {
  let key = '';
  try {
    key = import.meta.env.VITE_BACKUP_GEMINI_KEY_5 || key;
  } catch (e) {}
  try {
    if (!key) key = process.env.VITE_BACKUP_GEMINI_KEY_5 || key;
  } catch(e) {}
  return key?.toString().trim();
};

const fetchBackupGeminiFallback5 = async (prompt: string, media?: any, jsonMode: boolean = false, model: string = 'gemini-2.5-flash') => {
  const key = getBackupGeminiApiKey5();
  if (!key) throw new Error('No Septenary Gemini API key found');

  const parts: any[] = [{ text: prompt }];
  if (media && media.base64) {
    parts.push({
      inlineData: {
        mimeType: media.mimeType || 'image/jpeg',
        data: media.base64
      }
    });
  }

  const modelName = normalizeModel(model);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;

  const payload: any = { contents: [{ parts }] };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Septenary Gemini Error: ${res.status} ${err}`);
  }

  const json = await res.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

const fetchAI = async (prompt: string, media?: any, jsonMode: boolean = false, model: string = 'gemini-2.5-flash') => {
  const key = getApiKey();
  if (!key) throw new Error('No API key found in env');

  const parts: any[] = [{ text: prompt }];
  if (media && media.base64) {
    parts.push({
      inlineData: {
        mimeType: media.mimeType || 'image/jpeg',
        data: media.base64
      }
    });
  }

  const modelName = normalizeModel(model);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;

  const payload: any = {
    contents: [
      {
        parts
      }
    ]
  };

  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // 1. Primary Gemini Request
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': key
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Google Gemini Error: ${res.status} ${err}`);
      }

      const json = await res.json();
      return json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
    } catch (e: any) {
      lastError = e;
      const isRateLimit = e.message && (e.message.includes('503') || e.message.includes('429'));
      
      if (isRateLimit) {
        console.warn(`Primary Gemini limit reached (Attempt ${attempt + 1}). Attempting fast fallbacks...`);
        try {
          // 2. Secondary Groq (key 1)
          console.warn('Trying Groq fallback...');
          return await fetchGroqFallback(prompt, jsonMode);
        } catch (groqErr) {
          console.error('Groq fallback failed:', groqErr);
          try {
            // 3. Secondary Groq (key 2)
            console.warn('Groq key 1 failed. Trying Groq backup key 2...');
            return await fetchGroqFallback2(prompt, jsonMode);
          } catch (groq2Err) {
            console.error('Groq backup key 2 failed:', groq2Err);
            try {
              // 4. Groq key 3
              console.warn('Groq key 2 failed. Trying Groq backup key 3...');
              return await fetchGroqFallback3(prompt, jsonMode);
            } catch (groq3Err) {
              console.error('Groq backup key 3 failed:', groq3Err);
              try {
                // 5. Groq key 4
                console.warn('Groq key 3 failed. Trying Groq backup key 4...');
                return await fetchGroqFallback4(prompt, jsonMode);
              } catch (groq4Err) {
                console.error('Groq backup key 4 failed:', groq4Err);
                try {
                  // 6. Groq key 5
                  console.warn('Groq key 4 failed. Trying Groq backup key 5...');
                  return await fetchGroqFallback5(prompt, jsonMode);
                } catch (groq5Err) {
                  console.error('Groq backup key 5 failed:', groq5Err);
                  try {
                    // 7. Groq key 6
                    console.warn('Groq key 5 failed. Trying Groq backup key 6...');
                    return await fetchGroqFallback6(prompt, jsonMode);
                  } catch (groq6Err) {
                    console.error('Groq backup key 6 failed:', groq6Err);
                    try {
                      // 8. Groq key 7
                      console.warn('Groq key 6 failed. Trying Groq backup key 7...');
                      return await fetchGroqFallback7(prompt, jsonMode);
                    } catch (groq7Err) {
                      console.error('Groq backup key 7 failed:', groq7Err);
                      try {
                        // 9. Groq key 8
                        console.warn('Groq key 7 failed. Trying Groq backup key 8...');
                        return await fetchGroqFallback8(prompt, jsonMode);
                      } catch (groq8Err) {
                        console.error('Groq backup key 8 failed:', groq8Err);
                        try {
                          // 10. Tertiary Gemini
                          console.warn('All Groq keys failed. Trying Tertiary Backup Gemini...');
                          return await fetchBackupGeminiFallback(prompt, media, jsonMode, model);
                        } catch (tertErr) {
                          console.error('Tertiary Gemini fallback failed:', tertErr);
                          try {
                            // 11. Quaternary Gemini
                            console.warn('Tertiary failed. Trying Quaternary Backup Gemini...');
                            return await fetchBackupGeminiFallback2(prompt, media, jsonMode, model);
                          } catch (quatErr) {
                            console.error('Quaternary Gemini fallback failed:', quatErr);
                            try {
                              // 12. Quinary Gemini
                              console.warn('Quaternary failed. Trying Quinary Backup Gemini...');
                              return await fetchBackupGeminiFallback3(prompt, media, jsonMode, model);
                            } catch (quinErr) {
                              console.error('Quinary Gemini fallback failed:', quinErr);
                              try {
                                // 13. Senary Gemini
                                console.warn('Quinary failed. Trying Senary Backup Gemini...');
                                return await fetchBackupGeminiFallback4(prompt, media, jsonMode, model);
                              } catch (senErr) {
                                console.error('Senary Gemini fallback failed:', senErr);
                                try {
                                  // 14. Septenary Gemini
                                  console.warn('Senary failed. Trying Septenary Backup Gemini...');
                                  return await fetchBackupGeminiFallback5(prompt, media, jsonMode, model);
                                } catch (sepErr) {
                                  console.error('Septenary Gemini fallback failed:', sepErr);
                                  lastError = sepErr;
                                  // All fallbacks exhausted. Wait and retry the whole chain.
                                  await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
                                  continue;
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } else {
        // Not a rate limit error, throw immediately
        throw e;
      }
    }
  }

  throw lastError || new Error("AI service temporarily unavailable due to high demand. Please try again in a moment.");
};

export async function getAdvice(moisture: number, weather: string, temp: number, language?: string) {
  try {
    const prompt = `You are an expert horticultural assistant specializing in smart irrigation. 
    My soil moisture is currently ${moisture}%. The weather is ${weather} with a temperature of ${temp}°C. 
    Should I irrigate now? Give me a concise 1-2 sentence recommendation and a tip for water conservation in ${language || 'English'}. No markdown.`;

    const text = await fetchAI(prompt);
    if (!text) throw new Error("Unable to retrieve advice.");
    return text;
  } catch (error) {
    console.error('Advice Error:', error);
    throw error;
  }
}

export async function getChatResponse(message: string, context: string, language?: string, media?: { base64: string, mimeType: string }) {
  try {
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

    const text = await fetchAI(prompt, media, false, 'gemini-2.5-flash');
    if (!text) throw new Error("I'm having trouble thinking right now.");
    return text;
  } catch (error) {
    console.error('Chat Error:', error);
    throw error;
  }
}

export async function getBotanicalInfo(query: string) {
  try {
    const prompt = `Act as a Global Botanical Database API. 
    Search for species info on: "${query}".
    
    CRITICAL INSTRUCTIONS:
    1. If there is a spelling mistake or typo, auto-correct it to the closest matching plant or crop.
    2. If generic, resolve to the most common representative species.
    3. Return ONLY valid JSON without markdown blocks.
    JSON Schema:
    {
      "name": "Botanical Name (Common Name)",
      "nameHi": "Common Name in Hindi",
      "nameGu": "Common Name in Gujarati",
      "category": "Cereal/Vegetable/Flower/Fruit",
      "watering": { "en": "Specific pattern", "hi": "हिंदी में विवरण", "gu": "ગુજરાતીમાં વર્ણન" },
      "difficulty": { "en": "Easy/Moderate/Hard", "hi": "आसान/मध्यम/कठिन", "gu": "સરળ/મધ્યમ/कठिन" },
      "family": { "en": "Scientific family", "hi": "वैज्ञानिक परिवार", "gu": "વૈજ્ઞાનિક કુટુંબ" },
      "light": { "en": "Sun requirement", "hi": "धूप की आवश्यकता", "gu": "સૂર્યની જરૂરિયાત" },
      "desc": { "en": "1-sentence summary", "hi": "हिंदी में विवरण", "gu": "ગુજરાતીમાં સારાંશ" },
      "npk": "Ratio like 10-10-10",
      "pests": "Key pests list",
      "tempRange": "Optimal temperature e.g. 20-30°C",
      "season": "Best planting season",
      "soil": "Optimal soil type",
      "growthRate": "Slow/Medium/Fast",
      "companions": "List of companion plants",
      "toxicity": "Toxicity to pets/humans or 'None'"
    }`;

    let text = await fetchAI(prompt, undefined, true, 'gemini-2.5-flash');
    if (!text) throw new Error("Empty response");
    
    text = text.replace(/```json/i, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error('Botanical Info Error:', error);
    throw error;
  }
}

export async function getFoliageAnalysis(base64: string, mime: string) {
  try {
    const prompt = `You are a sophisticated botanical AI assistant. Analyze this image of a plant/leaf. Provide a concise, professional diagnosis.
    
    Instructions:
    1. Identify the plant if possible.
    2. Diagnose any visible diseases, pests, or deficiencies.
    3. Recommend an immediate action.
    Keep it brief, around 2-3 sentences. No markdown.`;

    const media = { base64, mimeType: mime };
    const text = await fetchAI(prompt, media, false, 'gemini-2.5-flash');
    
    if (!text) throw new Error("Empty analysis");
    return text;
  } catch (error) {
    console.error('Foliage Analysis Error:', error);
    throw new Error('Optics Core Error. Could not process foliage image.');
  }
}
