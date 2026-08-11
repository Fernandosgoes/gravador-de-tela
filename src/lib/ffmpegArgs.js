function buildTranscodeArgs(inputPath, outputPath) {
  return [
    '-i', inputPath,
    // libx264 requires even width/height (yuv420p chroma subsampling) —
    // custom-area recordings can produce odd dimensions (e.g. 1087x641),
    // which otherwise makes the encoder fail immediately with "Error while
    // opening encoder". Trims one pixel off the odd side rather than padding,
    // since a 1px crop is imperceptible and avoids adding visible letterboxing.
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v', 'libx264',
    '-crf', '23',
    '-preset', 'medium',
    '-c:a', 'aac',
    outputPath
  ];
}

module.exports = { buildTranscodeArgs };
