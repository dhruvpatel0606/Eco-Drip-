import { getBotanicalInfo } from './src/lib/gemini.js';

async function test() {
  try {
    const data = await getBotanicalInfo('cherry');
    console.log("SUCCESS:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("FAIL:", err);
  }
}

test();
