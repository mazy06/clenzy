/**
 * Package an Imagegen 4x2 Baitly character sheet as transparent motion media.
 * Usage: node scripts/build-baitly-agent-motion.mjs sheet.png output/agent-id
 * Requires FFmpeg (libvpx-vp9), cwebp and img2webp on PATH. No runtime dependency.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const [source, outputPrefix] = process.argv.slice(2);
if (!source || !outputPrefix) throw new Error('Provide source sheet and output prefix');
const output = resolve(outputPrefix);
const scratch = mkdtempSync(join(tmpdir(), 'baitly-agent-video-'));
const run = (binary, args) => execFileSync(binary, args, { stdio: 'inherit' });
const ffmpeg = (...args) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);

try {
  ffmpeg('-i', resolve(source), '-vf', 'scale=1024:512:flags=lanczos,untile=4x2', join(scratch, 'pose-%02d.png'));
  // Times match the 3.2s transmission cycle in supervision/core/dataFlow.ts.
  // Blinks remain brief; the gesture has time to accelerate and return to rest.
  const poses = [[0,1],[1.15,1],[1.216,2],[1.27,2],[1.33,1],[1.45,3],[1.64,4],[1.84,5],[1.92,5],[1.97,6],[2.02,6],[2.08,5],[2.29,4],[2.48,3],[2.68,1],[3.2,1],[3.3,1]];
  const concat = poses.map(([at, frame], index) => (
    `file '${join(scratch, 'pose-'+String(frame).padStart(2,'0')+'.png')}'\noption framerate 1000\n`
    + (index < poses.length - 1 ? `duration ${(poses[index+1][0]-at).toFixed(3)}\n` : '')
  )).join('');
  writeFileSync(join(scratch, 'poses.txt'), concat);

  // Do not use motion-compensated pixel warping on articulated cutouts: hands,
  // props and independently estimated alpha edges tear into block artefacts.
  // Blend the clean poses instead, in premultiplied alpha, so hidden RGB values
  // cannot leak into transparent contours during a transition.
  const interpolation = 'minterpolate=fps=60:mi_mode=blend:scd=none';
  // Restore FULL-RANGE gray before alphamerge: extracting the Y plane directly
  // would introduce opacity into transparent pixels (video-range 16–235).
  const filters = `[0:v]format=gbrap,premultiply=inplace=1,split=2[c][a];[c]format=yuv444p,${interpolation}[rgb];[a]alphaextract,format=yuv444p,${interpolation},format=gray[alpha];[rgb][alpha]alphamerge,format=gbrap,unpremultiply=inplace=1,format=rgba,tpad=stop_mode=clone:stop_duration=0.2,trim=duration=3.2[out]`;
  ffmpeg('-f','concat','-safe','0','-i',join(scratch,'poses.txt'),'-filter_complex',filters,'-map','[out]','-frames:v','192',join(scratch,'frame-%03d.png'));

  // Native video playback preserves quality and supports precise clock sync.
  ffmpeg('-framerate','60','-i',join(scratch,'frame-%03d.png'),'-c:v','libvpx-vp9','-lossless','1','-pix_fmt','yuva420p','-row-mt','1','-cpu-used','4','-g','192','-an',`${output}.webm`);

  // Animated WebP preserves all colours/alpha for browsers without VP9 alpha.
  const webpArgs = ['-loop','0','-min_size','-lossless','-m','4'];
  for (let frame = 1; frame <= 192; frame++) {
    webpArgs.push('-d', String(frame % 3 === 1 ? 16 : 17), join(scratch, `frame-${String(frame).padStart(3,'0')}.png`));
  }
  run('img2webp', [...webpArgs, '-o', `${output}-animated.webp`]);
  run('cwebp', ['-quiet','-q','94','-alpha_q','100',join(scratch,'frame-001.png'),'-o',`${output}.webp`]);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
