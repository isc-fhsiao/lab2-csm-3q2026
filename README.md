# Lab 2 CSM: codificação de áudio e imagem sem perdas (Grupo 3)

Relatório do Laboratório 2 da disciplina ESFI001 Comunicações e Sistemas Multimídia (CSM), UFABC,
3º quadrimestre de 2026. Coordenação: Prof. Celso Kurashima.

O laboratório aplica predição linear "exata" e mede o efeito na compressão sem perdas:

- áudio: predição de ordem 1, x̂[n] = x[n-1], erro residual, histograma, entropia e tamanho em FLAC;
- imagem: filtro de Paeth (o mesmo do PNG), mapa do erro, histograma, entropia e tamanho em PNG;
- verificação da reconstrução exata a partir do resíduo;
- comparação com os arquivos dos outros grupos da turma.

## Integrantes

| Nome | RA |
|---|---|
| Fernando Hsiao | 11202231201 |
| Isabella Pierina | 11202230474 |
| Pedro Ricardo Cantu Benedetti | 11202230298 |
| André de Brito Lins | 11201811173 |
| Yasmin Ribeiro Santos | 11202321255 |

## Estrutura

```
analise_lab2.py     análise completa: gera os gráficos e site-lab2/js/dados.js
requirements.txt    bibliotecas Python usadas
audios/             arquivos WAV do laboratório (grupos 1 a 7)
imagens/            arquivos PNG do laboratório (grupos 1 a 7)
site-lab2/          site estático do relatório (HTML, CSS e JS puros)
```

Arquivos do grupo 3: `audios/31_piano.wav`, `audios/32_eletronica_com_ruido.wav`,
`imagens/33_desenho_animado.png` e `imagens/34_multidao.png`. Os demais entram no quadro comparativo da turma.

## Como rodar a análise

Requisitos: Python 3.10 ou mais novo e o `ffmpeg` no PATH (usado para gerar e conferir os arquivos FLAC).

```
pip install -r requirements.txt
python analise_lab2.py
```

O script sobrescreve `site-lab2/img/graficos/`, `site-lab2/audio/` e `site-lab2/js/dados.js`.

## Como ver e publicar o site

- Localmente: abrir `site-lab2/index.html` no navegador (funciona via `file://`).
- Netlify: arrastar a pasta `site-lab2` em app.netlify.com/drop.
- GitHub Pages: em Settings > Pages, publicar a partir da branch `main`; o site fica em `/site-lab2/`.
