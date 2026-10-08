import { getBotanicalInfo } from './src/lib/gemini.js';

async function test() {
  try {
    const data = await getBotanicalInfo('cherry');
    console.log("SUCCESS:", data);
  } catch (err) {
    console.error("FAIL:", err);
  }
}

test();
