// Gera o .exe e copia para release/ (pasta versionada via Git LFS).
// Uso: npm run release
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const distExe = path.join(root, 'dist', 'Gravador-de-Tela-Setup.exe');
const releaseDir = path.join(root, 'release');
const releaseExe = path.join(releaseDir, 'Gravador-de-Tela-Setup.exe');

const builderCli = path.join(root, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js');
execFileSync(process.execPath, [builderCli, '--win', '--publish', 'never'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' }
});

if (!fs.existsSync(distExe)) {
  throw new Error(`build nao gerou ${distExe}`);
}

fs.mkdirSync(releaseDir, { recursive: true });
fs.copyFileSync(distExe, releaseExe);

const mb = (fs.statSync(releaseExe).size / 1024 / 1024).toFixed(1);
console.log(`\nrelease/Gravador-de-Tela-Setup.exe atualizado (${mb} MB)`);
console.log('Agora: git add release && git commit -m "chore: update exe" && git push');
