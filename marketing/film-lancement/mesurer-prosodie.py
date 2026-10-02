"""Baitly · Mesure de la prosodie d'une voix off (à quel point elle est vivante ou monotone).

À quoi sert ce fichier : comparer des prises sans les écouter une à une, avec trois chiffres :
  - variation de hauteur : écart type de la mélodie, en demi-tons (chiffre COMPARATIF entre prises
    d'un même texte, pas une note absolue) ;
  - étendue de hauteur : du 5e au 95e centile, en demi-tons ;
  - variation de volume : écart type de l'énergie des passages parlés, en dB (les appuis, les
    attaques, les chutes).
Hauteur estimée par l'algorithme YIN (numpy seul). L'oreille reste juge : ces chiffres détectent
une voix plate, ils ne disent pas si le jeu est juste.
Utilisation : python3 mesurer-prosodie.py fichier1.mp3 [fichier2.mp3 …]
Prérequis : ffmpeg, numpy.
"""
import subprocess
import sys
import warnings

import numpy as np

SR = 16000
FRAME = 640          # 40 ms
HOP = 160            # 10 ms
FMIN, FMAX = 65, 400
YIN_THRESHOLD = 0.15
WORDS = 86           # mots du texte du hero (sans balises)


def load(path):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0


def yin_frame(x, tau_max):
    """Période fondamentale d'une trame (en échantillons) ou None si non voisée."""
    w = len(x) - tau_max
    spec = np.fft.rfft(x, n=2 * len(x))
    corr = np.fft.irfft(spec * np.conj(np.fft.rfft(x[:w], n=2 * len(x))))[:tau_max + 1]
    energy = np.cumsum(np.concatenate(([0.0], x ** 2)))
    e0 = energy[w]
    e_tau = energy[np.arange(tau_max + 1) + w] - energy[np.arange(tau_max + 1)]
    d = e0 + e_tau - 2 * corr
    d[0] = 0
    cmnd = np.ones_like(d)
    cs = np.cumsum(d[1:])
    cmnd[1:] = d[1:] * np.arange(1, tau_max + 1) / np.where(cs == 0, 1, cs)
    tau_min = int(SR / FMAX)
    below = np.where(cmnd[tau_min:] < YIN_THRESHOLD)[0]
    if not len(below):
        return None
    t = below[0] + tau_min
    while t + 1 <= tau_max and cmnd[t + 1] < cmnd[t]:
        t += 1
    if 1 <= t < tau_max:   # interpolation parabolique
        a, b, c = cmnd[t - 1], cmnd[t], cmnd[t + 1]
        den = a - 2 * b + c
        if den:
            t = t + 0.5 * (a - c) / den
    return t


def analyse(path):
    x = load(path)
    tau_max = int(SR / FMIN)
    span = FRAME + tau_max
    f0, rms = [], []
    for start in range(0, len(x) - span, HOP):
        fr = x[start:start + span]
        level = 20 * np.log10(np.sqrt(np.mean(fr[:FRAME] ** 2)) + 1e-9)
        rms.append(level)
        if level < -45:
            f0.append(np.nan)
            continue
        t = yin_frame(fr, tau_max)
        f0.append(SR / t if t else np.nan)
    f0, rms = np.array(f0), np.array(rms)
    voiced = ~np.isnan(f0)
    st_all = np.full(len(f0), np.nan)
    st_all[voiced] = 12 * np.log2(f0[voiced] / np.median(f0[voiced]))
    # Lissage médian sur 5 trames : une trame qui s'écarte de plus de 3 demi-tons de son voisinage
    # est une erreur de suivi (octave, voix craquée), pas de la mélodie.
    padded = np.pad(st_all, 2, constant_values=np.nan)
    windows = np.lib.stride_tricks.sliding_window_view(padded, 5)
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', RuntimeWarning)   # fenêtres entièrement muettes
        smooth = np.nanmedian(windows, axis=1)
    keep = voiced & (np.abs(st_all - smooth) < 3)
    st = st_all[keep]
    speech = rms > (np.max(rms) - 30)
    return {
        'duree': len(x) / SR,
        'f0': float(np.median(f0[voiced])),
        'var_st': float(np.std(st)),
        'etendue_st': float(np.percentile(st, 95) - np.percentile(st, 5)),
        'var_db': float(np.std(rms[speech])),
    }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    print(f"{'fichier':46}{'durée':>7}{'mots/s':>8}{'F0':>6}{'var. hauteur':>14}{'étendue':>9}{'var. volume':>13}")
    for p in sys.argv[1:]:
        m = analyse(p)
        name = p.split('/')[-1]
        print(f"{name:46}{m['duree']:6.1f}s{WORDS / m['duree']:8.2f}{m['f0']:5.0f}Hz{m['var_st']:11.2f} st{m['etendue_st']:7.1f} st{m['var_db']:10.1f} dB")
