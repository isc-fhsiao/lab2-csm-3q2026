/* Lab 2 CSM, Grupo 3. Preenche tabelas, gráficos SVG e visualizadores a partir de window.LAB. */
(function () {
  "use strict";
  var LAB = window.LAB;
  if (!LAB) { return; }
  var AU = LAB.audios, IM = LAB.imagens;
  var NOME_CANAL = ["esquerdo", "direito"];

  /* ------------------------------------------------------------ utilidades */
  function fmt(v, casas) {
    if (v === null || v === undefined || isNaN(v)) { return "não se aplica"; }
    casas = casas === undefined ? 2 : casas;
    return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  }
  function fi(v) { return Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 }); }
  function pct(a, b, casas) { return fmt(100 * a / b, casas === undefined ? 1 : casas) + "%"; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  function tabela(id, cab, linhas, classes) {
    var t = $(id); if (!t) { return; }
    var cap = t.querySelector("caption");
    t.innerHTML = "";
    if (cap) { t.appendChild(cap); }
    var th = document.createElement("thead"), tr = document.createElement("tr");
    cab.forEach(function (c, i) {
      var e = document.createElement("th"); e.scope = "col"; e.innerHTML = c.t || c;
      if (c.num || (i > 0 && c.num !== false && cab.numDefault)) { e.className = "num"; }
      tr.appendChild(e);
    });
    th.appendChild(tr); t.appendChild(th);
    var tb = document.createElement("tbody");
    linhas.forEach(function (l, k) {
      var r = document.createElement("tr");
      if (classes && classes[k]) { r.className = classes[k]; }
      l.forEach(function (v, i) {
        var e = document.createElement(i === 0 ? "th" : "td");
        if (i === 0) { e.scope = "row"; }
        if (v && typeof v === "object") { e.innerHTML = v.h; if (v.c) { e.className = v.c; } }
        else { e.innerHTML = v; if (i > 0 && cab.numDefault) { e.className = "num"; } }
        r.appendChild(e);
      });
      tb.appendChild(r);
    });
    t.appendChild(tb);
  }
  function num(arr) { arr.numDefault = true; return arr; }

  var timers = {};
  function anunciar(id, texto) {
    clearTimeout(timers[id]);
    timers[id] = setTimeout(function () { var e = $(id); if (e) { e.textContent = texto; } }, 350);
  }

  /* ---------------------------------------------------------------- tema */
  (function () {
    var bt = $("bt-tema"), root = document.documentElement;
    function escuro() {
      var t = root.getAttribute("data-theme");
      if (t) { return t === "dark"; }
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    function rotulo() {
      var e = escuro();
      bt.textContent = e ? "Tema claro" : "Tema escuro";
      bt.setAttribute("aria-pressed", e ? "true" : "false");
    }
    bt.addEventListener("click", function () {
      var novo = escuro() ? "light" : "dark";
      root.setAttribute("data-theme", novo);
      try { localStorage.setItem("tema-lab2", novo); } catch (e) {}
      rotulo();
    });
    rotulo();
  })();

  /* ============================================================ PARTE A */
  var pi = AU[0], el = AU[1];
  function flacPct(a) { return pct(a.flac.lpc, a.tam_arquivo); }
  tabela("tab-audio-info", num(["Atributo", pi.titulo, el.titulo]), [
    ["Arquivo", "<code>" + pi.arquivo + "</code>", "<code>" + el.arquivo + "</code>"],
    ["Taxa de amostragem (Hz)", fi(pi.fs), fi(el.fs)],
    ["Tipo no arquivo", pi.dtype, el.dtype],
    ["Resolução real (bits)", pi.bits, el.bits + " (em float)"],
    ["Canais", pi.canais, el.canais],
    ["Amostras por canal", fi(pi.amostras), fi(el.amostras)],
    ["Duração (s)", fmt(pi.duracao), fmt(el.duracao)],
    ["Tamanho do arquivo (bytes)", fi(pi.tam_arquivo), fi(el.tam_arquivo)],
    ["Fórmula do notebook: canais × amostras × bytes", fi(pi.tam_notebook), fi(el.tam_notebook)],
    ["Cabeçalho (diferença, bytes)", fi(pi.cabecalho), fi(el.cabecalho)],
    ["PCM na resolução real (bytes)", fi(pi.tam_pcm_bits), fi(el.tam_pcm_bits)],
    ["FLAC sem perdas (bytes)", fi(pi.flac.lpc), fi(el.flac.lpc)],
    ["FLAC / arquivo original", flacPct(pi), flacPct(el)],
    ["FLAC decodificado igual ao original", pi.flac_identico ? "sim" : "não", el.flac_identico ? "sim" : "não"],
    ["Amostras no fundo de escala", fi(pi.satur), fi(el.satur)]
  ]);

  (function () {
    var box = $("players-audio"); if (!box) { return; }
    AU.forEach(function (a) {
      var d = document.createElement("div");
      d.innerHTML = '<h3 id="pl-' + a.id + '">' + esc(a.titulo) + "</h3>" +
        '<p style="margin:4px 0">Original (FLAC, ' + fi(a.flac.lpc / 1024) + ' KiB)</p>' +
        '<audio controls preload="none" src="audio/' + a.id + '_original.flac" aria-label="' + esc(a.titulo) + ', original"></audio>' +
        '<p style="margin:4px 0">Erro residual e[n] (FLAC, ' + fi(a.tam_flac_residuo / 1024) + ' KiB)</p>' +
        '<audio controls preload="none" src="audio/' + a.id + '_residuo.flac" aria-label="' + esc(a.titulo) + ', erro residual"></audio>' +
        '<p style="font-size:.9rem;margin:6px 0 0">Analista: ' + esc(a.analista) + ". Predição e entropia: " + esc(a.preditor) + ".</p>";
      box.appendChild(d);
    });
  })();

  /* alt dos gráficos de áudio, gerados a partir dos dados */
  function bps(a, m) { return a.flac[m] * 8 / (a.amostras * a.canais); }
  function so(a, k) { return a.stats_original[k]; }
  function sr(a, k) { return a.stats_residuo[k]; }
  $("fig-piano-tempo").alt = "Dois gráficos no tempo do piano, " + fmt(pi.duracao) + " s, canais esquerdo e direito sobrepostos, com amplitude normalizada pelo fundo de escala. " +
    "Em cima, o original mostra ataques de notas seguidos de decaimento lento, chegando perto de 1. Embaixo, na mesma escala, o erro residual fica quase todo perto de zero: " +
    "desvio padrão de " + fmt(sr(pi, 0).dp, 1) + " contra " + fmt(so(pi, 0).dp, 1) + " do original no canal esquerdo, em valores inteiros.";
  $("fig-eletronica-tempo").alt = "Dois gráficos no tempo da música eletrônica, " + fmt(el.duracao) + " s, dois canais. Em cima, o original começa e termina com amplitude perto de 0,3 e, entre cerca de 1,2 s e 5,8 s, " +
    "fica com envelope quase constante perto de mais ou menos 0,53. Embaixo, o erro residual é bem menor que o original, mas tem muitos picos espalhados, alguns acima de 0,5; o maior chega a " +
    fmt(el.stats_residuo_ambos.max / Math.pow(2, 23), 2) + " do fundo de escala.";
  $("fig-piano-zoom").alt = "Trecho de 200 amostras do piano a partir do índice " + fi(pi.zoom_ini) + ". Em cima, a curva original e os degraus do predito quase se sobrepõem; o predito é o original atrasado de uma amostra. " +
    "Embaixo, o erro varia devagar, entre cerca de -1500 e 1300, muito menor que o sinal, que vai de cerca de -13000 a 21000.";
  $("fig-eletronica-zoom").alt = "Trecho de 200 amostras da música eletrônica a partir do índice " + fi(el.zoom_ini) + ", em valores inteiros de 24 bits (milhões). O sinal tem subidas e descidas rápidas e patamares em cerca de -4,4 milhões. " +
    "Nas transições o erro passa de 2 milhões, e o maior salto do trecho, logo no início, passa de 5 milhões. Nos patamares o erro é quase zero.";
  function altHist(a) {
    return "Dois histogramas de " + a.titulo + ". À esquerda, em escala logarítmica, o original (azul) se espalha por quase toda a faixa, e o resíduo (laranja) fica concentrado perto de zero. " +
      "À direita, o histograma do resíduo em escala linear tem um pico agudo em zero. Desvio padrão do resíduo: " + fmt(a.stats_residuo_ambos.dp, 1) +
      "; mínimo " + fi(a.stats_residuo_ambos.min) + " e máximo " + fi(a.stats_residuo_ambos.max) + ".";
  }
  $("fig-piano-hist").alt = altHist(pi);
  $("fig-eletronica-hist").alt = altHist(el);

  /* ============================================================ PARTE B */
  (function () {
    var linhas = [], cls = [];
    AU.forEach(function (a) {
      for (var k = 0; k < a.canais; k++) {
        [["original", a.stats_original[k]], ["resíduo", a.stats_residuo[k]]].forEach(function (p) {
          var s = p[1];
          linhas.push([a.titulo + ", canal " + NOME_CANAL[k] + ", " + p[0], fmt(s.media, 2), fmt(s.dp, 1), fi(s.min), fi(s.max), fi(s.amp),
            p[0] === "resíduo" ? fmt(a.ganho_db[k], 1) : ""]);
          cls.push(p[0] === "resíduo" ? "destaque" : "");
        });
      }
      var s = a.stats_residuo_ambos;
      linhas.push([a.titulo + ", resíduo com os dois canais juntos (como no notebook)", fmt(s.media, 2), fmt(s.dp, 1), fi(s.min), fi(s.max), fi(s.amp), ""]);
      cls.push("");
    });
    tabela("tab-audio-stats", num(["Sinal", "Média", "Desvio padrão", "Mínimo", "Máximo", "Amplitude", "Ganho de predição (dB)"]), linhas, cls);
  })();

  tabela("tab-audio-entropia", num(["Medida", pi.titulo, el.titulo]), [
    ["Entropia do original, canal esquerdo / direito", fmt(pi.H_original[0], 4) + " / " + fmt(pi.H_original[1], 4), fmt(el.H_original[0], 4) + " / " + fmt(el.H_original[1], 4) + " (saturada)"],
    ["Entropia do resíduo, canal esquerdo", fmt(pi.H_residuo[0], 4), fmt(el.H_residuo[0], 4) + " (saturada)"],
    ["Entropia do resíduo, canal direito", fmt(pi.H_residuo[1], 4), fmt(el.H_residuo[1], 4) + " (saturada)"],
    ["Entropia do resíduo, canais juntos (notebook)", fmt(pi.H_notebook_calc, 4), fmt(el.H_notebook_calc, 4)],
    ["Valor obtido pelo grupo no notebook", fmt(pi.notebook.H, 4), fmt(el.notebook.H, 4)],
    ["Teto da estimativa por contagem: log<sub>2</sub>(amostras)", fmt(pi.teto_log2N, 2), fmt(el.teto_log2N, 2)],
    ["Entropia estimada com Laplace, esquerdo / direito", fmt(pi.H_laplace[0], 2) + " / " + fmt(pi.H_laplace[1], 2), fmt(el.H_laplace[0], 2) + " / " + fmt(el.H_laplace[1], 2)],
    ["FLAC sem predição (ordem 0)", fmt(bps(pi, "ordem0"), 2), fmt(bps(el, "ordem0"), 2)],
    ["FLAC com o preditor do roteiro (ordem 1 fixa)", fmt(bps(pi, "ordem1"), 2), fmt(bps(el, "ordem1"), 2)],
    ["FLAC completo (LPC de ordem até 12)", fmt(bps(pi, "lpc"), 2), fmt(bps(el, "lpc"), 2)],
    ["Resolução do arquivo", pi.bits, el.bits]
  ]);

  /* ============================================================ PARTE C e D */
  var de = IM[0], mu = IM[1];
  function tupla(a) { return { h: "(" + a.join(", ") + ")", c: "num nowrap" }; }
  tabela("tab-img-info", num(["Atributo", de.titulo, mu.titulo]), [
    ["Arquivo", "<code>" + de.arquivo + "</code>", "<code>" + mu.arquivo + "</code>"],
    ["Largura × altura (pixels)", de.largura + " × " + de.altura, mu.largura + " × " + mu.altura],
    ["Modo do PNG", de.modo, mu.modo],
    ["Shape lido (Pillow, uint8)", tupla(de.shape), tupla(mu.shape)],
    ["Shape e tipo no notebook (mpimg)", { h: "(" + de.shape.join(", ") + "), float32", c: "num nowrap" }, { h: "(" + mu.shape.join(", ") + "), float32", c: "num nowrap" }],
    ["Pixels transparentes (alfa = 0)", fmt(de.alfa.transparente, 1) + "%", fmt(mu.alfa.transparente, 1) + "%"],
    ["Pixels opacos (alfa = 255)", fmt(de.alfa.opaco, 1) + "%", fmt(mu.alfa.opaco, 1) + "%"],
    ["Tamanho do arquivo PNG (bytes)", fi(de.tam_arquivo), fi(mu.tam_arquivo)],
    ["Tamanho bruto: altura × largura × canais (bytes)", fi(de.tam_bruto), fi(mu.tam_bruto)],
    ["Arquivo / bruto", pct(de.tam_arquivo, de.tam_bruto), pct(mu.tam_arquivo, mu.tam_bruto)]
  ]);

  tabela("tab-img-stats", num(["Medida (R, G, B)", de.titulo, mu.titulo]), [
    ["Média do erro", fmt(de.stats_residuo_rgb.media, 4), fmt(mu.stats_residuo_rgb.media, 4)],
    ["Desvio padrão do erro", fmt(de.stats_residuo_rgb.dp, 2), fmt(mu.stats_residuo_rgb.dp, 2)],
    ["Mínimo / máximo", fi(de.stats_residuo_rgb.min) + " / " + fi(de.stats_residuo_rgb.max), fi(mu.stats_residuo_rgb.min) + " / " + fi(mu.stats_residuo_rgb.max)],
    ["Erros iguais a zero", fmt(de.zeros_rgb, 2) + "%", fmt(mu.zeros_rgb, 2) + "%"],
    ["Erros entre -8 e 8", fmt(de.abs_menor_igual_8, 2) + "%", fmt(mu.abs_menor_igual_8, 2) + "%"],
    ["Pixels com R, G e B previstos sem erro", fmt(de.pixels_iguais, 2) + "%", fmt(mu.pixels_iguais, 2) + "%"],
    ["Notebook: média / desvio do erro normalizado", fmt(de.notebook.media_norm, 4) + " / " + fmt(de.notebook.dp_norm, 4), fmt(mu.notebook.media_norm, 4) + " / " + fmt(mu.notebook.dp_norm, 4)]
  ]);

  tabela("tab-img-entropia", num(["Medida", de.titulo, mu.titulo]), [
    ["Entropia do original, R, G, B juntos", fmt(de.H_original_rgb, 4), fmt(mu.H_original_rgb, 4)],
    ["Entropia do original por canal (R / G / B)", de.H_original_canal.slice(0, 3).map(function (v) { return fmt(v, 2); }).join(" / "), mu.H_original_canal.slice(0, 3).map(function (v) { return fmt(v, 2); }).join(" / ")],
    ["Entropia do resíduo, R, G, B juntos", fmt(de.H_residuo_rgb, 4), fmt(mu.H_residuo_rgb, 4)],
    ["Entropia do resíduo por canal (R / G / B)", de.H_residuo_canal.slice(0, 3).map(function (v) { return fmt(v, 2); }).join(" / "), mu.H_residuo_canal.slice(0, 3).map(function (v) { return fmt(v, 2); }).join(" / ")],
    ["Entropia do resíduo do canal alfa", fmt(de.alfa.H_residuo, 4), fmt(mu.alfa.H_residuo, 4)],
    ["Resíduo RGBA em inteiros (4 canais)", fmt(de.H_residuo_todos, 4), fmt(mu.H_residuo_todos, 4)],
    ["Resíduo RGBA em float32, como no notebook", fmt(de.H_notebook_calc, 4), fmt(mu.H_notebook_calc, 4)],
    ["Valor obtido pelo grupo no notebook", fmt(de.notebook.H, 4), fmt(mu.notebook.H, 4)],
    ["Valores distintos no resíduo: float32 / inteiro", de.distintos_notebook + " / " + de.distintos_inteiro, mu.distintos_notebook + " / " + mu.distintos_inteiro],
    ["PNG original da pasta (bytes)", fi(de.tam_arquivo), fi(mu.tam_arquivo)],
    ["PNG sem filtro em todas as linhas (bytes)", fi(de.png_sem_filtro), fi(mu.png_sem_filtro)],
    ["PNG com Paeth em todas as linhas (bytes)", fi(de.png_paeth), fi(mu.png_paeth)],
    ["PNG com Paeth / bruto", pct(de.png_paeth, de.tam_bruto), pct(mu.png_paeth, mu.tam_bruto)],
    ["PNG regravado pelo Pillow com otimização (bytes)", fi(de.png_otimizado), fi(mu.png_otimizado)],
    ["Reconstrução exata pelo decodificador PNG", (de.png_paeth_identico && de.png_sem_filtro_identico) ? "sim" : "não", (mu.png_paeth_identico && mu.png_sem_filtro_identico) ? "sim" : "não"]
  ]);

  $("fig-desenho-paeth").alt = "Três painéis do desenho animado, uma raposa laranja e branca com contorno preto sobre fundo transparente. A original e a predita pelo Paeth parecem iguais. " +
    "No mapa do erro o fundo é cinza neutro (erro zero) e só os contornos do personagem aparecem em vermelho e azul. " + fmt(de.pixels_iguais, 2) + "% dos pixels são previstos sem erro.";
  $("fig-multidao-paeth").alt = "Três painéis da foto de multidão, uma arquibancada cheia de pessoas com roupas coloridas. A original e a predita parecem iguais. " +
    "O mapa do erro fica todo texturizado, com pontos vermelhos e azuis em toda a imagem, sem áreas lisas. Só " + fmt(mu.pixels_iguais, 2) + "% dos pixels são previstos sem erro.";
  $("fig-desenho-hist").alt = "Histogramas do desenho animado. À esquerda, os valores R, G e B se concentram em poucos níveis, com picos isolados. À direita, em escala logarítmica, o erro tem um pico em zero com " +
    fmt(de.zeros_rgb, 2) + "% das amostras e caudas baixas de " + fi(de.stats_residuo_rgb.min) + " a " + fi(de.stats_residuo_rgb.max) + ".";
  $("fig-multidao-hist").alt = "Histogramas da foto de multidão. À esquerda, os valores R, G e B ocupam toda a faixa de 0 a 255, com mais valores escuros e um pico perto de 255. À direita, em escala logarítmica, o erro forma um pico mais largo em zero, com caudas de " +
    fi(mu.stats_residuo_rgb.min) + " a " + fi(mu.stats_residuo_rgb.max) + " e desvio padrão de " + fmt(mu.stats_residuo_rgb.dp, 2) + ".";

  /* =========================================================== QUADRO */
  (function () {
    var linhas = [];
    AU.forEach(function (a) {
      var sat = a.bits > 16;
      var H0 = (a.H_original[0] + a.H_original[1]) / 2, H1 = (a.H_residuo[0] + a.H_residuo[1]) / 2;
      linhas.push([a.titulo, "áudio, " + a.bits + " bits", fi(a.tam_arquivo), fmt(H0, 2) + (sat ? " *" : ""), fmt(H1, 2) + (sat ? " *" : ""),
        sat ? "não confiável *" : fmt(100 * (1 - H1 / H0), 1) + "%",
        fmt(bps(a, "ordem0"), 2) + " → " + fmt(bps(a, "ordem1"), 2),
        "FLAC: " + fi(a.flac.lpc), pct(a.flac.lpc, a.tam_arquivo), a.flac_identico ? "sim" : "não"]);
    });
    IM.forEach(function (m) {
      var b0 = m.png_sem_filtro * 8 / m.tam_bruto, b1 = m.png_paeth * 8 / m.tam_bruto;
      linhas.push([m.titulo, "imagem " + m.modo, fi(m.tam_bruto) + " (bruto)", fmt(m.H_original_rgb, 2), fmt(m.H_residuo_rgb, 2),
        fmt(100 * (1 - m.H_residuo_rgb / m.H_original_rgb), 1) + "%",
        fmt(b0, 2) + " → " + fmt(b1, 2),
        "PNG Paeth: " + fi(m.png_paeth), pct(m.png_paeth, m.tam_bruto), m.png_paeth_identico ? "sim" : "não"]);
    });
    tabela("tab-quadro", num(["Arquivo", { t: "Tipo", num: false }, "Tamanho sem compressão (bytes)", "Entropia original (bits)", "Entropia do resíduo (bits)",
      "Redução da entropia", "Codificador real, sem → com predição (bits por símbolo)", "Tamanho sem perdas (bytes)", "% do tamanho sem compressão", "Reconstrução exata"]), linhas);
    var t = $("tab-quadro");
    var nota = document.createElement("p");
    nota.style.fontSize = ".9rem";
    nota.textContent = "* Na música eletrônica (24 bits) a entropia por contagem satura em log2(" + fi(el.amostras) + ") = " + fmt(el.teto_log2N, 2) +
      " bits e não mede a redução; use a coluna do codificador real (FLAC de ordem 0 e de ordem 1). Nas imagens, o codificador real é o PNG sem filtro e com Paeth, em bits por subpixel.";
    t.parentNode.parentNode.insertBefore(nota, t.parentNode.nextSibling);
  })();

  /* gráfico de barras horizontais genérico (SVG) */
  function barras(alvoId, titulo, itens, opc) {
    var alvo = $(alvoId); if (!alvo) { return; }
    var lin = 26, esq = opc.esq || 190, dir = 70, topo = 34;
    var series = opc.series;                     // [{chave, nome, cor}]
    var h = topo + itens.length * lin * series.length + itens.length * 8 + 30;
    var W = 760, larg = W - esq - dir;
    var max = opc.max || Math.max.apply(null, itens.map(function (it) { return Math.max.apply(null, series.map(function (s) { return it[s.chave]; })); }));
    var s = '<svg class="grafico" viewBox="0 0 ' + W + " " + h + '" role="img" aria-labelledby="' + alvoId + '-t ' + alvoId + '-d">' +
      '<title id="' + alvoId + '-t">' + esc(titulo) + "</title><desc id=\"" + alvoId + '-d">' + esc(opc.desc) + "</desc>" +
      '<text x="0" y="16" style="font-weight:600">' + esc(titulo) + "</text>";
    for (var g = 0; g <= 4; g++) {
      var gx = esq + larg * g / 4;
      s += '<line class="grade-l" x1="' + gx + '" x2="' + gx + '" y1="' + (topo - 6) + '" y2="' + (h - 24) + '"/>' +
        '<text class="suave" x="' + gx + '" y="' + (h - 8) + '" text-anchor="middle">' + fmt(max * g / 4, opc.casasEixo || 0) + "</text>";
    }
    var y = topo;
    itens.forEach(function (it) {
      var y0 = y;
      series.forEach(function (se) {
        var v = it[se.chave], w = Math.max(1, larg * v / max);
        var cor = typeof se.cor === "function" ? se.cor(it) : se.cor;
        s += '<rect x="' + esq + '" y="' + y + '" width="' + w.toFixed(1) + '" height="' + (lin - 6) + '" style="fill:' + cor + '"><title>' + esc(it.rotulo + ", " + se.nome + ": " + fmt(v, opc.casas)) + "</title></rect>" +
          '<text x="' + (esq + w + 4).toFixed(1) + '" y="' + (y + lin - 11) + '">' + fmt(v, opc.casas) + (opc.sufixo || "") + (series.length > 1 ? " " + se.nome : "") + "</text>";
        y += lin;
      });
      s += '<text x="' + (esq - 6) + '" y="' + (y0 + (lin * series.length) / 2 + 2) + '" text-anchor="end">' + esc(it.rotulo) + "</text>";
      y += 8;
    });
    s += '<line class="eixo" x1="' + esq + '" x2="' + esq + '" y1="' + (topo - 6) + '" y2="' + (h - 24) + '"/>';
    alvo.innerHTML = s + "</svg>";
  }

  (function () {
    var itens = AU.map(function (a) { return { rotulo: a.titulo.split(" (")[0], sem: bps(a, "ordem0"), com: bps(a, "ordem1") }; })
      .concat(IM.map(function (m) { return { rotulo: m.titulo, sem: m.png_sem_filtro * 8 / m.tam_bruto, com: m.png_paeth * 8 / m.tam_bruto }; }));
    var desc = itens.map(function (it) { return it.rotulo + ": " + fmt(it.sem, 2) + " bits sem predição e " + fmt(it.com, 2) + " bits com predição"; }).join("; ") + ".";
    barras("svg-entropias", "Bits por símbolo no codificador real, sem e com predição", itens, {
      series: [{ chave: "sem", nome: "sem", cor: "var(--cinza)" }, { chave: "com", nome: "com", cor: "var(--azul)" }],
      casas: 2, max: 24, casasEixo: 0, desc: "Barras horizontais. Áudio: FLAC de ordem 0 e de ordem 1. Imagem: PNG sem filtro e com Paeth. " + desc, esq: 170
    });
  })();

  /* ========================================================== TURMA */
  function corGrupo(it) { return it.grupo === 3 ? "var(--azul)" : (it.grupo === 4 ? "var(--laranja)" : "var(--cinza)"); }
  function desenhaTurma() {
    var modo = $("sel-turma").value;
    var filtro = function (x) { return modo === "todos" || x.grupo === 3 || x.grupo === 4; };
    var aud = LAB.turma.audios.filter(filtro), img = LAB.turma.imagens.filter(filtro);
    var cls = function (x) { return x.grupo === 3 ? "destaque" : (x.grupo === 4 ? "g4" : ""); };

    tabela("tab-turma-audio", num(["Áudio", "Grupo", "Bits", "Canais", "Entropia original", "Entropia do resíduo", "Ganho de predição (dB)", "FLAC ordem 0 (bits/amostra)", "FLAC ordem 1", "FLAC completo", "FLAC / PCM"]),
      aud.map(function (a) {
        var sat = a.H_original > a.teto - 1.5 ? " *" : "";
        return [a.nome + " <code>" + a.arquivo + "</code>", a.grupo, a.bits, a.canais, fmt(a.H_original, 2) + sat, fmt(a.H_residuo, 2) + sat, fmt(a.ganho_db, 1),
          fmt(a.bps_ordem0, 2), fmt(a.bps_ordem1, 2), fmt(a.bps_lpc, 2), fmt(100 * a.bps_lpc / a.bits, 1) + "%"];
      }), aud.map(cls));
    tabela("tab-turma-img", num(["Imagem", "Grupo", "Modo", "Dimensões", "Entropia original (RGB)", "Entropia do resíduo (RGB)", "Erros zero", "PNG da pasta (bytes)", "PNG sem filtro", "PNG Paeth", "Paeth / bruto"]),
      img.map(function (m) {
        return [m.nome + " <code>" + m.arquivo + "</code>", m.grupo, m.modo, { h: m.largura + " × " + m.altura, c: "num nowrap" }, fmt(m.H_original, 2), fmt(m.H_residuo, 2), fmt(m.zeros, 1) + "%",
          fi(m.tam_arquivo), fi(m.png_sem_filtro), fi(m.png_paeth), fmt(100 * m.png_paeth / m.tam_bruto, 1) + "%"];
      }), img.map(cls));

    var barrasAud = aud.map(function (a) { return { rotulo: a.nome + " (G" + a.grupo + ")", v: 100 * a.bps_lpc / a.bits, grupo: a.grupo }; }).sort(function (x, y) { return x.v - y.v; });
    barras("svg-turma-audio", "Áudio: tamanho em FLAC como % do PCM", barrasAud, {
      series: [{ chave: "v", nome: "", cor: corGrupo }], casas: 1, sufixo: "%", max: 100, esq: 230,
      desc: "Barras horizontais em ordem crescente. " + barrasAud.map(function (x) { return x.rotulo + " " + fmt(x.v, 1) + "%"; }).join("; ") + "."
    });
    var barrasImg = img.map(function (m) { return { rotulo: m.nome + " (G" + m.grupo + ")", v: 100 * m.png_paeth / m.tam_bruto, grupo: m.grupo }; }).sort(function (x, y) { return x.v - y.v; });
    barras("svg-turma-img", "Imagem: PNG com Paeth como % do tamanho bruto", barrasImg, {
      series: [{ chave: "v", nome: "", cor: corGrupo }], casas: 1, sufixo: "%", max: 100, esq: 230,
      desc: "Barras horizontais em ordem crescente. " + barrasImg.map(function (x) { return x.rotulo + " " + fmt(x.v, 1) + "%"; }).join("; ") + "."
    });
    var notaId = "nota-turma";
    if (!$(notaId)) {
      var p = document.createElement("p"); p.id = notaId; p.style.fontSize = ".9rem";
      p.textContent = "* Entropia por contagem perto do teto log2(amostras): com 24 bits e poucas amostras, quase todo valor aparece uma vez e a estimativa satura. Nesses casos compare pelo FLAC.";
      var t = $("tab-turma-audio"); t.parentNode.parentNode.insertBefore(p, t.parentNode.nextSibling);
    }
    anunciar("turma-resumo", "Mostrando " + aud.length + " áudios e " + img.length + " imagens" + (modo === "todos" ? " de todos os grupos." : " dos grupos 3 e 4."));
  }
  $("sel-turma").addEventListener("change", desenhaTurma);
  desenhaTurma();

  /* ================================================ VISUALIZADOR ÁUDIO */
  (function () {
    var sel = $("vis-a-arquivo"), pos = $("vis-a-pos"), chk = $("vis-a-pred");
    AU.forEach(function (a, i) { var o = document.createElement("option"); o.value = i; o.textContent = a.titulo; sel.appendChild(o); });
    function dp(v) { var m = v.reduce(function (s, x) { return s + x; }, 0) / v.length; return Math.sqrt(v.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / v.length); }
    function desenha() {
      var a = AU[+sel.value], j = a.janelas[+pos.value - 1], x = j.x, L = x.length - 1;
      var orig = x.slice(1), pred = x.slice(0, L), res = orig.map(function (v, i) { return v - pred[i]; });
      var W = 760, H1 = 190, H2 = 120, esq = 70, dir = 10, topo = 10, gap = 30, larg = W - esq - dir;
      var mx = Math.max.apply(null, orig.map(Math.abs).concat(pred.map(Math.abs))) || 1;
      var mr = Math.max.apply(null, res.map(Math.abs)) || 1;
      var X = function (i) { return esq + larg * i / (L - 1); };
      var Y1 = function (v) { return topo + H1 / 2 - (H1 / 2 - 4) * v / mx; };
      var y2c = topo + H1 + gap + H2 / 2, Y2 = function (v) { return y2c - (H2 / 2 - 4) * v / mr; };
      var po = orig.map(function (v, i) { return X(i).toFixed(1) + "," + Y1(v).toFixed(1); }).join(" ");
      var pp = "";
      pred.forEach(function (v, i) { pp += (i ? "L" : "M") + (X(i) - larg / (2 * (L - 1))).toFixed(1) + "," + Y1(v).toFixed(1) + "H" + (X(i) + larg / (2 * (L - 1))).toFixed(1); });
      var bw = Math.max(0.6, larg / L * 0.8), barras = "";
      res.forEach(function (v, i) { var y = Y2(v); barras += '<rect x="' + (X(i) - bw / 2).toFixed(1) + '" y="' + Math.min(y, y2c).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.abs(y - y2c).toFixed(1) + '"/>'; });
      var sO = dp(orig), sR = dp(res), ganho = 10 * Math.log10((sO * sO) / Math.max(sR * sR, 1e-9));
      var t0 = j.ini / a.fs, maxR = Math.max.apply(null, res.map(Math.abs));
      var txt = a.titulo + ": " + L + " amostras do canal esquerdo a partir da amostra " + fi(j.ini) + " (t = " + fmt(t0, 2) + " s). Desvio padrão do original " + fmt(sO, 0) +
        ", do erro " + fmt(sR, 0) + ", ganho de predição de " + fmt(ganho, 1) + " dB. Maior erro em módulo: " + fi(maxR) + " (" + fmt(100 * maxR / Math.pow(2, a.bits - 1), 2) + "% do fundo de escala).";
      var h = topo + H1 + gap + H2 + 24;
      $("vis-a-svg").innerHTML = '<svg class="grafico" viewBox="0 0 ' + W + " " + h + '" role="img" aria-label="' + esc(txt) + '">' +
        '<line class="grade-l" x1="' + esq + '" x2="' + (W - dir) + '" y1="' + Y1(0) + '" y2="' + Y1(0) + '"/>' +
        '<line class="grade-l" x1="' + esq + '" x2="' + (W - dir) + '" y1="' + y2c + '" y2="' + y2c + '"/>' +
        (chk.checked ? '<path d="' + pp + '" style="fill:none;stroke:var(--laranja);stroke-width:1.2"/>' : "") +
        '<polyline points="' + po + '" style="fill:none;stroke:var(--azul);stroke-width:1.6"/>' +
        '<g style="fill:var(--cinza)">' + barras + "</g>" +
        '<text x="' + (esq - 6) + '" y="' + (Y1(mx) + 10) + '" text-anchor="end" class="suave">' + fi(mx) + "</text>" +
        '<text x="' + (esq - 6) + '" y="' + (Y1(-mx)) + '" text-anchor="end" class="suave">' + fi(-mx) + "</text>" +
        '<text x="' + (esq - 6) + '" y="' + (Y2(mr) + 10) + '" text-anchor="end" class="suave">' + fi(mr) + "</text>" +
        '<text x="' + (esq - 6) + '" y="' + Y2(-mr) + '" text-anchor="end" class="suave">' + fi(-mr) + "</text>" +
        '<text x="' + (esq + 4) + '" y="' + (topo + 12) + '">original (azul)' + (chk.checked ? " e predito (laranja)" : "") + "</text>" +
        '<text x="' + (esq + 4) + '" y="' + (topo + H1 + gap - 4) + '">erro e[n] (escala própria)</text>' +
        '<text x="' + esq + '" y="' + (h - 6) + '" class="suave">amostra ' + fi(j.ini) + '</text>' +
        '<text x="' + (W - dir) + '" y="' + (h - 6) + '" text-anchor="end" class="suave">amostra ' + fi(j.ini + L - 1) + "</text></svg>";
      $("vis-a-pos-txt").textContent = "posição " + pos.value + " de 40, t = " + fmt(t0, 2) + " s";
      anunciar("vis-a-resumo", txt);
    }
    sel.addEventListener("change", desenha); pos.addEventListener("input", desenha); chk.addEventListener("change", desenha);
    desenha();
  })();

  /* =============================================== VISUALIZADOR PAETH */
  (function () {
    var sel = $("vis-i-arquivo"), ix = $("vis-i-x"), iy = $("vis-i-y"), cv = $("cv-img"), cz = $("cv-zoom");
    var ctx = cv.getContext("2d"), cxz = cz.getContext("2d");
    var cache = {}, atual = null, px = 0, py = 0;
    IM.forEach(function (m, i) { var o = document.createElement("option"); o.value = i; o.textContent = m.titulo; sel.appendChild(o); });

    function carrega(uri) {
      return new Promise(function (ok, erro) {
        var im = new Image();
        im.onload = function () {
          var c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
          var g = c.getContext("2d"); g.drawImage(im, 0, 0);
          ok(g.getImageData(0, 0, c.width, c.height).data);
        };
        im.onerror = erro; im.src = uri;
      });
    }
    function prepara(k) {
      if (cache[k]) { return Promise.resolve(cache[k]); }
      var m = IM[k];
      return Promise.all([carrega(m.uri_rgb), m.uri_alfa ? carrega(m.uri_alfa) : Promise.resolve(null)]).then(function (r) {
        var w = m.largura, h = m.altura, n = w * h, ch = m.uri_alfa ? 4 : 3;
        var v = new Uint8Array(n * ch), soma = 0;
        for (var i = 0; i < n; i++) {
          for (var c = 0; c < 3; c++) { v[i * ch + c] = r[0][i * 4 + c]; soma += r[0][i * 4 + c]; }
          if (ch === 4) { v[i * ch + 3] = r[1][i * 4]; }
        }
        var d = { m: m, w: w, h: h, ch: ch, v: v, soma: soma };
        /* imagem original (com alfa) e mapa do erro (média RGB, escala ±64) */
        var orig = new ImageData(w, h), res = new ImageData(w, h);
        for (var y = 0; y < h; y++) {
          for (var x = 0; x < w; x++) {
            var p = y * w + x, s = 0;
            for (c = 0; c < 3; c++) { orig.data[p * 4 + c] = v[p * ch + c]; s += v[p * ch + c] - pred(d, x, y, c); }
            orig.data[p * 4 + 3] = ch === 4 ? v[p * ch + 3] : 255;
            var cor = divergente(s / 3 / 64);
            res.data[p * 4] = cor[0]; res.data[p * 4 + 1] = cor[1]; res.data[p * 4 + 2] = cor[2]; res.data[p * 4 + 3] = 255;
          }
        }
        d.orig = orig; d.res = res;
        cache[k] = d; return d;
      });
    }
    function val(d, x, y, c) { return (x < 0 || y < 0) ? 0 : d.v[(y * d.w + x) * d.ch + c]; }
    function paeth(a, b, c) {
      var p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      return { p: p, pa: pa, pb: pb, pc: pc, esc: (pa <= pb && pa <= pc) ? "a" : (pb <= pc ? "b" : "c") };
    }
    function pred(d, x, y, c) {
      var a = val(d, x - 1, y, c), b = val(d, x, y - 1, c), cc = val(d, x - 1, y - 1, c), r = paeth(a, b, cc);
      return r.esc === "a" ? a : (r.esc === "b" ? b : cc);
    }
    function divergente(t) {               /* -1 azul, 0 cinza neutro, 1 vermelho (como o coolwarm) */
      t = Math.max(-1, Math.min(1, t));
      var n = [221, 221, 221], az = [59, 76, 192], vm = [180, 4, 38], f = Math.abs(t), alvo = t < 0 ? az : vm;
      return [0, 1, 2].map(function (i) { return Math.round(n[i] + (alvo[i] - n[i]) * f); });
    }
    /* pixel inicial: o mais perto do centro que seja opaco e tenha erro em algum canal */
    function interessante(d) {
      var melhor = [Math.floor(d.w / 2), Math.floor(d.h / 2)], dist = Infinity, cx = d.w / 2, cy = d.h / 2;
      for (var y = 1; y < d.h; y++) {
        for (var x = 1; x < d.w; x++) {
          var dd = (x - cx) * (x - cx) + (y - cy) * (y - cy);
          if (dd >= dist) { continue; }
          if (d.ch === 4 && val(d, x, y, 3) !== 255) { continue; }
          var erro = false;
          for (var c = 0; c < 3; c++) { if (val(d, x, y, c) !== pred(d, x, y, c)) { erro = true; break; } }
          if (erro) { dist = dd; melhor = [x, y]; }
        }
      }
      return melhor;
    }
    function corTela(d, x, y) {   /* cor exibida: RGB composto sobre branco pelo alfa */
      var al = d.ch === 4 ? val(d, x, y, 3) / 255 : 1;
      return [0, 1, 2].map(function (c) { return Math.round(val(d, x, y, c) * al + 255 * (1 - al)); });
    }
    function modo() { var r = document.querySelector('input[name="vis-i-modo"]:checked'); return r ? r.value : "original"; }
    var NC = ["R", "G", "B", "A"];
    function atualiza() {
      var d = atual; if (!d) { return; }
      px = Math.max(0, Math.min(d.w - 1, parseInt(ix.value, 10) || 0));
      py = Math.max(0, Math.min(d.h - 1, parseInt(iy.value, 10) || 0));
      ix.value = px; iy.value = py;
      ctx.putImageData(modo() === "residuo" ? d.res : d.orig, 0, 0);
      ctx.strokeStyle = "#c0582b"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px + 0.5, 0); ctx.lineTo(px + 0.5, Math.max(0, py - 6)); ctx.moveTo(px + 0.5, Math.min(d.h, py + 7)); ctx.lineTo(px + 0.5, d.h);
      ctx.moveTo(0, py + 0.5); ctx.lineTo(Math.max(0, px - 6), py + 0.5); ctx.moveTo(Math.min(d.w, px + 7), py + 0.5); ctx.lineTo(d.w, py + 0.5); ctx.stroke();
      ctx.strokeRect(px - 3.5, py - 3.5, 8, 8);

      /* ampliação 7x7 */
      var tam = 30;
      cxz.clearRect(0, 0, 210, 210);
      for (var j = -3; j <= 3; j++) {
        for (var i = -3; i <= 3; i++) {
          var x = px + i, y = py + j, fora = x < 0 || y < 0 || x >= d.w || y >= d.h;
          var cc0 = fora ? null : corTela(d, x, y);
          cxz.fillStyle = fora ? "#888" : "rgb(" + cc0.join(",") + ")";
          cxz.fillRect((i + 3) * tam, (j + 3) * tam, tam, tam);
        }
      }
      var marca = [["c", -1, -1], ["b", 0, -1], ["a", -1, 0], ["X", 0, 0]];
      cxz.font = "bold 15px system-ui, sans-serif"; cxz.textAlign = "center"; cxz.textBaseline = "middle";
      marca.forEach(function (mk) {
        var cx0 = (mk[1] + 3) * tam, cy0 = (mk[2] + 3) * tam;
        cxz.lineWidth = 2; cxz.strokeStyle = mk[0] === "X" ? "#c0582b" : "#1f5f8b"; cxz.strokeRect(cx0 + 1, cy0 + 1, tam - 2, tam - 2);
        cxz.fillStyle = "#fff"; cxz.fillRect(cx0 + 8, cy0 + 7, 14, 16);
        cxz.fillStyle = "#000"; cxz.fillText(mk[0], cx0 + tam / 2, cy0 + tam / 2 + 1);
      });

      /* tabela da conta */
      var linhas = [], partes = [];
      for (var c = 0; c < d.ch; c++) {
        var a = val(d, px - 1, py, c), b = val(d, px, py - 1, c), cc = val(d, px - 1, py - 1, c), r = paeth(a, b, cc);
        var pr = r.esc === "a" ? a : (r.esc === "b" ? b : cc), real = val(d, px, py, c), e = real - pr;
        linhas.push([NC[c], a, b, cc, r.p, r.pa, r.pb, r.pc, r.esc, pr, real, e]);
        partes.push(NC[c] + ": escolheu " + r.esc + " = " + pr + ", real " + real + ", erro " + e);
      }
      tabela("tab-paeth", num(["Canal", "a (esquerda)", "b (acima)", "c (diagonal)", "p = a + b - c", "|p - a|", "|p - b|", "|p - c|", "Escolhido", "Predito", "Real", "Erro"]), linhas);
      var borda = (px === 0 || py === 0) ? " Vizinhos fora da imagem valem 0." : "";
      var txt = d.m.titulo + ", pixel x " + px + ", y " + py + ". " + partes.join("; ") + "." + borda;
      cv.setAttribute("aria-label", d.m.titulo + (modo() === "residuo" ? ", mapa do erro residual" : ", original") + ". Pixel escolhido x " + px + ", y " + py + ". Use as setas para mudar o pixel.");
      cz.setAttribute("aria-label", "Ampliação 7 por 7 em volta do pixel x " + px + ", y " + py + ", com os vizinhos c, b e a marcados.");
      anunciar("vis-i-resumo", txt);
    }
    function troca() {
      var k = +sel.value;
      prepara(k).then(function (d) {
        atual = d; cv.width = d.w; cv.height = d.h;
        ix.max = d.w - 1; iy.max = d.h - 1;
        if (+ix.value >= d.w || +iy.value >= d.h || (!ix.dataset.mexeu)) {
          var ini = interessante(d); ix.value = ini[0]; iy.value = ini[1];
        }
        var ok = d.soma === d.m.soma_rgb;
        $("vis-i-verif").innerHTML = "Verificação: soma de R, G e B lida no navegador = " + fi(d.soma) + "; no script = " + fi(d.m.soma_rgb) +
          (ok ? ' <span class="ok">(confere)</span>' : " (não confere)");
        atualiza();
      }).catch(function () { $("vis-i-verif").textContent = "Não foi possível ler os pixels da imagem neste navegador."; });
    }
    sel.addEventListener("change", function () { delete ix.dataset.mexeu; troca(); });
    [ix, iy].forEach(function (e) { e.addEventListener("input", function () { ix.dataset.mexeu = "1"; atualiza(); }); });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="vis-i-modo"]'), function (r) { r.addEventListener("change", atualiza); });
    cv.addEventListener("click", function (ev) {
      if (!atual) { return; }
      var rc = cv.getBoundingClientRect();
      ix.value = Math.floor((ev.clientX - rc.left) / rc.width * atual.w);
      iy.value = Math.floor((ev.clientY - rc.top) / rc.height * atual.h);
      ix.dataset.mexeu = "1"; atualiza();
    });
    cv.addEventListener("keydown", function (ev) {
      var dx = 0, dy = 0, passo = ev.shiftKey ? 10 : 1;
      if (ev.key === "ArrowLeft") { dx = -passo; } else if (ev.key === "ArrowRight") { dx = passo; }
      else if (ev.key === "ArrowUp") { dy = -passo; } else if (ev.key === "ArrowDown") { dy = passo; } else { return; }
      ev.preventDefault(); ix.value = px + dx; iy.value = py + dy; ix.dataset.mexeu = "1"; atualiza();
    });
    troca();
  })();
})();
