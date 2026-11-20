import { mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Baixe os previews HQ CC0 descritos em docs/audio.md para este diretório.
const sourceDir = process.argv[2];
if (!sourceDir) throw new Error('Uso: node scripts/prepare-pool-audio.mjs <diretorio-das-fontes>');
const outputDir = fileURLToPath(new URL('../apps/web/src/audio/samples/', import.meta.url));
mkdirSync(outputDir, { recursive: true });

const clips = [
  { name: 'ball-1', source: 'clack', start: 0, duration: 0.2, lowpass: 12000 },
  { name: 'ball-2', source: 'shots', start: 10.16, duration: 0.2, lowpass: 12000 },
  { name: 'ball-3', source: 'shots', start: 13.64, duration: 0.23, lowpass: 12000 },
  { name: 'cue-1', source: 'shots', start: 7.08, duration: 0.2, lowpass: 8500 },
  { name: 'cue-2', source: 'shots', start: 9.79, duration: 0.24, lowpass: 8500 },
  { name: 'cushion-1', source: 'shots', start: 4.2, duration: 0.24, lowpass: 1800 },
  { name: 'pocket-1', source: 'inside', start: 4.74, duration: 0.19, lowpass: 6500 },
  { name: 'pocket-2', source: 'inside', start: 8.05, duration: 0.18, lowpass: 6500 },
  { name: 'return-1', source: 'inside', start: 4.93, duration: 0.65, lowpass: 4500 },
  { name: 'return-2', source: 'inside', start: 8.23, duration: 0.65, lowpass: 4500 },
];

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], {
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.toString());
  return result.stdout;
}

for (const clip of clips) {
  const fadeOut = clip.duration - 0.035;
  const processed = ffmpeg([
    '-ss',
    String(clip.start),
    '-i',
    join(resolve(sourceDir), `${clip.source}.mp3`),
    '-t',
    String(clip.duration),
    '-ar',
    '44100',
    '-ac',
    '1',
    '-af',
    `highpass=f=90,lowpass=f=${clip.lowpass},afftdn=nf=-45,afade=t=in:d=0.0005,afade=t=out:st=${fadeOut}:d=0.035`,
    '-f',
    'f32le',
    'pipe:1',
  ]);
  let peak = 0;
  for (let i = 0; i < processed.length; i += 4)
    peak = Math.max(peak, Math.abs(processed.readFloatLE(i)));
  if (peak < 0.005) throw new Error(`Trecho silencioso: ${clip.name}`);
  // O denoiser introduz silêncio inicial. Mantém apenas 2 ms antes do transiente.
  let onset = 0;
  while (onset < processed.length && Math.abs(processed.readFloatLE(onset)) < peak * 0.006)
    onset += 4;
  const pcm = processed.subarray(Math.max(0, onset - 88 * 4));
  const target = Math.pow(10, (clip.name.startsWith('return') ? -4.5 : -2) / 20);
  for (let i = 0; i < pcm.length; i += 4) {
    pcm.writeFloatLE((pcm.readFloatLE(i) * target * Math.min(1, i / (44 * 4))) / peak, i);
  }
  const encoded = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-f',
      'f32le',
      '-ar',
      '44100',
      '-ac',
      '1',
      '-i',
      'pipe:0',
      '-c:a',
      'pcm_s16le',
      '-map_metadata',
      '-1',
      join(outputDir, `${clip.name}.wav`),
    ],
    { input: pcm },
  );
  if (encoded.error) throw encoded.error;
  if (encoded.status !== 0) throw new Error(encoded.stderr.toString());
  console.log(`${clip.name}.wav: ${(pcm.length / 4 / 44100).toFixed(3)} s`);
}
