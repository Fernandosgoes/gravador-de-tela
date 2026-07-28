# 🎥 Gravador de Tela

App de gravação de tela leve e rápido para Windows, feito para tutoriais e demonstrações. Grave a tela inteira ou uma área customizada, anote em tempo real com caneta/seta/retângulo, acompanhe o cronômetro numa barra flutuante discreta, e exporte direto em MP4. Roda em segundo plano com ícone na bandeja do sistema e atalhos de teclado globais.

**100% gratuito, sem assinatura, sem mensalidade, sem conta.** Sem nuvem, sem telemetria — grava local e salva onde você mandar. Você não precisa confiar seus dados a nenhuma plataforma: baixa, usa, e é seu.

O código inteiro está aqui, aberto — quem quiser entender como funciona, adaptar pro próprio uso ou melhorar alguma coisa pode clonar o repositório e mexer à vontade (veja [Desenvolvimento](#-desenvolvimento)).

## Índice
- [Instalar](#-instalar)
- [Funcionalidades](#-funcionalidades)
- [Controles](#-controles)
- [Desenvolvimento](#-desenvolvimento)
- [Arquitetura](#-arquitetura)
- [Stack técnico](#-stack-técnico)
- [Licença](#-licença)

## 📦 Instalar

O instalador já vem pronto neste repositório, em [`release/Gravador-de-Tela-Setup.exe`](release/Gravador-de-Tela-Setup.exe) — não precisa instalar Node, npm, nem rodar nenhum comando.

**Opção 1 — baixar só o `.exe` (mais simples)**
1. Abra [`release/Gravador-de-Tela-Setup.exe`](release/Gravador-de-Tela-Setup.exe) aqui no GitHub.
2. Clique em **Download**.
3. Dê dois cliques no instalador baixado e siga os passos (escolher pasta, criar atalho). Pronto.

**Opção 2 — clonar o repositório**
1. Botão verde **Code** → **Download ZIP** (ou `git clone`).
2. Extraia e entre na pasta `release/`.
3. Dê dois cliques em `Gravador-de-Tela-Setup.exe` e siga o instalador. Pronto.

É um instalador tradicional (NSIS): copia os arquivos pra pasta escolhida, cria atalho na área de trabalho, e nas próximas aberturas o app inicia direto — sem re-extrair nada, muito mais rápido que rodar um `.exe` portátil toda vez.

> **Aviso do Windows:** o instalador não tem assinatura digital paga (custa dinheiro e não faz sentido pra um projeto pessoal), então o SmartScreen pode mostrar "O Windows protegeu o computador". Clique em **Mais informações** → **Executar assim mesmo**. É o aviso padrão pra qualquer `.exe` não assinado — o código é 100% aberto aqui no repositório, pode conferir.

> **Clonando com `git clone`?** O `.exe` é versionado via [Git LFS](https://git-lfs.com) (arquivos binários grandes não devem virar blob comum no Git). Sem o Git LFS instalado localmente, o arquivo baixado será um ponteiro de texto de ~1 KB em vez do executável de verdade. Nesse caso, use a Opção 1 (download direto pela interface do GitHub), que sempre entrega o arquivo real — o smudge do LFS já roda do lado do servidor.

## ✨ Funcionalidades

- **Dois modos de captura**: tela inteira ou área customizada com handles de redimensionar (8 pontos + mover o retângulo inteiro), label de dimensões em tempo real (`1280 × 720`) e correção automática para displays com escala do Windows diferente de 100%.
- **Contagem regressiva 3-2-1** antes de começar a gravar, pra você se posicionar.
- **Barra flutuante arrastável**: card compacto com dropdowns de câmera/microfone/áudio do sistema, botão de gravar circular, e — durante a gravação — encolhe numa pílula só com cronômetro e Pausar/Parar/Cancelar. Não aparece no vídeo gravado (content protection nativo do Windows).
- **Anotações ao vivo**: caneta, seta apontadora, e retângulo, com paleta de 5 cores (preto, branco, vermelho, amarelo, azul) — todas com fade automático de 6 segundos.
- **Barra se reposiciona sozinha**: ao começar a gravar, ela sai do caminho — fica fora da área selecionada quando há espaço, ou num canto discreto em gravação de tela inteira. Continua arrastável a qualquer momento.
- **Moldura de área**: em gravação de área customizada, uma borda fina marca visualmente a região capturada durante toda a gravação (só pra você, não aparece no vídeo final).
- **Webcam sobreposta**: bolha de câmera arrastável por cima da gravação.
- **Ícone na bandeja do sistema**: fechar a barra só a esconde — o app continua rodando em segundo plano, pronto pro atalho de gravar. Menu da bandeja com "Abrir" e "Sair" de verdade.
- **6 atalhos de teclado globais configuráveis**: gravar/parar, pausar, cancelar, e cada ferramenta de desenho (caneta, seta, retângulo) podem ganhar uma combinação de tecla própria, editável na aba "Atalhos" das configurações. Só o de gravar vem com padrão de fábrica (`Ctrl+Shift+R`) — o resto fica desligado até você escolher.
- **Cancelar gravação**: descarta na hora, sem gerar arquivo, se você errou o take.
- **Exportação em MP4**: grava internamente em WebM e converte com `ffmpeg` embutido; se a conversão falhar por qualquer motivo, salva o WebM como fallback em vez de perder a gravação.
- **Configurações persistentes**: câmera, microfone, áudio do sistema e atalhos ficam salvos entre sessões.

## 🎮 Controles

- **Tela Inteira / Área Customizada**: escolhe o modo de captura antes de gravar. Área Customizada abre um seletor com handles de redimensionar; Esc ou o botão Cancelar a qualquer momento cancela a seleção.
- **Gravar / Pausar / Parar**: controla a gravação. Durante a gravação, a barra flutuante mostra o cronômetro e pode ser arrastada para qualquer lugar da tela.
- **Cancelar** (durante a gravação): descarta a gravação na hora, sem confirmação.
- **Caneta / Seta / Retângulo**: liga/desliga a ferramenta; a cor é escolhida numa paleta de 5 swatches (preto, branco, vermelho, amarelo, azul) que aparece na barra durante a gravação. Desenha por cima da tela, some sozinho após 6s. Um botão dedicado ao lado das cores desliga a ferramenta ativa (alternativa ao Esc).
- **Câmera / Microfone / Áudio do sistema**: escolhidos direto no card, antes de gravar.
- **Salvar / Descartar**: após parar, decide se exporta em MP4 ou descarta a gravação.
- **Ícone da bandeja**: clique para reabrir a barra; menu com "Abrir" e "Sair".
- **Configurações** (ícone de engrenagem): aba "Atalhos" pra definir/remover combinações de teclado; aba "Sobre" com informações do app.

## 🛠 Desenvolvimento

Quer mexer no código, adaptar alguma funcionalidade ou só entender como funciona por dentro? Fique à vontade — é pra isso que o repositório está aberto.

Requer [Node.js](https://nodejs.org) (LTS) e npm.

```bash
git clone https://github.com/Fernandosgoes/gravador-de-tela.git
cd gravador-de-tela
npm install
npm start
```

Isso já roda o app direto do código-fonte, sem precisar buildar nada. Qualquer alteração nos arquivos de `src/` pode ser testada reiniciando o `npm start`.

Rodar os testes automatizados (`node:test`, sem dependências externas):

```bash
npm test
```

Gerar seu próprio instalador `.exe` a partir do código (útil se você alterou algo e quer testar o build empacotado, ou distribuir sua própria versão):

```bash
npm run build
```

O instalador sai em `dist/Gravador-de-Tela-Setup.exe`.

## 🔁 Atualizar o `.exe` do repositório

```bash
npm run release
```

Reconstrói o instalador (via `electron-builder`) e já atualiza `release/Gravador-de-Tela-Setup.exe`. Depois:

```bash
git add release && git commit -m "chore: update exe" && git push
```

## 🏗 Arquitetura

Electron puro, sem bundler — cada janela do processo renderer carrega scripts via `<script>` simples, sem `require()`. Lógica compartilhada testável vive em `src/lib/` e é duplicada inline nos arquivos de renderer com comentário `// Keep in sync with src/lib/X.js`.

```
src/
├── main/           # processo principal: janelas, IPC, captura, export ffmpeg
├── lib/            # lógica pura testada (state machine, crop math, ffmpeg args, gravador de atalho)
├── renderer/       # scripts injetados nas janelas (recorder, webcam)
└── windows/        # uma pasta por BrowserWindow (toolbar, overlay, areaselect, countdown, areaframe)
```

Cada `BrowserWindow` tem seu próprio `preload.js` com `contextIsolation` ativado — o processo main nunca expõe Node/Electron direto pro renderer, só via `contextBridge`.

## 🧰 Stack técnico

- **[Electron 32](https://www.electronjs.org/)** — shell desktop multiplataforma (build atual é Windows-only)
- **[electron-builder](https://www.electron.build/)** — empacotamento no instalador NSIS
- **[ffmpeg-static](https://www.npmjs.com/package/ffmpeg-static)** — binário do ffmpeg embutido, usado só para a conversão final WebM → MP4
- **[lucide-static](https://lucide.dev/)** — ícones SVG inline, sem runtime JS
- **`node:test`** — suíte de testes nativa do Node, sem dependências extras
- **MediaRecorder API / Web Audio API** (nativas do Chromium/Electron) — captura de tela, câmera e mixagem de áudio
- **Git LFS** — versionamento do executável pré-compilado neste repositório

## 📄 Licença

Projeto pessoal, feito por **Fernando Sabino Goes**, sem licença formal definida ainda. É gratuito — sem assinatura, sem mensalidade, sem pegadinha — e o código está aberto pra qualquer um usar, estudar, clonar e adaptar como quiser.
