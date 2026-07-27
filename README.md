# Gravador de Tela

App simples de gravação de tela para tutoriais rápidos. Selecione tela inteira ou uma área, grave, anote com caneta/seta, e exporte em MP4 leve.

## Usar (sem instalar nada)
Baixe o `.exe` mais recente na aba [Releases](../../releases) deste repositório e execute.

## Rodar a partir do código
```
npm install
npm start
```

## Gerar o .exe
```
npm run build
```
O executável fica em `dist/`.

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
