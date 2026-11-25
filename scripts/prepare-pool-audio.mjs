import { mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { extendCushionTail } from './cushion-tail.mjs';

// Baixe os previews HQ e consulte suas licenças em docs/audio.md.
const sourceDir = process.argv[2];
const selected = process.argv.slice(3);
if (!sourceDir)
  throw new Error(
    'Uso: node scripts/prepare-pool-audio.mjs <diretorio-das-fontes> [ball cushion ...]',
  );
const outputDir = fileURLToPath(new URL('../apps/web/src/audio/samples/', import.meta.url));
mkdirSync(outputDir, { recursive: true });

const clips = [
  // Janelas após a colisão (excluem a tacada anterior), até a ressonância decair.
  { name: 'ball-1', source: 'hit-1', start: 1.13, duration: 0.54, natural: true, clean: true },
  { name: 'ball-2', source: 'hit-2', start: 0.86, duration: 0.56, natural: true, clean: true },
  { name: 'ball-3', source: 'hit-3', start: 0.73, duration: 0.52, natural: true, clean: true },
  { name: 'cue-1', source: 'shots', start: 7.08, duration: 0.2, lowpass: 8500 },
  { name: 'cue-2', source: 'shots', start: 9.79, duration: 0.24, lowpass: 8500 },
  // Rebote real na borracha, não uma colisão de bolas abafada por filtro.
  // Lê também o silêncio ANTES do impacto para medir o chiado, sem capturar a batida.
  { name: 'cushion-1', source: 'rail', start: 0, duration: 0.85, cushion: true },
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

if (selected.some((kind) => !clips.some((clip) => clip.name.startsWith(`${kind}-`))))
  throw new Error('Categoria desconhecida. Use ball, cushion, cue, pocket ou return.');

for (const clip of clips.filter(
  (clip) => !selected.length || selected.some((kind) => clip.name.startsWith(`${kind}-`)),
)) {
  const fadeOut = clip.duration - 0.035;
  // Os perfis fixos excluem impactos; não há gate cortando sua ressonância.
  // Para bolas, lê o ambiente antes de recortar e compensa 25 ms de latência do afftdn.
  const filters = clip.cushion
    ? "highpass=f=70,lowpass=f=10000,apad=pad_dur=0.12,asendcmd=c='0.02 afftdn sn start;0.28 afftdn sn stop',afftdn=nr=22:nf=-60:gs=8"
    : clip.clean
      ? `highpass=f=55,lowpass=f=14000,asendcmd=c='0.02 afftdn sn start;0.28 afftdn sn stop',afftdn=nr=20:nf=-65:gs=8,atrim=start=${clip.start + 0.025}:duration=${clip.duration},asetpts=PTS-STARTPTS`
      : clip.natural
        ? 'highpass=f=55,lowpass=f=14000'
        : `highpass=f=90,lowpass=f=${clip.lowpass},afftdn=nf=-45,afade=t=in:d=0.0005,afade=t=out:st=${fadeOut}:d=0.035`;
  const processed = ffmpeg([
    '-ss',
    String(clip.clean ? 0 : clip.start),
    '-i',
    join(resolve(sourceDir), `${clip.source}.mp3`),
    '-t',
    String(clip.duration),
    '-ar',
    '44100',
    '-ac',
    '1',
    '-af',
    filters,
    '-f',
    'f32le',
    'pipe:1',
  ]);
  let peak = 0;
  for (let i = 0; i < processed.length; i += 4)
    peak = Math.max(peak, Math.abs(processed.readFloatLE(i)));
  if (peak < 0.005) throw new Error(`Trecho silencioso: ${clip.name}`);
  if (clip.natural) {
    // Mede ANTES do fade: zerar o último sample não prova que a cauda foi preservada.
    const tail = processed.subarray(Math.round((fadeOut - 0.02) * 44100) * 4);
    let energy = 0;
    for (let i = 0; i < tail.length; i += 4) energy += tail.readFloatLE(i) ** 2;
    if (Math.sqrt(energy / (tail.length / 4)) / peak > 0.01)
      throw new Error(`Cauda ainda audível: amplie a janela de ${clip.name}`);
  }
  // Remove a espera inicial, inclusive a latência do denoiser nas amostras antigas.
  // Mantém 2 ms antes do transiente.
  let onset = 0;
  while (onset < processed.length && Math.abs(processed.readFloatLE(onset)) < peak * 0.006)
    onset += 4;
  let pcm = processed.subarray(Math.max(0, onset - 88 * 4));
  if (clip.cushion) {
    const dry = Float32Array.from({ length: pcm.length / 4 }, (_, i) => pcm.readFloatLE(i * 4));
    // Retira só o ruído residual da extremidade da captação já limpa.
    for (let i = 0; i < dry.length; i++)
      dry[i] *= Math.min(1, (dry.length - 1 - i) / (0.08 * 44100));
    const room = extendCushionTail(dry);
    pcm = Buffer.alloc(room.length * 4);
    peak = 0;
    room.forEach((sample, i) => {
      pcm.writeFloatLE(sample, i * 4);
      peak = Math.max(peak, Math.abs(sample));
    });
  }
  const target = Math.pow(10, (clip.name.startsWith('return') ? -4.5 : -2) / 20);
  for (let i = 0; i < pcm.length; i += 4) {
    // A tabela só chega ao fade final depois de a sala decair, abaixo do nível audível.
    const fadeDuration = clip.cushion ? 0.12 : 0.035;
    const fade =
      clip.natural || clip.cushion
        ? Math.min(1, (pcm.length - 4 - i) / (fadeDuration * 44100 * 4))
        : 1;
    pcm.writeFloatLE((pcm.readFloatLE(i) * target * Math.min(1, i / (44 * 4)) * fade) / peak, i);
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
