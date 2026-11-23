"use client";

import type { AudioProcessorOptions, Track, TrackProcessor } from "livekit-client";

/*
 * Protected voice (Admin → Chat safety → Settings, off unless an administrator turns it on): only sound the speech
 * check has already read and found clean goes out, and never sooner than `seconds` after it was said.
 *
 *   microphone ─▶ hold (audio thread) ─▶ what LiveKit sends
 *                   │  chunks ▲ "clean up to here"
 *                   ▼         │
 *                 on-device speech reader + the contact rules (this page)
 *
 * The hold runs on the browser's audio thread, so a busy page can't make sound slip out: when the check falls
 * behind, the voice waits a little longer (up to `seconds` + 3 s); sound that still hasn't been checked by then
 * is dropped (a moment of silence), never sent. When contact details are caught, `cut()` drops everything held.
 * Until the reader is listening (`checking(false)`), the hold works as a plain delay, which the browser's own
 * recogniser can still cut. Talking feels slower and the picture isn't delayed: that's the price.
 */

const HOLD = `
class TutorLinkHold extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = options.processorOptions;
    this.min = Math.round(o.minDelaySec * sampleRate);
    this.max = Math.round(o.maxHoldSec * sampleRate);
    this.size = this.max + 16384;
    this.ring = new Float32Array(this.size);
    this.write = 0; this.read = 0; this.released = 0;
    this.shut = !!o.shut;
    this.checked = false;
    // Chunks for the reader at 16 kHz when the rate allows (a third of the work), else as they are.
    this.step = sampleRate % 16000 === 0 ? sampleRate / 16000 : 1;
    this.chunkSize = o.chunk; this.chunk = new Float32Array(this.chunkSize); this.fill = 0; this.acc = 0; this.accN = 0;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (typeof m.release === 'number') this.released = Math.max(this.released, m.release);
      if (typeof m.checked === 'boolean') this.checked = m.checked;
      if (typeof m.shut === 'boolean') { this.shut = m.shut; this.read = this.write; this.released = this.write; }
    };
  }
  process(inputs, outputs) {
    const input = inputs[0] && inputs[0][0];
    const out = outputs[0][0];
    if (input) {
      for (let i = 0; i < input.length; i++) {
        this.ring[this.write % this.size] = input[i];
        this.write++;
        this.acc += input[i]; this.accN++;
        if (this.accN === this.step) {
          this.chunk[this.fill++] = this.acc / this.step; this.acc = 0; this.accN = 0;
          if (this.fill === this.chunkSize) {
            const c = this.chunk;
            this.port.postMessage({ chunk: c, end: this.write }, [c.buffer]);
            this.chunk = new Float32Array(this.chunkSize); this.fill = 0;
          }
        }
      }
    }
    if (this.shut) { this.read = this.write; out.fill(0); return true; }
    if (!this.checked) this.released = this.write;
    // Never further behind than the limit: older sound that was never checked is dropped, not sent.
    if (this.write - this.read > this.max) this.read = this.write - this.max;
    const allowed = Math.min(this.released, this.write - this.min);
    // Caught up after a slow patch: back to the usual delay (a short jump rather than a lag that stays).
    if (allowed - this.read > Math.round(0.75 * sampleRate)) this.read = allowed - Math.round(0.25 * sampleRate);
    for (let i = 0; i < out.length; i++) {
      if (this.read < allowed) { out[i] = this.ring[this.read % this.size]; this.read++; } else out[i] = 0;
    }
    return true;
  }
}
registerProcessor('tutorlink-hold', TutorLinkHold);
`;

let holdUrl: string | null = null;
const holdLoaded = new WeakSet<BaseAudioContext>();

export class ProtectedVoice implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  name = "tutorlink-protected-voice";
  processedTrack?: MediaStreamTrack;
  /** The microphone itself, before the hold. */
  source?: MediaStreamTrack;
  /** The rate of the chunks given to the speech check. */
  chunkRate = 16_000;
  /** Each chunk of the microphone's sound, and the running sample count where it ends (for the speech check). */
  onChunk: ((data: Float32Array, end: number) => void) | null = null;
  private nodes: { input: MediaStreamAudioSourceNode; hold: AudioWorkletNode; output: MediaStreamAudioDestinationNode } | null = null;
  private shut = false;
  private isChecked = false;

  constructor(readonly seconds: number) {}

  async init(opts: AudioProcessorOptions) {
    await this.build(opts);
  }

  async restart(opts: AudioProcessorOptions) {
    this.teardown();
    await this.build(opts);
  }

  async destroy() {
    this.teardown();
  }

  private async build({ track, audioContext: ctx }: AudioProcessorOptions) {
    if (!holdLoaded.has(ctx)) {
      holdUrl ??= URL.createObjectURL(new Blob([HOLD], { type: "text/javascript" }));
      await ctx.audioWorklet.addModule(holdUrl);
      holdLoaded.add(ctx);
    }
    const input = ctx.createMediaStreamSource(new MediaStream([track]));
    const hold = new AudioWorkletNode(ctx, "tutorlink-hold", {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
      processorOptions: { minDelaySec: this.seconds, maxHoldSec: this.seconds + 3, chunk: 2048, shut: this.shut },
    });
    hold.port.onmessage = (e: MessageEvent<{ chunk?: Float32Array; end?: number }>) => {
      if (e.data.chunk && typeof e.data.end === "number") this.onChunk?.(e.data.chunk, e.data.end);
    };
    hold.port.postMessage({ checked: this.isChecked });
    const output = ctx.createMediaStreamDestination();
    input.connect(hold).connect(output);
    this.chunkRate = ctx.sampleRate % 16_000 === 0 ? 16_000 : ctx.sampleRate;
    this.source = track;
    this.processedTrack = output.stream.getAudioTracks()[0];
    this.nodes = { input, hold, output };
  }

  private teardown() {
    const n = this.nodes;
    this.nodes = null;
    if (!n) return;
    n.hold.port.onmessage = null;
    try {
      n.input.disconnect();
      n.hold.disconnect();
    } catch {
      // already disconnected
    }
  }

  /** Whether the speech check is reading the chunks (only what it found clean goes out) or not (a plain delay). */
  checking(on: boolean) {
    this.isChecked = on;
    this.nodes?.hold.port.postMessage({ checked: on });
  }

  /** The speech check read the sound up to this sample and found nothing: it may go out. */
  release(end: number) {
    this.nodes?.hold.port.postMessage({ release: end });
  }

  /** Contact details were caught: everything held is dropped, and nothing goes out until reopen(). */
  cut() {
    this.shut = true;
    this.nodes?.hold.port.postMessage({ shut: true });
  }

  /** The microphone may be heard again (new sound is held and checked as before). */
  reopen() {
    if (!this.shut) return;
    this.shut = false;
    this.nodes?.hold.port.postMessage({ shut: false });
    if (this.processedTrack) this.processedTrack.enabled = true;
  }
}
