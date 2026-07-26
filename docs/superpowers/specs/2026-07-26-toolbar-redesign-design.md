# Redesign da Toolbar — Card Flutuante Estilo Dadan/Loom

## Context

O app "Gravador de Tela" (Electron, já implementado e mergeado em `master`) tem uma barra flutuante funcional mas visualmente crua: botões de texto simples, dialog nativo feio (`confirm()`) pra escolher tela inteira vs área customizada, sem contagem regressiva, sem cronômetro visível, sem ícones, janela de configurações separada da barra principal, e nenhum atalho pra abrir a pasta onde a gravação foi salva.

O usuário mostrou a extensão **Dadan** como referência (print anexado): card vertical compacto, modo de captura em blocos clicáveis, dropdowns de câmera/mic inline, botão de gravar grande e central. Quer a mesma qualidade visual e funcional, adaptada ao fluxo já existente (área customizada com handles de ajuste, contagem regressiva, cronômetro, atalho de pasta).

Este design substitui a UI da toolbar e o fluxo de seleção de área — a lógica de gravação/composição/export por trás (Tasks 1-14 já implementadas) **não muda**, só a camada de apresentação e o fluxo de interação em volta dela.

## Processo de Execução — Visual Companion

Antes de implementar, usar o **visual companion** do brainstorming (mockups num artifact/browser tab) pra gerar opções visuais REAIS das telas (card expandido, card compacto, overlay de contagem, overlay de área com handles) e deixar o usuário escolher/ajustar entre variações antes de virar código de produção. Não pular direto pra escrever HTML/CSS final a partir só do texto deste spec — a etapa de mockup interativo é parte explícita do processo pedido.

## Direção Visual

**Paleta:** fundo janela `#18181B`, superfície card `#232326`, borda sutil `#2E2E32`, texto primário `#E4E4E7`, texto secundário `#8A8A93`, accent gravação `#FF3B30` (vermelho "live"), accent confirmação `#30D158` (verde, usado no highlight de área selecionada).

**Tipografia:** Inter em todos os pesos (400 corpo, 500 labels, 600 botões/título). Sem serifa — é UI utilitária, não precisa de par decorativo.

**Ícones:** pacote `lucide` (SVG puro, sem dependência de framework), stroke 1.75, tamanho 18-20px. Novo dependency em `package.json`.

**Assinatura visual:** o botão de Gravar — círculo vermelho com pulse sutil (`animation` CSS, respeitando `prefers-reduced-motion`) quando pronto pra gravar; vira quadrado (ícone stop) durante gravação, convenção universal de record/stop.

**Radius/sombra:** card `border-radius: 14px`, `box-shadow` suave pra destacar do fundo (a janela em si é transparente, só o card tem fundo sólido).

## Arquitetura

Toolbar continua sendo uma única `BrowserWindow` frameless, mas o HTML interno ganha **dois estados visuais via CSS class no body** (`state-idle`/`state-preview` = card expandido; `state-recording`/`state-paused` = pílula compacta), controlados pelo `render()` existente em `toolbar.js`. A janela do Electron redimensiona dinamicamente (`win.setSize(...)`) entre os dois estados via um novo IPC `toolbar:resize`.

Settings (câmera/mic/áudio sistema) deixa de ser janela separada — dropdowns inline no card, usando o `appSettings`/`settings:get`/`settings:update` IPC já existentes (só migra a UI, não a lógica). `createSettingsWindow()`, `open-settings` IPC e `src/windows/settings/` são removidos.

## Fluxos de Entrada

- **Tela Inteira**: usuário deixa "Tela Inteira" selecionado (default) → clica botão Gravar grande → dispara diretamente o overlay de contagem (item 2) → grava.
- **Área Customizada**: usuário clica o bloco "Área Customizada" → dispara imediatamente o overlay de seleção com handles (item 3) → usuário ajusta e clica "Iniciar gravação" (botão dentro do overlay de seleção, não o botão Gravar do card) → overlay de contagem (item 2) → grava. O botão Gravar grande do card fica desabilitado/oculto enquanto o modo "Área Customizada" está selecionado, já que a ação de iniciar acontece dentro do próprio overlay de seleção.

## Componentes

### 1. Card expandido (estado idle/preview) — `src/windows/toolbar/index.html` + `toolbar.css`
Layout vertical ~300px largura, auto-altura:
- Header: título "Gravador de Tela" + botão fechar (×) — mantém o dragbar atual.
- **Modo de captura**: dois blocos lado a lado, clicáveis, com ícone lucide (`monitor` / `crop`) + label ("Tela Inteira" / "Área Customizada"). "Tela Inteira" apenas marca o modo (`.active`, default selecionado) — a captura só começa ao clicar o botão Gravar grande. "Área Customizada" dispara IMEDIATAMENTE o fluxo de seleção de área (item 3 abaixo) ao ser clicado, sem esperar o botão Gravar — o botão "Iniciar gravação" que aparece dentro desse fluxo é quem efetivamente começa a captura.
- **Dropdown Câmera**: `<select>` com opção "Nenhuma câmera" (value vazio) + devices reais, populado via `enumerateDevices()` (lógica já existe em `settings.js`, migra pra `toolbar.js`).
- **Dropdown Microfone**: mesmo padrão, + toggle de áudio do sistema (checkbox estilizado, não checkbox nativo cru).
- **Botão Gravar**: círculo grande vermelho (`#FF3B30`), ícone lucide `circle` preenchido, label "Gravar" embaixo ou ao lado. Pulse sutil via CSS.
- **Linha de ferramentas**: 3 ícones lucide em botões quadrados discretos — `pen` (caneta), `move-up-right` ou `arrow-up-right` (seta), `folder-open` (abrir pasta da última gravação salva).

Pós-gravação (estado `preview`): botão Gravar vira dois botões lado a lado "Salvar" (verde) e "Descartar" (outline vermelho), resto do card (modo captura/dropdowns) fica desabilitado/oculto — igual comportamento atual, só troca visual.

### 2. Fluxo Tela Inteira — novo overlay de contagem
Ao clicar Gravar com modo "Tela Inteira" selecionado:
1. Novo overlay window fullscreen semi-transparente escurecido (`rgba(0,0,0,0.5)`) sobe por cima de tudo.
2. Número grande centralizado, contagem 3 → 2 → 1 (CSS animation de fade/scale por número, ~1s cada).
3. Ao fim, overlay fecha, `recorderApi.start(sourceId, null)` dispara, toolbar entra em estado `recording`.

Reaproveita o padrão de janela transparente/alwaysOnTop já usado em `createOverlayWindow()`/`createAreaSelectWindow()`.

### 3. Fluxo Área Customizada — reformulação de `src/windows/areaselect/`
Substitui o overlay atual (retângulo simples, sem ajuste) por:
1. Overlay escurecido (`rgba(0,0,0,0.55)` fora da seleção, área selecionada sem escurecimento — "spotlight").
2. Arrasta pra desenhar retângulo inicial (mousedown/move/up, lógica já existe em `areaselect.js`).
3. Após soltar: aparecem **handles** nos 4 cantos + 4 bordas (8 pontos), arrastáveis pra redimensionar; retângulo também pode ser movido inteiro arrastando o centro.
4. **Label de dimensões** flutuante próximo à área (ex: "1280 × 720"), atualiza em tempo real durante ajuste.
5. **Botão "Iniciar gravação"** flutuante logo abaixo/dentro da área selecionada.
6. Ao clicar Iniciar: overlay de contagem 3-2-1 (mesmo componente do fluxo tela inteira) roda por cima, depois fecha tudo e inicia gravação com o `cropRect` calculado (via `toCropParams`, já existente).
7. Esc a qualquer momento cancela e volta pro card.

### 4. Card compacto (estado recording/paused) — mesma `index.html`, CSS state diferente
Pílula horizontal pequena (~180×48px):
- Indicador vermelho pulsante (bolinha) + **cronômetro** `00:00` formatado `mm:ss`, atualizado a cada segundo via `setInterval` no `toolbar.js` (novo, usa timestamp de início armazenado no módulo).
- Botão Pausar/Retomar (ícone `pause`/`play`) e Parar (ícone `square`), compactos, sem label de texto.

Janela redimensiona de ~300×~380 (expandido) pra ~180×48 (compacto) via `win.setSize()` disparado por IPC quando `render()` muda de estado.

### 5. Abrir pasta da última gravação
Novo IPC `export:open-last-folder`, handler em `src/main/export.js` ou `index.js` usa `shell.showItemInFolder(lastSavedPath)` (Electron `shell` module). `lastSavedPath` é uma variável em memória no main process, atualizada dentro de `saveRecording()` após sucesso (guarda o `filePath` final, seja `.mp4` ou fallback `.webm`). Se nunca salvou nada na sessão, botão fica desabilitado (`title="Nenhuma gravação salva ainda"`).

## Remoção

- `src/windows/settings/` (index.html, settings.js, preload.js) — deletado inteiro.
- `createSettingsWindow()`, `settingsWindow` variable, `open-settings` IPC handler em `src/main/index.js` — removidos.
- `openSettings` do bridge `window.gravador` em `toolbar/preload.js` — removido.
- Botão `btnConfig` do HTML/toolbar.js — removido (funcionalidade absorvida pelos dropdowns inline).

`settings:get`/`settings:update`/`settings:changed`/`appSettings` **permanecem** (só a UI que os consome muda de lugar).

## Novo Dependency

`package.json`: adiciona `lucide` (ou `lucide-static` — ícones SVG prontos, sem runtime JS necessário já que não há framework) como dependency. Ícones importados como SVG inline no HTML/JS (copiar o path SVG de cada ícone usado, já que não há bundler no projeto — mesmo padrão de "sem build step" já estabelecido).

## Verificação
- `npm test` continua passando (nenhuma lib pura de `src/lib/` muda).
- Manual: abrir app, ver card expandido com novo visual; alternar modo captura; abrir dropdowns e confirmar população real de devices; clicar Gravar em Tela Inteira → ver contagem 3-2-1 → gravação inicia → card encolhe pra pílula com cronômetro rodando; parar → card expande de novo em modo preview → Salvar → clicar ícone pasta → Explorer abre no arquivo salvo.
- Testar fluxo Área Customizada: arrastar, ajustar com handles, ver label de dimensões atualizando, clicar Iniciar, ver contagem, gravar, confirmar crop correto no arquivo final.
- Testar Esc cancelando seleção de área em qualquer ponto do ajuste.
