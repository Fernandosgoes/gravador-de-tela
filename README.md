# Gravador de Tela

App simples de gravação de tela para tutoriais rápidos. Selecione tela inteira ou uma área, grave, anote com caneta/seta, e exporte em MP4 leve.

## Usar (sem instalar nada, sem terminal)

O executável já vem pronto no repositório, em [`release/Gravador-de-Tela.exe`](release/Gravador-de-Tela.exe).

**Opção 1 — baixar só o .exe (mais simples)**
1. Abra [`release/Gravador-de-Tela.exe`](release/Gravador-de-Tela.exe) aqui no GitHub.
2. Clique em **Download**.
3. Dê dois cliques no arquivo baixado. Pronto.

**Opção 2 — clonar o repositório**
1. Botão verde **Code** → **Download ZIP** (ou `git clone`).
2. Extraia e entre na pasta `release/`.
3. Dê dois cliques em `Gravador-de-Tela.exe`. Pronto.

> Não precisa instalar Node, npm, nem rodar nada no terminal. É um executável portátil: roda direto, não instala nada no sistema.

> **Aviso do Windows:** o `.exe` não tem assinatura digital paga, então o SmartScreen pode mostrar "O Windows protegeu o computador". Clique em **Mais informações** → **Executar assim mesmo**.

> **Clonando com `git clone`?** O `.exe` é armazenado via [Git LFS](https://git-lfs.com). Sem o Git LFS instalado, o arquivo vem como um ponteiro de texto de 1 KB em vez do executável. Nesse caso use a Opção 1 (download direto pelo site), que sempre entrega o arquivo real.

## Desenvolvimento

```
npm install
npm start
```

## Atualizar o .exe do repositório

```
npm run release
```
Reconstrói o executável e já atualiza `release/Gravador-de-Tela.exe`. Depois:
```
git add release && git commit -m "chore: update exe" && git push
```

## Controles
- **Tela Inteira / Área Customizada**: escolhe o modo de captura antes de gravar. Área Customizada abre um seletor com handles de redimensionar; Esc ou o botão Cancelar a qualquer momento cancela a seleção.
- **Gravar / Pausar / Parar**: controla a gravação. Durante a gravação, a barra flutuante mostra o cronômetro e pode ser arrastada para qualquer lugar da tela — ela não aparece no vídeo.
- **Cancelar** (durante a gravação): descarta a gravação na hora, sem confirmação.
- **Caneta**: clique para alternar preto → azul → vermelho → desligado. Desenha por cima da tela, some sozinho após 3s.
- **Seta**: liga/desliga modo de apontar com seta (mesmo fade de 3s).
- **Retângulo**: liga/desliga o desenho de retângulos vazados (mesmo fade de 3s).
- **Câmera / Microfone / Áudio do sistema**: escolhidos direto no card, antes de gravar.
- **Salvar / Descartar**: após parar, decide se exporta em MP4 ou descarta a gravação.
- Em modo Área Customizada, uma borda fina marca a região gravada durante toda a gravação — visível só para você, não aparece no vídeo final.
