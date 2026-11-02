/**
 * Lightweight DSP building blocks for the audio mixer (Stage 8).
 */

/** One-pole low/high shelf style 3-band EQ (very small CPU). */
export class SimpleEQ {
  private low = 0;
  private high = 0;

  constructor(
    private lowGain = 1,
    private midGain = 1,
    private highGain = 1,
  ) {}

  setGains(lowDb: number, midDb: number, highDb: number): void {
    this.lowGain = db(lowDb);
    this.midGain = db(midDb);
    this.highGain = db(highDb);
  }

  processSample(x: number): number {
    this.low += 0.05 * (x - this.low);
    this.high = x - this.low;
    const mid = x - this.low * 0.5 - this.high * 0.5;
    return this.low * this.lowGain + mid * this.midGain + this.high * this.highGain;
  }

  processBuffer(input: Float32Array, output: Float32Array = input): Float32Array {
    for (let i = 0; i < input.length; i += 1) {
      output[i] = this.processSample(input[i]!);
    }
    return output;
  }
}

/** Soft-knee compressor. */
export class Compressor {
  private envelope = 0;

  constructor(
    private thresholdDb = -18,
    private ratio = 4,
    private attack = 0.01,
    private release = 0.1,
  ) {}

  processSample(x: number, sampleRate = 48000): number {
    const abs = Math.abs(x);
    const levelDb = abs <= 1e-8 ? -96 : 20 * Math.log10(abs);
    const over = Math.max(0, levelDb - this.thresholdDb);
    const target = over > 0 ? over - over / this.ratio : 0;
    const coeff =
      target > this.envelope
        ? Math.exp(-1 / (this.attack * sampleRate))
        : Math.exp(-1 / (this.release * sampleRate));
    this.envelope = target + coeff * (this.envelope - target);
    const gain = Math.pow(10, -this.envelope / 20);
    return x * gain;
  }
}

/** Mono schroeder-ish reverb (feedback delay). */
export class SimpleReverb {
  private readonly buf: Float32Array;
  private idx = 0;

  constructor(delaySamples = 2400, private feedback = 0.45, private mix = 0.2) {
    this.buf = new Float32Array(delaySamples);
  }

  processSample(x: number): number {
    const delayed = this.buf[this.idx]!;
    const y = x * (1 - this.mix) + delayed * this.mix;
    this.buf[this.idx] = x + delayed * this.feedback;
    this.idx = (this.idx + 1) % this.buf.length;
    return y;
  }
}

function db(v: number): number {
  return Math.pow(10, v / 20);
}
