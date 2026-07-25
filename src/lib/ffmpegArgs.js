function buildTranscodeArgs(inputPath, outputPath) {
  return [
    '-i', inputPath,
    '-c:v', 'libx264',
    '-crf', '23',
    '-preset', 'medium',
    '-c:a', 'aac',
    outputPath
  ];
}

module.exports = { buildTranscodeArgs };
