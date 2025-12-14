/**
 * AudioWorklet Processor for OpenAI Realtime API
 *
 * This processor captures microphone audio, converts it to the format required by OpenAI:
 * - Sample Rate: 24kHz (resampled from browser's native rate, typically 48kHz)
 * - Bit Depth: 16-bit signed PCM (Int16)
 * - Channels: Mono (1 channel)
 * - Chunk Size: 4800 samples (~200ms at 24kHz) for efficient transmission
 *
 * Architecture:
 * Browser Microphone (48kHz stereo)
 *   → AudioWorkletNode
 *   → This Processor (resample, mono, PCM16)
 *   → Main Thread (base64 encode → data channel)
 */

class RealtimeAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // Resampling state
    this.inputSampleRate = sampleRate; // Browser's native rate (usually 48kHz)
    this.outputSampleRate = 24000; // OpenAI expects 24kHz
    this.resampleRatio = this.inputSampleRate / this.outputSampleRate; // Usually 2.0 (48kHz / 24kHz)

    // Buffering for resampling
    this.inputBuffer = [];
    this.inputBufferIndex = 0;

    // Chunk size for transmission (4800 samples = 200ms at 24kHz)
    this.chunkSize = 4800;
    this.outputBuffer = [];

    console.log('[AudioProcessor] Initialized:', {
      inputSampleRate: this.inputSampleRate,
      outputSampleRate: this.outputSampleRate,
      resampleRatio: this.resampleRatio,
      chunkSize: this.chunkSize
    });
  }

  /**
   * Process audio frames
   * @param {Float32Array[][]} inputs - Input audio channels
   * @param {Float32Array[][]} outputs - Output audio channels (unused, we process only)
   * @returns {boolean} - true to keep processor alive
   */
  process(inputs, outputs) {
    const input = inputs[0];

    // No input or empty input
    if (!input || input.length === 0 || input[0].length === 0) {
      return true;
    }

    // Convert stereo to mono by averaging channels
    const monoInput = this.stereoToMono(input);

    // Resample from browser rate (48kHz) to OpenAI rate (24kHz)
    const resampled = this.resample(monoInput);

    // Convert float32 (-1.0 to 1.0) to PCM16 (-32768 to 32767)
    const pcm16 = this.float32ToPCM16(resampled);

    // Add to output buffer
    this.outputBuffer.push(...pcm16);

    // Send chunks of 4800 samples to main thread
    while (this.outputBuffer.length >= this.chunkSize) {
      const chunk = this.outputBuffer.splice(0, this.chunkSize);
      const int16Array = new Int16Array(chunk);

      // Send to main thread for base64 encoding and transmission
      this.port.postMessage({
        type: 'audio-chunk',
        audio: int16Array,
        sampleRate: this.outputSampleRate,
        samples: int16Array.length
      });
    }

    return true; // Keep processor alive
  }

  /**
   * Convert stereo (or multi-channel) to mono by averaging channels
   * @param {Float32Array[]} channels - Input audio channels
   * @returns {Float32Array} - Mono audio
   */
  stereoToMono(channels) {
    if (channels.length === 1) {
      return channels[0]; // Already mono
    }

    const length = channels[0].length;
    const mono = new Float32Array(length);

    // Average all channels
    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (let ch = 0; ch < channels.length; ch++) {
        sum += channels[ch][i];
      }
      mono[i] = sum / channels.length;
    }

    return mono;
  }

  /**
   * Resample audio from input rate to output rate using linear interpolation
   * @param {Float32Array} input - Input audio samples
   * @returns {number[]} - Resampled audio samples
   */
  resample(input) {
    const output = [];

    // Add input samples to buffer
    for (let i = 0; i < input.length; i++) {
      this.inputBuffer.push(input[i]);
    }

    // Resample using linear interpolation
    while (this.inputBufferIndex + 1 < this.inputBuffer.length) {
      const inputIndex = this.inputBufferIndex;
      const nextIndex = inputIndex + 1;

      // Linear interpolation
      const fraction = inputIndex - Math.floor(inputIndex);
      const sample1 = this.inputBuffer[Math.floor(inputIndex)];
      const sample2 = this.inputBuffer[Math.floor(nextIndex)];
      const interpolated = sample1 + (sample2 - sample1) * fraction;

      output.push(interpolated);

      // Advance by resample ratio
      this.inputBufferIndex += this.resampleRatio;
    }

    // Remove processed samples from buffer (keep remainder for next iteration)
    const samplesProcessed = Math.floor(this.inputBufferIndex);
    this.inputBuffer.splice(0, samplesProcessed);
    this.inputBufferIndex -= samplesProcessed;

    return output;
  }

  /**
   * Convert Float32 audio (-1.0 to 1.0) to PCM16 (-32768 to 32767)
   * @param {number[]} float32Samples - Float32 audio samples
   * @returns {number[]} - PCM16 audio samples
   */
  float32ToPCM16(float32Samples) {
    const pcm16 = [];

    for (let i = 0; i < float32Samples.length; i++) {
      // Clamp to [-1.0, 1.0]
      let sample = Math.max(-1.0, Math.min(1.0, float32Samples[i]));

      // Convert to 16-bit signed integer
      // -1.0 → -32768, 1.0 → 32767
      sample = sample < 0 ? sample * 32768 : sample * 32767;

      // Round and clamp to Int16 range
      pcm16.push(Math.max(-32768, Math.min(32767, Math.round(sample))));
    }

    return pcm16;
  }
}

// Register the processor
registerProcessor('realtime-audio-processor', RealtimeAudioProcessor);
