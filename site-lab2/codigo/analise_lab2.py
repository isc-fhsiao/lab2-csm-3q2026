# -*- coding: utf-8 -*-
"""
ESFI001 (CSM) - Lab 2: Codificação de áudio e imagem sem perdas - Grupo 3
Gera os gráficos e os dados do site (site-lab2/js/dados.js).

Arquivos do grupo 3:
  áudio 1 (previsível):   audios/31_piano.wav
  áudio 2 (imprevisível): audios/32_eletronica_com_ruido.wav
  imagem 1 (previsível):  imagens/33_desenho_animado.png
  imagem 2 (imprevisível): imagens/34_multidao.png
Os demais arquivos da pasta (grupos 1 a 7) entram só no quadro comparativo da turma.

Correções em relação aos notebooks do roteiro:
  * resíduo do áudio calculado em int64 (no notebook, int16 - int16 pode estourar);
  * áudio float32 convertido para inteiro na resolução real (24 bits na música eletrônica);
  * "Amplitude" calculada sem truncar o float (o notebook dava 0,0000 no áudio float);
  * entropia por canal, além da entropia com os dois canais misturados (método do notebook);
  * imagem lida como uint8 (PIL) e não como float32 (mpimg), o que criava símbolos espúrios;
  * entropia da imagem nos canais RGB; o canal alfa é tratado à parte;
  * Paeth vetorizado (o laço triplo do notebook é lento) e reconstrução verificada;
  * tamanhos reais com FLAC (ffmpeg) e PNG (filtro nenhum, filtro Paeth e PNG otimizado).

Uso: python3 analise_lab2.py   (na pasta "Lab 2 - CSM"; precisa de numpy, scipy, matplotlib, Pillow e ffmpeg)
"""
import base64, glob, io, json, os, shutil, struct, subprocess, tempfile, warnings, zlib

import numpy as np
import scipy.io.wavfile as wavfile
from scipy.signal import welch
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from PIL import Image

warnings.simplefilter("ignore")  # WavFileWarning do chunk "PAD " do piano

BASE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(BASE, "site-lab2")
GRAF = os.path.join(SITE, "img", "graficos")
AUD = os.path.join(SITE, "audio")
for d in (GRAF, AUD, os.path.join(SITE, "js")):
    os.makedirs(d, exist_ok=True)
TMP = tempfile.mkdtemp()

AZUL, LARANJA, CINZA = "#1f5f8b", "#c0582b", "#6b7280"
plt.rcParams.update({"figure.dpi": 110, "savefig.dpi": 110, "font.size": 10,
                     "axes.spines.top": False, "axes.spines.right": False,
                     "axes.grid": True, "grid.alpha": 0.3})

GRUPO_AUDIOS = [
    ("piano", "31_piano.wav", "Piano (notas sustentadas)", "Áudio 1 (previsível)",
     "André de Brito Lins e Fernando Hsiao", "Pedro Ricardo Cantu Benedetti"),
    ("eletronica", "32_eletronica_com_ruido.wav", "Música eletrônica com ruído", "Áudio 2 (imprevisível)",
     "Isabella Pierina", "Yasmin Ribeiro Santos"),
]
GRUPO_IMAGENS = [
    ("desenho", "33_desenho_animado.png", "Desenho animado", "Imagem 1 (previsível)",
     "Pedro Ricardo Cantu Benedetti", "André de Brito Lins"),
    ("multidao", "34_multidao.png", "Foto de multidão", "Imagem 2 (imprevisível)",
     "Yasmin Ribeiro Santos", "Isabella Pierina e Fernando Hsiao"),
]
# valores que o grupo obteve nos notebooks (saídas salvas nos .ipynb)
NOTEBOOK = {
    "piano": {"H": 9.3996, "dp": 215.6645, "min": -1949, "max": 1775, "amp": 3724},
    "eletronica": {"H": 18.5096, "dp": 0.0361, "min": -0.3581, "max": 0.6759, "amp": 0.0},
    "desenho": {"H": 0.7287, "media_norm": 0.5052, "dp_norm": 0.0277},
    "multidao": {"H": 5.2197, "media_norm": 0.3323, "dp_norm": 0.0285},
}
NOMES_TURMA = {
    "11": "Tom senoidal 440 Hz", "12": "Música pop (funk)", "21": "Flauta solo", "22": "Heavy metal",
    "31": "Piano", "32": "Eletrônica com ruído", "41_clean-a": "Guitarra limpa (acorde A)",
    "41_clean-d": "Guitarra limpa (acorde D)", "41_clean-g": "Guitarra limpa (acorde G)",
    "42": "Show ao vivo", "51": "Violino (notas longas)", "52": "Rock", "61": "Órgão (notas lentas)",
    "62": "Eletrônica (transientes)", "71": "Voz com pausas", "72": "Ruído branco",
    "13": "Cores sólidas", "14": "Paisagem", "23": "Desenho vetorial", "24": "Floresta",
    "33": "Desenho animado", "34": "Multidão", "43": "Gráfico de linhas", "44": "Cena urbana",
    "53": "Símbolos gráficos", "54": "Ondas na praia", "63": "Arte abstrata", "64": "Noite urbana",
    "73": "Um pixel em fundo preto", "74": "Ruído (estática)",
}


# ----------------------------------------------------------------- utilidades
def entropia(v):
    """Entropia de ordem zero (bits/símbolo), igual à do notebook, mas com np.unique."""
    _, c = np.unique(np.asarray(v).ravel(), return_counts=True)
    p = c / c.sum()
    return float(-(p * np.log2(p)).sum())


def r(x, n=4):
    return None if x is None else round(float(x), n)


def stats(v):
    v = np.asarray(v, dtype=np.float64)
    return {"media": r(v.mean()), "dp": r(v.std()), "min": r(v.min()), "max": r(v.max()),
            "amp": r(v.max() - v.min())}


def le_audio_inteiro(caminho):
    """Lê o WAV e devolve amostras inteiras (int64) na resolução real, com 2 dimensões."""
    fs, x = wavfile.read(caminho)
    if x.ndim == 1:
        x = x[:, None]
    if x.dtype.kind == "f":
        x64 = x.astype(np.float64)
        bits = None
        for b in (16, 24):
            q = x64 * 2 ** (b - 1)
            if np.all(q == np.round(q)):
                bits = b
                break
        if bits is None:
            raise ValueError("float sem resolução inteira detectável: " + caminho)
        xi = np.round(x64 * 2 ** (bits - 1)).astype(np.int64)
    elif x.dtype == np.int32 and np.all(x.astype(np.int64) % 256 == 0):
        bits = 24                                         # 24 bits guardados em contêiner de 32
        xi = x.astype(np.int64) >> 8
    else:
        bits = x.dtype.itemsize * 8
        xi = x.astype(np.int64)
    return fs, x, xi, bits


def residuo_ordem1(xi):
    """Predição linear de ordem 1: x^[n] = x[n-1], com x^[0] = 0 (como no notebook)."""
    pred = np.zeros_like(xi)
    pred[1:] = xi[:-1]
    return pred, xi - pred


def estouro_notebook(x):
    """Conta quantas amostras o notebook calcularia errado ao subtrair no tipo original (int)."""
    if x.dtype.kind == "f":
        return 0
    pred = np.zeros_like(x)
    pred[1:] = x[:-1]
    errado = (x - pred).astype(np.int64)
    certo = x.astype(np.int64) - pred.astype(np.int64)
    return int(np.sum(errado != certo))


def flac(caminho_wav, bits, modo, saida=None):
    """Codifica em FLAC com ffmpeg e devolve (bytes, caminho). modo: 'ordem0', 'ordem1' ou 'lpc'."""
    saida = saida or os.path.join(TMP, os.path.basename(caminho_wav) + "_" + modo + ".flac")
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", caminho_wav, "-c:a", "flac", "-compression_level", "8"]
    if bits == 24:
        cmd += ["-sample_fmt", "s32", "-bits_per_raw_sample", "24"]
    if modo == "ordem0":
        cmd += ["-lpc_type", "none", "-ch_mode", "indep"]
    elif modo == "ordem1":
        cmd += ["-lpc_type", "fixed", "-min_prediction_order", "1", "-max_prediction_order", "1",
                "-ch_mode", "indep"]
    subprocess.run(cmd + [saida], check=True)
    return os.path.getsize(saida), saida


def decodifica_flac(caminho, bits, canais):
    fmt, dt = ("s16le", np.int16) if bits == 16 else ("s32le", np.int32)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", caminho, "-f", fmt, "-"],
                         capture_output=True, check=True).stdout
    y = np.frombuffer(raw, dtype=dt).astype(np.int64).reshape(-1, canais)
    return y >> 8 if bits == 24 else y


def grava_flac_de_inteiros(xi, fs, bits, saida):
    """Grava inteiros (resíduo) como FLAC, passando por um WAV temporário."""
    tmp = os.path.join(TMP, "tmp_res.wav")
    if bits == 16:
        wavfile.write(tmp, fs, np.clip(xi, -32768, 32767).astype(np.int16))
    else:
        wavfile.write(tmp, fs, (np.clip(xi, -2 ** 23, 2 ** 23 - 1) << 8).astype(np.int32))
    return flac(tmp, bits, "lpc", saida)


# ------------------------------------------------------------- Paeth e PNG
def paeth_pred(u):
    """Filtro de Paeth vetorizado. u: uint8 (H, W, C). Vizinhos fora da imagem valem 0."""
    x = u.astype(np.int32)
    a = np.zeros_like(x); b = np.zeros_like(x); c = np.zeros_like(x)
    a[:, 1:] = x[:, :-1]
    b[1:, :] = x[:-1, :]
    c[1:, 1:] = x[:-1, :-1]
    p = a + b - c
    pa, pb, pc = np.abs(p - a), np.abs(p - b), np.abs(p - c)
    return np.where((pa <= pb) & (pa <= pc), a, np.where(pb <= pc, b, c))


def png_bytes(u, filtro):
    """PNG válido (8 bits) com o mesmo filtro em todas as linhas: 0 = nenhum, 4 = Paeth."""
    h, w, ch = u.shape
    tipo = {1: 0, 3: 2, 4: 6}[ch]
    if filtro == 4:
        dados = ((u.astype(np.int32) - paeth_pred(u)) % 256).astype(np.uint8)
    else:
        dados = u
    linhas = np.concatenate([np.full((h, 1), filtro, np.uint8), dados.reshape(h, w * ch)], axis=1)
    idat = zlib.compress(linhas.tobytes(), 9)

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, tipo, 0, 0, 0))
            + chunk(b"IDAT", idat) + chunk(b"IEND", b""))


def tamanhos_png(u):
    """Tamanhos reais em PNG e verificação de reconstrução exata pelo decodificador do Pillow."""
    out = {}
    for nome, f in (("png_sem_filtro", 0), ("png_paeth", 4)):
        dados = png_bytes(u, f)
        volta = np.array(Image.open(io.BytesIO(dados)))
        if volta.ndim == 2:
            volta = volta[..., None]
        out[nome] = len(dados)
        out[nome + "_identico"] = bool(np.array_equal(volta, u))
    buf = io.BytesIO()
    Image.fromarray(u[..., 0] if u.shape[2] == 1 else u).save(buf, "PNG", optimize=True)
    out["png_otimizado"] = buf.tell()
    return out


def data_uri_png(arr):
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def le_imagem(caminho):
    im = Image.open(caminho)
    u = np.array(im)
    if u.ndim == 2:
        u = u[..., None]
    return im.mode, u


# ===================================================================== ÁUDIO
def analisa_audio(chave, arquivo, titulo, papel, analista, preditor):
    caminho = os.path.join(BASE, "audios", arquivo)
    fs, x, xi, bits = le_audio_inteiro(caminho)
    n, ch = xi.shape
    pred, res = residuo_ordem1(xi)
    # reconstrução exata: soma acumulada do resíduo
    rec = np.cumsum(res, axis=0)
    assert np.array_equal(rec, xi), "reconstrução falhou"

    tam_arq = os.path.getsize(caminho)
    tam_nb = ch * n * x.dtype.itemsize                     # fórmula do notebook (só dados)
    fl = {m: flac(caminho, bits, m)[0] for m in ("ordem0", "ordem1")}
    tam_lpc, cam_lpc = flac(caminho, bits, "lpc", os.path.join(AUD, chave + "_original.flac"))
    fl["lpc"] = tam_lpc
    identico = bool(np.array_equal(decodifica_flac(cam_lpc, bits, ch), xi))
    tam_res, _ = grava_flac_de_inteiros(res, fs, bits, os.path.join(AUD, chave + "_residuo.flac"))
    n_tot = n * ch
    bps = {k: r(v * 8 / n_tot, 3) for k, v in fl.items()}

    H_or = [entropia(xi[:, k]) for k in range(ch)]
    H_re = [entropia(res[:, k]) for k in range(ch)]
    b_lap = [float(np.mean(np.abs(res[:, k] - np.median(res[:, k])))) for k in range(ch)]
    H_lap = [float(np.log2(2 * np.e * b)) for b in b_lap]
    ganho = [float(10 * np.log10(xi[:, k].astype(float).var() / res[:, k].astype(float).var()))
             for k in range(ch)]

    escala = 2 ** (bits - 1)
    # espectro (canal esquerdo)
    f, P = welch(xi[:, 0] / escala, fs=fs, nperseg=4096)
    _, Pr = welch(res[:, 0] / escala, fs=fs, nperseg=4096)
    frac5k = float(P[f >= 5000].sum() / P.sum())
    frac5k_r = float(Pr[f >= 5000].sum() / Pr.sum())

    # janelas para o visualizador (canal esquerdo, 256 amostras, 40 posições)
    L = 256
    inicios = np.linspace(1, n - L - 1, 40).astype(int)
    janelas = [{"ini": int(i), "x": xi[i - 1:i + L, 0].tolist()} for i in inicios]

    # trecho para o zoom: 200 amostras a partir do meio do arquivo (longe do início e do fim)
    zoom_ini = int(n // 2)

    # ---- gráficos
    t = np.arange(n) / fs
    fig, ax = plt.subplots(2, 1, figsize=(10, 5.2), sharex=True, sharey=True)
    for k, cor, nome in ((0, AZUL, "esquerdo"), (1, LARANJA, "direito"))[:ch]:
        ax[0].plot(t, xi[:, k] / escala, color=cor, lw=0.4, alpha=0.8, label=f"canal {nome}")
        ax[1].plot(t, res[:, k] / escala, color=cor, lw=0.4, alpha=0.8)
    ax[0].set_title(f"{titulo}: sinal original")
    ax[1].set_title("Erro residual da predição de ordem 1, e[n] = x[n] - x[n-1] (mesma escala)")
    for a in ax:
        a.set_ylabel("amplitude (fundo de escala = 1)")
    ax[1].set_xlabel("tempo (s)")
    ax[0].legend(loc="upper right", fontsize=8)
    fig.tight_layout()
    fig.savefig(os.path.join(GRAF, f"audio_{chave}_tempo.png"))
    plt.close(fig)

    z = slice(zoom_ini, zoom_ini + 200)
    idx = np.arange(zoom_ini, zoom_ini + 200)
    fig, ax = plt.subplots(2, 1, figsize=(10, 5), sharex=True)
    ax[0].plot(idx, xi[z, 0], color=AZUL, lw=1.4, label="original x[n]")
    ax[0].step(idx, pred[z, 0], where="mid", color=LARANJA, lw=1, label=r"predito $\hat{x}[n] = x[n-1]$")
    ax[0].set_ylabel("valor inteiro")
    ax[0].legend(fontsize=8, loc="upper right")
    ax[0].set_title(f"{titulo}: 200 amostras a partir do índice {zoom_ini} (canal esquerdo)")
    ax[1].bar(idx, res[z, 0], color=CINZA, width=0.9)
    ax[1].set_ylabel("erro e[n]")
    ax[1].set_xlabel("índice da amostra")
    fig.tight_layout()
    fig.savefig(os.path.join(GRAF, f"audio_{chave}_zoom.png"))
    plt.close(fig)

    fig, ax = plt.subplots(1, 2, figsize=(10, 3.8))
    lim = np.percentile(np.abs(xi), 99.9)
    bins = np.linspace(-lim, lim, 121)
    ax[0].hist(xi.ravel(), bins=bins, color=AZUL, alpha=0.75, label="original")
    ax[0].hist(res.ravel(), bins=bins, color=LARANJA, alpha=0.75, label="resíduo")
    ax[0].set_yscale("log")
    ax[0].set_title("Histograma (escala log)")
    ax[0].set_xlabel("valor inteiro")
    ax[0].legend(fontsize=8)
    lr = np.percentile(np.abs(res), 99.5)
    ax[1].hist(res.ravel(), bins=np.linspace(-lr, lr, 101), color=LARANJA)
    ax[1].set_title("Histograma do resíduo (escala linear)")
    ax[1].set_xlabel("erro e[n]")
    fig.tight_layout()
    fig.savefig(os.path.join(GRAF, f"audio_{chave}_hist.png"))
    plt.close(fig)

    return {
        "id": chave, "arquivo": arquivo, "titulo": titulo, "papel": papel,
        "analista": analista, "preditor": preditor,
        "fs": int(fs), "dtype": str(x.dtype), "canais": int(ch), "amostras": int(n),
        "duracao": r(n / fs, 2), "bits": int(bits),
        "tam_arquivo": tam_arq, "tam_notebook": tam_nb, "cabecalho": tam_arq - tam_nb,
        "tam_pcm_bits": int(n_tot * bits / 8),
        "flac": fl, "bps": bps, "flac_identico": identico, "tam_flac_residuo": tam_res,
        "H_original": [r(v) for v in H_or], "H_residuo": [r(v) for v in H_re],
        "H_notebook_calc": r(entropia(res.ravel())), "H_original_ambos": r(entropia(xi.ravel())),
        "H_laplace": [r(v, 2) for v in H_lap], "teto_log2N": r(np.log2(n), 2),
        "ganho_db": [r(v, 1) for v in ganho],
        "stats_original": [stats(xi[:, k]) for k in range(ch)],
        "stats_residuo": [stats(res[:, k]) for k in range(ch)],
        "stats_residuo_ambos": stats(res),
        "zeros_residuo": r(np.mean(res == 0) * 100, 2),
        "frac_acima_5k": r(frac5k * 100, 1), "frac_acima_5k_res": r(frac5k_r * 100, 1),
        "corr_LR": r(np.corrcoef(xi[:, 0], xi[:, 1])[0, 1], 3) if ch == 2 else None,
        "satur": int(np.sum(np.abs(xi) >= escala - 1)),
        "estouro_notebook": estouro_notebook(x),
        "zoom_ini": zoom_ini, "janela_L": L, "janelas": janelas,
        "notebook": NOTEBOOK[chave],
        "_espectro": (f, P, Pr),
    }


# ==================================================================== IMAGEM
def analisa_imagem(chave, arquivo, titulo, papel, analista, preditor):
    caminho = os.path.join(BASE, "imagens", arquivo)
    modo, u = le_imagem(caminho)
    h, w, ch = u.shape
    pred = paeth_pred(u)
    res = u.astype(np.int32) - pred
    rgb = res[..., :3]
    tam = tamanhos_png(u)
    alfa = None
    if ch == 4:
        al = u[..., 3]
        alfa = {"transparente": r(np.mean(al == 0) * 100, 1), "opaco": r(np.mean(al == 255) * 100, 1),
                "H_residuo": r(entropia(res[..., 3]))}

    # mesmo cálculo do notebook (float32 de mpimg), para comparar
    fl = u.astype(np.float32) / 255
    rf = fl - paeth_pred_float(fl)
    H_nb = entropia(rf)
    distintos_nb = int(len(np.unique(rf)))

    # ---- gráficos
    comp = u[..., :3].astype(float) / 255
    if ch == 4:
        a = u[..., 3:4].astype(float) / 255
        comp = comp * a + (1 - a)                          # fundo branco, como o matplotlib mostra
        compp = pred[..., :3] / 255 * (pred[..., 3:4] / 255) + (1 - pred[..., 3:4] / 255)
    else:
        compp = pred[..., :3] / 255
    medio = rgb.mean(axis=2)
    fig, ax = plt.subplots(1, 3, figsize=(12, 4.6 * h / w + 0.8))
    ax[0].imshow(comp); ax[0].set_title("Original")
    ax[1].imshow(np.clip(compp, 0, 1)); ax[1].set_title("Predita pelo filtro de Paeth")
    im = ax[2].imshow(medio, cmap="coolwarm", vmin=-64, vmax=64, interpolation="nearest")
    ax[2].set_title("Erro residual (média de R, G, B)")
    for a_ in ax:
        a_.axis("off")
    cb = fig.colorbar(im, ax=ax[2], fraction=0.046, pad=0.04)
    cb.set_label("níveis (corte em ±64)")
    fig.suptitle(titulo)
    fig.tight_layout()
    fig.savefig(os.path.join(GRAF, f"img_{chave}_paeth.png"), bbox_inches="tight")
    plt.close(fig)

    fig, ax = plt.subplots(1, 2, figsize=(10, 3.8))
    ax[0].hist(u[..., :3].ravel(), bins=np.arange(257) - 0.5, color=AZUL)
    ax[0].set_title("Valores originais R, G, B")
    ax[0].set_xlabel("nível (0 a 255)")
    ax[1].hist(rgb.ravel(), bins=np.arange(-255, 257) - 0.5, color=LARANJA)
    ax[1].set_yscale("log")
    ax[1].set_title("Erro residual R, G, B (escala log)")
    ax[1].set_xlabel("erro (-255 a 255)")
    fig.tight_layout()
    fig.savefig(os.path.join(GRAF, f"img_{chave}_hist.png"))
    plt.close(fig)

    uri_rgb = data_uri_png(np.ascontiguousarray(u[..., :3]))
    uri_alfa = data_uri_png(np.ascontiguousarray(u[..., 3])) if ch == 4 else None
    soma = int(u[..., :3].astype(np.int64).sum())

    return {
        "id": chave, "arquivo": arquivo, "titulo": titulo, "papel": papel,
        "analista": analista, "preditor": preditor,
        "largura": int(w), "altura": int(h), "canais": int(ch), "modo": modo,
        "shape": [int(h), int(w), int(ch)],
        "tam_arquivo": os.path.getsize(caminho), "tam_bruto": int(h * w * ch), **tam,
        "alfa": alfa,
        "H_original_rgb": r(entropia(u[..., :3])), "H_residuo_rgb": r(entropia(rgb)),
        "H_original_canal": [r(entropia(u[..., k])) for k in range(ch)],
        "H_residuo_canal": [r(entropia(res[..., k])) for k in range(ch)],
        "H_residuo_todos": r(entropia(res)), "H_mod256_todos": r(entropia(res % 256)),
        "H_notebook_calc": r(H_nb), "distintos_notebook": distintos_nb,
        "distintos_inteiro": int(len(np.unique(res))),
        "stats_residuo_rgb": stats(rgb), "zeros_rgb": r(np.mean(rgb == 0) * 100, 2),
        "abs_menor_igual_8": r(np.mean(np.abs(rgb) <= 8) * 100, 2),
        "pixels_iguais": r(np.mean(np.all(rgb == 0, axis=2)) * 100, 2),
        "uri_rgb": uri_rgb, "uri_alfa": uri_alfa, "soma_rgb": soma,
        "notebook": NOTEBOOK[chave],
    }


def paeth_pred_float(xf):
    """Paeth em float32, como no notebook (mpimg)."""
    a = np.zeros_like(xf); b = np.zeros_like(xf); c = np.zeros_like(xf)
    a[:, 1:] = xf[:, :-1]; b[1:, :] = xf[:-1, :]; c[1:, 1:] = xf[:-1, :-1]
    p = a + b - c
    pa, pb, pc = np.abs(p - a), np.abs(p - b), np.abs(p - c)
    return np.where((pa <= pb) & (pa <= pc), a, np.where(pb <= pc, b, c))


# ===================================================================== TURMA
def grupo_de(nome):
    return int(nome[0])


def turma_audio():
    linhas = []
    for cam in sorted(glob.glob(os.path.join(BASE, "audios", "*.wav"))):
        nome = os.path.basename(cam)
        chave = nome[:10] if nome.startswith("41_clean") else nome[:2]
        fs, x, xi, bits = le_audio_inteiro(cam)
        n, ch = xi.shape
        _, res = residuo_ordem1(xi)
        lin = {"arquivo": nome, "grupo": grupo_de(nome), "nome": NOMES_TURMA[chave],
               "fs": int(fs), "canais": int(ch), "bits": int(bits), "dtype": str(x.dtype),
               "duracao": r(n / fs, 2), "tam_arquivo": os.path.getsize(cam),
               "H_original": r(np.mean([entropia(xi[:, k]) for k in range(ch)]), 3),
               "H_residuo": r(np.mean([entropia(res[:, k]) for k in range(ch)]), 3),
               "teto": r(np.log2(n), 2),
               "ganho_db": r(np.mean([10 * np.log10(xi[:, k].astype(float).var()
                                                    / max(res[:, k].astype(float).var(), 1e-12))
                                      for k in range(ch)]), 1),
               "estouro_notebook": estouro_notebook(x)}
        if bits <= 24:
            for m in ("ordem0", "ordem1", "lpc"):
                tam, cam_f = flac(cam, bits, m)
                lin["flac_" + m] = tam
                lin["bps_" + m] = r(tam * 8 / (n * ch), 2)
            lin["flac_identico"] = bool(np.array_equal(decodifica_flac(cam_f, bits, ch), xi))
        linhas.append(lin)
        print("  áudio", nome, bits, "bits", lin.get("bps_lpc"))
    return linhas


def turma_imagem():
    linhas = []
    for cam in sorted(glob.glob(os.path.join(BASE, "imagens", "*.png"))):
        nome = os.path.basename(cam)
        modo, u = le_imagem(cam)
        h, w, ch = u.shape
        res = u.astype(np.int32) - paeth_pred(u)
        k = min(ch, 3)
        lin = {"arquivo": nome, "grupo": grupo_de(nome), "nome": NOMES_TURMA[nome[:2]],
               "largura": int(w), "altura": int(h), "modo": modo, "tam_arquivo": os.path.getsize(cam),
               "tam_bruto": int(h * w * ch),
               "H_original": r(entropia(u[..., :k]), 3), "H_residuo": r(entropia(res[..., :k]), 3),
               "zeros": r(np.mean(res[..., :k] == 0) * 100, 1), **tamanhos_png(u)}
        linhas.append(lin)
        print("  imagem", nome, lin["H_residuo"])
    return linhas


# ====================================================================== MAIN
def main():
    print("Áudios do grupo...")
    audios = [analisa_audio(*a) for a in GRUPO_AUDIOS]
    print("Imagens do grupo...")
    imagens = [analisa_imagem(*i) for i in GRUPO_IMAGENS]

    # espectros dos dois áudios
    fig, ax = plt.subplots(1, 2, figsize=(11, 3.9), sharey=True)
    for a_, au in zip(ax, audios):
        f, P, Pr = au.pop("_espectro")
        a_.semilogx(f[1:], 10 * np.log10(P[1:]), color=AZUL, lw=1, label="original")
        a_.semilogx(f[1:], 10 * np.log10(Pr[1:]), color=LARANJA, lw=1, label="resíduo")
        a_.set_title(au["titulo"])
        a_.set_xlabel("frequência (Hz)")
        a_.legend(fontsize=8)
    ax[0].set_ylabel("densidade espectral (dB)")
    fig.suptitle("Espectro do canal esquerdo antes e depois da predição de ordem 1")
    fig.tight_layout()
    fig.savefig(os.path.join(GRAF, "audio_espectro.png"))
    plt.close(fig)

    # resposta do preditor: E(f) = X(f)(1 - e^{-j2pi f/fs})  ->  |H| = 2|sin(pi f/fs)|
    resp = {str(fq): r(20 * np.log10(2 * abs(np.sin(np.pi * fq / 44100))), 1)
            for fq in (100, 440, 1000, 5000, 11025, 22050)}

    print("Turma...")
    turma = {"audios": turma_audio(), "imagens": turma_imagem()}

    dados = {"gerado_por": "analise_lab2.py", "audios": audios, "imagens": imagens,
             "resposta_preditor_db": resp, "turma": turma}
    with open(os.path.join(SITE, "js", "dados.js"), "w", encoding="utf-8") as fh:
        fh.write("// Gerado por analise_lab2.py. Não editar à mão.\nwindow.LAB = ")
        json.dump(dados, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\n")

    # resumo no terminal (sem janelas e sem data URIs)
    for a in audios:
        a2 = {k: v for k, v in a.items() if k not in ("janelas",)}
        print(json.dumps(a2, ensure_ascii=False))
    for i in imagens:
        i2 = {k: v for k, v in i.items() if not k.startswith("uri")}
        print(json.dumps(i2, ensure_ascii=False))
    print("resposta do preditor (dB):", resp)
    os.makedirs(os.path.join(SITE, "codigo"), exist_ok=True)
    shutil.copy(os.path.abspath(__file__), os.path.join(SITE, "codigo", "analise_lab2.py"))
    print("OK")


if __name__ == "__main__":
    main()
