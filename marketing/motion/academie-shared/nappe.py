"""Baitly Académie · nappe musicale de la série, composée par synthèse.

À quoi sert ce fichier : écrire `audio/academie-nappe.wav` (200 s, 48 kHz, stéréo, −14 LUFS, crête
≤ −2 dBTP), un fond calme et lumineux posé SOUS la voix des épisodes (gain 0,16 dans timeline.js) :
100 BPM, ré majeur, grille ré – la – si m – sol ; nappe de cordes synthétiques, arpège pincé doux en
croches, charleston très léger, pas de grosse caisse (la voix reste devant). Les épisodes longs durent
près de trois minutes : l'arpège change de dessin toutes les 8 mesures, le charleston n'entre qu'une
section sur deux et une cloche douce ponctue une section sur trois, pour que la boucle ne lasse pas.
Fondu d'entrée court ; la sortie est fondue au rendu (`fadeOut` dans timeline.js), à la durée de l'épisode.
Utilisation : python3 nappe.py   (prérequis : numpy, scipy, ffmpeg pour la mesure de sonie)
À qui il s'adresse : motion designer, sound designer. Musique originale, libre de droits.
"""
import os
import re
import subprocess

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
SR, BPM, DUR = 48000, 100, 200.0
BEAT = 60 / BPM
BAR = 4 * BEAT
N = int(DUR * SR)
rng = np.random.default_rng(1)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def ta(sec):
    return np.arange(int(sec * SR)) / SR


def lp(x, f):
    return sosfilt(butter(2, f, btype='low', fs=SR, output='sos'), x)


def hp(x, f):
    return sosfilt(butter(2, f, btype='high', fs=SR, output='sos'), x)


def saw(f, t):
    out = np.zeros_like(t)
    for k in range(1, int(9000 / f) + 1):
        out += np.sin(2 * np.pi * k * f * t + rng.uniform(0, 6.28)) / k
    return out * (2 / np.pi)


mix = np.zeros((N, 2))
send = np.zeros((N, 2))


def put(sig, start, gain, pan=0.0, rev=0.0):
    i = int(start * SR)
    if i >= N:
        return
    n = min(len(sig), N - i)
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    st = np.stack([sig[:n] * l, sig[:n] * r], axis=1) * np.sqrt(2) * gain
    mix[i:i + n] += st
    send[i:i + n] += st * rev


CH = [[62, 66, 69, 74], [61, 64, 69, 73], [59, 62, 66, 71], [55, 59, 62, 67]]   # ré, la, si m, sol
ROOT = [38, 45, 47, 43]
ARPS = [[0, 1, 2, 3, 2, 1, 2, 3], [0, 2, 1, 3, 0, 2, 1, 3], [3, 2, 1, 0, 1, 2, 3, 2]]   # indices dans l'accord
bars = int(DUR / BAR) + 1
for b in range(bars):
    st = b * BAR
    ch = CH[b % 4]
    # nappe : attaque lente, filtre doux, désaccord léger
    t = ta(BAR + .6)
    pad = sum(lp(saw(midi(m) * 2 ** (d / 1200), t), 1400) for m in ch for d in (-7, 7)) / 6
    env = np.minimum(1, t / .8) * np.minimum(1, np.maximum(0, (BAR + .6 - t) / .6))
    put(pad * env, st, .30, rev=.5)
    # basse ronde, une ronde par mesure
    tb = ta(BAR)
    put(np.sin(2 * np.pi * midi(ROOT[b % 4]) * tb) * np.exp(-tb * .9) * .55, st, .5)
    sec = b // 8                                   # section de 8 mesures
    # arpège pincé en croches, doux ; son dessin change à chaque section
    pattern = ARPS[sec % len(ARPS)]
    for e in range(8):
        m = ch[pattern[e]] + 12
        tp = ta(.5)
        pl = lp(saw(midi(m), tp), 2600) * np.exp(-tp * 9) * .5 + np.sin(2 * np.pi * midi(m) * tp) * np.exp(-tp * 6) * .3
        put(pl, st + e * BEAT / 2, .22, pan=(-.35 if e % 2 else .35), rev=.35)
    # cloche douce en tête de phrase, une section sur trois
    if sec % 3 == 2 and b % 4 == 0:
        tc = ta(3.0)
        put(np.sin(2 * np.pi * midi(ch[3] + 24) * tc) * np.exp(-tc * 1.6) * .5, st, .10, pan=-.2, rev=.6)
    # charleston très léger en contretemps, une section sur deux
    for e in range(4 if sec % 2 else 0):
        th = ta(.05)
        put(hp(rng.standard_normal(len(th)), 8000) * np.exp(-th * 90), st + e * BEAT + BEAT / 2, .05, pan=.2)

ti = ta(2.2)
ir = np.stack([lp(rng.standard_normal(len(ti)), 5000) * np.exp(-ti * 3.2) for _ in range(2)], axis=1)
wet = np.stack([fftconvolve(send[:, c], ir[:, c])[:N] for c in range(2)], axis=1) * .03
out = hp((mix + wet).T, 40).T
fade = np.ones(N); fade[:int(1.5 * SR)] = np.linspace(0, 1, int(1.5 * SR)); fade[-int(2 * SR):] = np.linspace(1, 0, int(2 * SR))
out *= fade[:, None]


def lufs(path):
    err = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[0-9.]+) LUFS', err)[-1]), float(re.findall(r'Peak:\s+(-?[0-9.]+) dBFS', err)[-1])


os.makedirs(os.path.join(HERE, 'audio'), exist_ok=True)
path = os.path.join(HERE, 'audio', 'academie-nappe.wav')
x = out / np.max(np.abs(out)) * .5
for _ in range(6):
    y = np.tanh(x * 1.1) / np.tanh(1.1)          # saturation douce en guise de limiteur
    wavfile.write(path, SR, (np.clip(y, -1, 1) * 32767).astype(np.int16))
    i_l, tp = lufs(path)
    if abs(i_l + 14) < .4 and tp <= -2:
        break
    x = x * 10 ** ((-14 - i_l) / 20) * (10 ** ((-2.3 - tp) / 20) if tp > -2 else 1)
print(f'{path} · {DUR:.0f} s · {i_l:.1f} LUFS · crête {tp:.1f} dBTP')
