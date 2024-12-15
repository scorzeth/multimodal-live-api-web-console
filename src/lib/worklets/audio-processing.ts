/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const AudioRecordingWorklet = `
class AudioProcessingWorklet extends AudioWorkletProcessor {
  buffer = new Int16Array(2048);
  bufferWriteIndex = 0;
  inputSampleRate;
  targetSampleRate;
  lastInputSample = 0;
  inputBuffer = [];

  constructor(options) {
    super();
    this.inputSampleRate = options.processorOptions.inputSampleRate;
    this.targetSampleRate = options.processorOptions.targetSampleRate;
    this.resampleRatio = this.targetSampleRate / this.inputSampleRate;
  }

  process(inputs) {
    if (inputs[0].length) {
      const channel0 = inputs[0][0];
      this.processChunk(channel0);
    }
    return true;
  }

  sendAndClearBuffer(){
    this.port.postMessage({
      event: "chunk",
      data: {
        int16arrayBuffer: this.buffer.slice(0, this.bufferWriteIndex).buffer
      }
    });
    this.bufferWriteIndex = 0;
  }

  // Optimized resampling for 48kHz to 16kHz (3:1 ratio)
  resample(inputBuffer) {
    // For 48kHz to 16kHz, we take every third sample
    const outputLength = Math.floor(inputBuffer.length / 3);
    const output = new Float32Array(outputLength);

    // Simple averaging of 3 samples for better quality
    for (let i = 0; i < outputLength; i++) {
      const inputIndex = i * 3;
      output[i] = (
        inputBuffer[inputIndex] +
        (inputBuffer[inputIndex + 1] || 0) +
        (inputBuffer[inputIndex + 2] || 0)
      ) / 3;
    }

    return output;
  }

  processChunk(float32Array) {
    // Resample the input
    const resampled = this.resample(float32Array);

    for (let i = 0; i < resampled.length; i++) {
      // Convert float32 [-1, 1] to int16 [-32768, 32767]
      const int16Value = Math.max(-32768, Math.min(32767, Math.round(resampled[i] * 32768)));
      this.buffer[this.bufferWriteIndex++] = int16Value;

      if (this.bufferWriteIndex >= this.buffer.length) {
        this.sendAndClearBuffer();
      }
    }

    if (this.bufferWriteIndex >= this.buffer.length) {
      this.sendAndClearBuffer();
    }
  }
}
`;

export default AudioRecordingWorklet;
