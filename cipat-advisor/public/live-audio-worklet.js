class EcoDripPcmCapture extends AudioWorkletProcessor {
  process(inputs) {
    const samples = inputs[0]?.[0];
    if (!samples) return true;
    const targetRate = 16000;
    const ratio = sampleRate / targetRate;
    const length = Math.floor(samples.length / ratio);
    const pcm = new Int16Array(length);
    for (let i = 0; i < length; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.min(samples.length, Math.floor((i + 1) * ratio));
      let value = 0;
      for (let j = start; j < end; j++) value += samples[j];
      value = Math.max(-1, Math.min(1, value / Math.max(1, end - start)));
      pcm[i] = value < 0 ? value * 0x8000 : value * 0x7fff;
    }
    this.port.postMessage(pcm.buffer, [pcm.buffer]);
    return true;
  }
}
registerProcessor('ecodrip-pcm-capture', EcoDripPcmCapture);
