const { test } = require('node:test');
const assert = require('node:assert');
const { buildTranscodeArgs } = require('../src/lib/ffmpegArgs');

test('builds correct ffmpeg args for mp4 transcode', () => {
  const args = buildTranscodeArgs('in.webm', 'out.mp4');
  assert.deepStrictEqual(args, [
    '-i', 'in.webm',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v', 'libx264',
    '-crf', '23',
    '-preset', 'medium',
    '-c:a', 'aac',
    'out.mp4'
  ]);
});

test('quotes paths with spaces are passed through unmodified (spawn handles quoting)', () => {
  const args = buildTranscodeArgs('C:/temp/my recording.webm', 'C:/out/final video.mp4');
  assert.strictEqual(args[1], 'C:/temp/my recording.webm');
  assert.strictEqual(args[args.length - 1], 'C:/out/final video.mp4');
});
