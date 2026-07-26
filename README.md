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
- **Iniciar / Pausar / Parar**: controla a gravação.
- **Caneta**: clique para alternar preto → azul → vermelho → desligado. Desenha por cima da tela, some sozinho após 3s.
- **Seta**: liga/desliga modo de apontar com seta (mesmo fade de 3s).
- **Config**: escolhe câmera, liga/desliga microfone e áudio do sistema.
- **Salvar / Deletar**: após parar, decide se exporta em MP4 ou descarta a gravação.
