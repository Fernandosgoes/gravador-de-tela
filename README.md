# 🎥 Gravador de Tela

App de gravação de tela leve e rápido para Windows, feito para tutoriais e demonstrações. Grave a tela inteira ou uma área customizada, anote em tempo real com caneta/seta/retângulo, acompanhe o cronômetro numa barra flutuante discreta, e exporte direto em MP4. Roda em segundo plano com ícone na bandeja do sistema e atalho de teclado global.

Sem conta, sem nuvem, sem telemetria — grava local e salva onde você mandar.

## Índice
- [Usar sem instalar nada](#-usar-sem-instalar-nada-sem-terminal)
- [Funcionalidades](#-funcionalidades)
- [Controles](#-controles)
- [Desenvolvimento](#-desenvolvimento)
- [Arquitetura](#-arquitetura)
- [Stack técnico](#-stack-técnico)

## 📦 Usar sem instalar nada (sem terminal)

O executável já vem pronto neste repositório, em [`release/Gravador-de-Tela.exe`](release/Gravador-de-Tela.exe) — não precisa instalar Node, npm, nem rodar nenhum comando.

**Opção 1 — baixar só o `.exe` (mais simples)**
1. Abra [`release/Gravador-de-Tela.exe`](release/Gravador-de-Tela.exe) aqui no GitHub.
2. Clique em **Download**.
3. Dê dois cliques no arquivo baixado. Pronto.

**Opção 2 — clonar o repositório**
1. Botão verde **Code** → **Download ZIP** (ou `git clone`).
2. Extraia e entre na pasta `release/`.
3. Dê dois cliques em `Gravador-de-Tela.exe`. Pronto.

É um executável portátil: roda direto, não instala nada no sistema, não precisa de admin.

> **Aviso do Windows:** o `.exe` não tem assinatura digital paga (custa dinheiro e não faz sentido pra um projeto pessoal), então o SmartScreen pode mostrar "O Windows protegeu o computador". Clique em **Mais informações** → **Executar assim mesmo**. É o aviso padrão pra qualquer `.exe` não assinado — o código é 100% aberto aqui no repositório, pode conferir.

> **Clonando com `git clone`?** O `.exe` é versionado via [Git LFS](https://git-lfs.com) (arquivos binários grandes não devem virar blob comum no Git). Sem o Git LFS instalado localmente, o arquivo baixado será um ponteiro de texto de ~1 KB em vez do executável de verdade. Nesse caso, use a Opção 1 (download direto pela interface do GitHub), que sempre entrega o arquivo real — o smudge do LFS já roda do lado do servidor.

## ✨ Funcionalidades

- **Dois modos de captura**: tela inteira ou área customizada com handles de redimensionar (8 pontos + mover o retângulo inteiro), label de dimensões em tempo real (`1280 × 720`) e correção automática para displays com escala do Windows diferente de 100%.
- **Contagem regressiva 3-2-1** antes de começar a gravar, pra você se posicionar.
- **Barra flutuante arrastável**: card compacto com dropdowns de câmera/microfone/áudio do sistema, botão de gravar circular, e — durante a gravação — encolhe numa pílula só com cronômetro e Pausar/Parar/Cancelar. Não aparece no vídeo gravado (content protection nativo do Windows).
- **Anotações ao vivo**: caneta (preto → azul → vermelho → desligado), seta apontadora, e retângulo — todas com fade automático de 3 segundos.
- **Moldura de área**: em gravação de área customizada, uma borda fina marca visualmente a região capturada durante toda a gravação (só pra você, não aparece no vídeo final).
- **Webcam sobreposta**: bolha de câmera arrastável por cima da gravação.
- **Ícone na bandeja do sistema**: fechar a barra só a esconde — o app continua rodando em segundo plano, pronto pro atalho de gravar. Menu da bandeja com "Abrir" e "Sair" de verdade.
- **Atalho de teclado global**: `Ctrl+Shift+R` (configurável) inicia/para a gravação sem precisar focar a janela.
- **Cancelar gravação**: descarta na hora, sem gerar arquivo, se você errou o take.
- **Exportação em MP4**: grava internamente em WebM e converte com `ffmpeg` embutido; se a conversão falhar por qualquer motivo, salva o WebM como fallback em vez de perder a gravação.
- **Configurações persistentes**: câmera, microfone, áudio do sistema e atalho de teclado ficam salvos entre sessões.

## 🎮 Controles

- **Tela Inteira / Área Customizada**: escolhe o modo de captura antes de gravar. Área Customizada abre um seletor com handles de redimensionar; Esc ou o botão Cancelar a qualquer momento cancela a seleção.
- **Gravar / Pausar / Parar**: controla a gravação. Durante a gravação, a barra flutuante mostra o cronômetro e pode ser arrastada para qualquer lugar da tela.
- **Cancelar** (durante a gravação): descarta a gravação na hora, sem confirmação.
- **Caneta**: clique para alternar preto → azul → vermelho → desligado. Desenha por cima da tela, some sozinho após 3s.
- **Seta**: liga/desliga modo de apontar com seta (mesmo fade de 3s).
- **Retângulo**: liga/desliga o desenho de retângulos vazados (mesmo fade de 3s).
- **Câmera / Microfone / Áudio do sistema**: escolhidos direto no card, antes de gravar.
- **Salvar / Descartar**: após parar, decide se exporta em MP4 ou descarta a gravação.
- **Ícone da bandeja**: clique para reabrir a barra; menu com "Abrir" e "Sair".
- **`Ctrl+Shift+R`** (padrão, configurável): inicia/para a gravação de qualquer lugar do Windows.

## 🛠 Desenvolvimento

Requer [Node.js](https://nodejs.org) (LTS) e npm.

```bash
npm install
npm start
```

Rodar os testes automatizados (`node:test`, sem dependências externas):

```bash
npm test
```

## 🔁 Atualizar o `.exe` do repositório

```bash
npm run release
```

Reconstrói o executável (via `electron-builder`) e já atualiza `release/Gravador-de-Tela.exe`. Depois:

```bash
git add release && git commit -m "chore: update exe" && git push
```

## 🏗 Arquitetura

Electron puro, sem bundler — cada janela do processo renderer carrega scripts via `<script>` simples, sem `require()`. Lógica compartilhada testável vive em `src/lib/` e é duplicada inline nos arquivos de renderer com comentário `// Keep in sync with src/lib/X.js`.

```
src/
├── main/           # processo principal: janelas, IPC, captura, export ffmpeg
├── lib/            # lógica pura testada (state machine, crop math, color cycle, ffmpeg args, atalhos)
├── renderer/       # scripts injetados nas janelas (recorder, webcam)
└── windows/        # uma pasta por BrowserWindow (toolbar, overlay, areaselect, countdown, areaframe)
```

Cada `BrowserWindow` tem seu próprio `preload.js` com `contextIsolation` ativado — o processo main nunca expõe Node/Electron direto pro renderer, só via `contextBridge`.

## 🧰 Stack técnico

- **[Electron 32](https://www.electronjs.org/)** — shell desktop multiplataforma (build atual é Windows-only)
- **[electron-builder](https://www.electron.build/)** — empacotamento em executável portátil
- **[ffmpeg-static](https://www.npmjs.com/package/ffmpeg-static)** — binário do ffmpeg embutido, usado só para a conversão final WebM → MP4
- **[lucide-static](https://lucide.dev/)** — ícones SVG inline, sem runtime JS
- **`node:test`** — suíte de testes nativa do Node, sem dependências extras
- **MediaRecorder API / Web Audio API** (nativas do Chromium/Electron) — captura de tela, câmera e mixagem de áudio
- **Git LFS** — versionamento do executável pré-compilado neste repositório

## 📄 Licença

Projeto pessoal, sem licença formal definida ainda. Uso e estudo do código são bem-vindos.
