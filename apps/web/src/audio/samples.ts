/** Fontes, licenças e preparação das gravações: docs/audio.md. */
export const SOUND_BANK = {
  ball: [
    new URL('./samples/ball-1.wav', import.meta.url).href,
    new URL('./samples/ball-2.wav', import.meta.url).href,
    new URL('./samples/ball-3.wav', import.meta.url).href,
  ],
  cue: [
    new URL('./samples/cue-1.wav', import.meta.url).href,
    new URL('./samples/cue-2.wav', import.meta.url).href,
  ],
  cushion: [new URL('./samples/cushion-1.wav', import.meta.url).href],
  pocket: [
    new URL('./samples/pocket-1.wav', import.meta.url).href,
    new URL('./samples/pocket-2.wav', import.meta.url).href,
  ],
  return: [
    new URL('./samples/return-1.wav', import.meta.url).href,
    new URL('./samples/return-2.wav', import.meta.url).href,
  ],
} as const;

export type SoundKind = keyof typeof SOUND_BANK;
