"""Baitly · Teaser 15 s · musique composée par synthèse, calée sur la grille de l'animation.

À quoi sert ce fichier : écrire `audio/teaser-musique.wav` (48 kHz, stéréo, −14 LUFS, crête ≤ −1 dBTP),
une piste électronique à 128 BPM en ré majeur, mesure par mesure sur les 8 scènes du teaser :
  1 accroche : quatre impacts (kick + clap + accord bref), un par temps, sous les mots qui tombent ;
  2 logo     : pulsation filtrée qui monte, roulement de caisse claire sur les deux derniers temps ;
  3 à 6      : groove (kick à chaque temps, clap sur 2 et 4, charleston, basse en contretemps pompée
               par le kick, arpège pincé en doubles croches, nappe) sur ré – si m – sol – la ;
  7 paiement : montée (roulement qui accélère, souffle ascendant, le kick lâche au dernier temps) ;
  8 fin      : grand accord de ré (maj9) sur le premier temps, queue de réverbération, silence à 15 s.
Les effets sonores (whoosh, clics, tics, scintillement) sont posés aux temps de `grille.js`, la même
source que l'animation : image et son ne peuvent pas se décaler.
Crête vraie visée ≤ −2 dBTP : l'encodage AAC des MP4 fait remonter les crêtes d'environ 2 dB.
Utilisation : python3 musique.py   (prérequis : numpy, scipy, ffmpeg pour la mesure de sonie)
À qui il s'adresse : motion designer, sound designer. Musique originale, libre de droits.
"""
import json
import os
import re
import subprocess

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
rng = np.random.default_rng(128)

src = open(os.path.join(HERE, 'grille.js'), encoding='utf-8').read()
G = json.loads(src[src.index('{'):src.rindex('}') + 1])
BEAT = 60.0 / G['bpm']
BAR = 4 * BEAT
DUR = G['mesures'] * BAR                       # 15,0 s
N = int(round(DUR * SR))
S = lambda beats: beats * BEAT                  # temps (beats) → secondes


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def t_axis(sec):
    return np.arange(int(sec * SR)) / SR


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype='band', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype='high', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype='low', fs=SR, output='sos'), x)


def saw(freq, t, phase=0.0):
    """Dent de scie adoucie (somme d'harmoniques limitée sous 12 kHz : pas de repliement)."""
    out = np.zeros_like(t)
    for k in range(1, int(12000 / freq) + 1):
        out += np.sin(2 * np.pi * k * freq * t + phase * k) / k
    return out * (2 / np.pi)


class Bus:
    def __init__(self):
        self.x = np.zeros((N, 2))

    def add(self, sig, start, gain=1.0, pan=0.0):
        """Pose un signal mono (ou stéréo) à `start` secondes, panoramique à puissance constante."""
        i = int(round(start * SR))
        if i >= N:
            return
        if sig.ndim == 1:
            l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            sig = np.stack([sig * l, sig * r], axis=1) * np.sqrt(2)
        if i < 0:
            sig, i = sig[-i:], 0
        n = min(len(sig), N - i)
        self.x[i:i + n] += sig[:n] * gain


drums, bass, synth, fx, verb_send = Bus(), Bus(), Bus(), Bus(), Bus()


# ---------- instruments ----------
def kick(level=1.0):
    t = t_axis(0.42)
    f = 46 + 120 * np.exp(-t * 32)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    click = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 400) * 0.35
    return np.tanh(1.6 * (0.9 * body + click)) * level


def clap():
    t = t_axis(0.35)
    n = rng.standard_normal(len(t))
    env = np.zeros_like(t)
    for d in (0.0, 0.011, 0.022):
        m = t >= d
        env[m] += np.exp(-(t[m] - d) * 180)
    env += np.exp(-np.maximum(t - 0.03, 0) * 16) * (t >= 0.03) * 0.55
    return bp(n * env, 900, 5200) * 1.1


def hat(open_=False):
    t = t_axis(0.35 if open_ else 0.06)
    n = hp(rng.standard_normal(len(t)), 7500, 4)
    return n * np.exp(-t * (14 if open_ else 90)) * (0.85 if open_ else 0.6)


def snare(level=1.0):
    t = t_axis(0.18)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 40) * 0.5
    noise = bp(rng.standard_normal(len(t)), 1200, 7000) * np.exp(-t * 28)
    return (tone + noise) * level


def chord_voice(notes, sec, cutoff, attack=0.004, decay=None, detune=0.07):
    t = t_axis(sec)
    x = np.zeros_like(t)
    for m in notes:
        f = midi(m)
        for d in (-detune, detune):
            x += saw(f * 2 ** (d / 12), t, rng.uniform(0, 2 * np.pi))
    x /= max(1, 2 * len(notes)) ** 0.7
    x = lp(x, cutoff, 2)
    env = np.minimum(1, t / attack)
    if decay:
        env *= np.exp(-t / decay)
    return x * env


def pluck(m, sec=0.22):
    t = t_axis(sec)
    f = midi(m)
    x = saw(f * 2 ** (0.08 / 12), t) + saw(f * 2 ** (-0.08 / 12), t) + 0.4 * np.sin(2 * np.pi * f * t)
    # filtre qui se ferme vite : attaque brillante, corps rond
    bright = lp(x, 7200) * np.exp(-t * 24)
    body = lp(x, 1100) * np.exp(-t * 11)
    return (bright * 0.75 + body * 0.45) * np.minimum(1, t / 0.002) * 0.33


def bass_note(m, sec):
    t = t_axis(sec)
    f = midi(m)
    x = lp(saw(f, t), 700) * 0.7 + np.sin(2 * np.pi * f * t) * 0.6
    env = np.minimum(1, t / 0.004) * np.exp(-t * 5.5)
    return np.tanh(1.4 * x * env) * 0.55


def sweep_noise(sec, lo=(1400,), hi=(3000, 9000)):
    """Souffle qui monte : fondu enchaîné d'un bruit sombre vers un bruit brillant (sans clic)."""
    n = rng.standard_normal(int(sec * SR))
    p = np.linspace(0, 1, len(n))
    return lp(n, lo[0]) * (1 - p) + bp(n, *hi) * p


# Accords (ré majeur) : ré – si m – sol – la ; basse en octave 2.
CH = {'D': [62, 66, 69, 74], 'Bm': [59, 62, 66, 71], 'G': [55, 59, 62, 67], 'A': [57, 61, 64, 69]}
ROOT = {'D': 38, 'Bm': 35, 'G': 43, 'A': 45}
ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 3, 2, 1, 2]


def bar_start(k):          # mesure k (0 à 7)
    return k * BAR


kicks = []                 # instants des kicks (pour le sidechain)

# 1 · accroche : quatre impacts, un par temps
for b in range(4):
    st = bar_start(0) + b * BEAT
    drums.add(kick(1.0), st); kicks.append(st)
    drums.add(clap(), st, 0.55); verb_send.add(clap(), st, 0.25)
    stab = chord_voice([n + 12 for n in CH['D']] if b % 2 else CH['D'], 0.3, 5200, decay=0.09)
    synth.add(stab, st, 0.55, pan=(-0.3 if b % 2 else 0.3)); verb_send.add(stab, st, 0.3)

# 2 · logo : pulsation en croches, filtre qui s'ouvre, roulement final
for e in range(8):
    st = bar_start(1) + e * BEAT / 2
    p = e / 7
    pulse = chord_voice(CH['D'], 0.26, 500 + 4200 * p ** 1.6, decay=0.12)
    synth.add(pulse, st, 0.28 + 0.2 * p)
    if e % 2 == 0:
        drums.add(kick(0.55 + 0.3 * p), st); kicks.append(st)
t_b = t_axis(BAR)
fx.add(sweep_noise(BAR, lo=(1200,), hi=(2500, 8000)) * (0.25 + 0.75 * t_b / BAR) ** 2 * 0.2, bar_start(1))
for s16 in range(8):
    st = bar_start(1) + 2 * BEAT + s16 * BEAT / 4
    drums.add(snare(0.25 + 0.5 * s16 / 7), st)

# 3 à 6 · groove
prog = ['D', 'Bm', 'G', 'A']
for k in range(2, 6):
    ch = prog[k - 2]
    for b in range(4):
        st = bar_start(k) + b * BEAT
        drums.add(kick(1.0), st); kicks.append(st)
        if b in (1, 3):
            drums.add(clap(), st, 0.7); verb_send.add(clap(), st, 0.3)
        drums.add(hat(True), st + BEAT / 2, 0.55, pan=0.2)
        bass.add(bass_note(ROOT[ch], BEAT / 2 * 0.95), st + BEAT / 2)
    for s16 in range(16):
        st = bar_start(k) + s16 * BEAT / 4
        drums.add(hat(), st, 0.8 if s16 % 2 else 0.45, pan=-0.25)
        note = CH[ch][ARP[s16]] + 12
        pl = pluck(note)
        synth.add(pl, st, 0.9, pan=(-0.35 if s16 % 2 else 0.35)); verb_send.add(pl, st, 0.18)
    pad = chord_voice(CH[ch], BAR, 1700, attack=0.08)
    synth.add(pad, bar_start(k), 0.32); verb_send.add(pad, bar_start(k), 0.12)

# 7 · montée
for b in range(3):
    st = bar_start(6) + b * BEAT
    drums.add(kick(0.95), st); kicks.append(st)
    bass.add(bass_note(ROOT['G' if b < 2 else 'A'], BEAT / 2 * 0.95), st + BEAT / 2)
roll = [0, .5, 1, 1.5, 2, 2.25, 2.5, 2.75] + [3 + i / 8 for i in range(8)]
for i, bpos in enumerate(roll):
    drums.add(snare(0.3 + 0.7 * i / len(roll)), bar_start(6) + bpos * BEAT, 0.7)
t_r = t_axis(BAR)
fx.add(sweep_noise(BAR) * (t_r / BAR) ** 2 * 0.35, bar_start(6), pan=0.0)
for s16 in range(12):
    st = bar_start(6) + s16 * BEAT / 4
    note = CH['G' if s16 < 8 else 'A'][ARP[s16]] + 12
    synth.add(lp(pluck(note), 2000 + 400 * s16), st, 0.7, pan=(-0.3 if s16 % 2 else 0.3))

# 8 · fin : grand accord de ré (maj9), queue, silence à 15 s
st = bar_start(7)
drums.add(kick(1.1), st); kicks.append(st)
crash = hp(rng.standard_normal(int(1.6 * SR)), 5000) * np.exp(-t_axis(1.6) * 3.2) * 0.35
fx.add(crash, st, pan=0.0); verb_send.add(crash, st, 0.2)
big = chord_voice([50, 62, 66, 69, 73, 76], 1.8, 4800, attack=0.003, decay=0.75)
synth.add(big, st, 0.75); verb_send.add(big, st, 0.4)
sub = np.sin(2 * np.pi * midi(26) * t_axis(1.4)) * np.exp(-t_axis(1.4) * 2.6) * 0.6
bass.add(sub, st)

# ---------- effets sonores calés sur l'animation ----------
for b in G['sons']['whoosh']:
    tw = t_axis(0.55)
    w = sweep_noise(0.55, lo=(900,), hi=(2500, 7000))
    env = np.sin(np.pi * np.minimum(1, tw / 0.55)) ** 2
    fx.add(np.stack([w * env * np.linspace(1, .4, len(tw)), w * env * np.linspace(.4, 1, len(tw))], axis=1) * 0.22, S(b + 0.65) - 0.55)
for b in G['sons']['clic']:
    tc = t_axis(0.06)
    c = np.sin(2 * np.pi * 2100 * tc) * np.exp(-tc * 90) * 0.5 + hp(rng.standard_normal(len(tc)), 3000) * np.exp(-tc * 600) * 0.4
    fx.add(c, S(b), 0.45)
for b in G['sons']['tic']:
    tt = t_axis(0.12)
    fx.add(np.sin(2 * np.pi * 2637 * tt) * np.exp(-tt * 45) * 0.22, S(b) + 0.01, pan=0.15)
for b in G['sons']['scintillement']:
    ts = t_axis(1.1)
    sh = sum(np.sin(2 * np.pi * midi(m) * ts) * np.exp(-np.maximum(ts - d, 0) * 5) * (ts >= d)
             for m, d in ((86, 0), (90, .06), (93, .12), (98, .18)))
    fx.add(sh * 0.07, S(b)); verb_send.add(sh * 0.07, S(b), 0.6)

# ---------- mixage ----------
# Sidechain : la basse et les synthés s'effacent sous chaque kick (pompe du groove).
duck = np.ones(N)
for k in kicks:
    i = int(k * SR)
    tt = t_axis(0.28)
    seg = 1 - 0.75 * np.exp(-tt * 14)
    n = min(len(seg), N - i)
    duck[i:i + n] = np.minimum(duck[i:i + n], seg[:n])
bass.x *= duck[:, None]
synth.x *= (0.35 + 0.65 * duck)[:, None]

# Réverbération : réponse impulsionnelle synthétique (bruit stéréo décroissant, 1,3 s, assombrie).
ti = t_axis(1.3)
ir = np.stack([lp(rng.standard_normal(len(ti)), 6000) * np.exp(-ti * 5.2) for _ in range(2)], axis=1)
ir[:int(0.012 * SR)] = 0                     # pré-délai
wet = np.stack([fftconvolve(verb_send.x[:, c], ir[:, c])[:N] for c in range(2)], axis=1) * 0.05

mix = drums.x * 0.9 + bass.x * 0.95 + synth.x * 0.6 + fx.x + wet
mix = hp(mix.T, 28).T                        # nettoie l'infra-grave
mix = mix + hp(mix.T, 5000).T * 0.35          # un peu d'air dans l'aigu
# Fin : silence exact à 15 s (fondu sur les 0,5 dernières secondes).
fade = np.ones(N); fade[-int(0.5 * SR):] = np.linspace(1, 0, int(0.5 * SR)) ** 2
mix *= fade[:, None]


def limiter(x, ceiling=0.86, release=0.08):
    """Limiteur à anticipation : gain calculé sur l'enveloppe crête (5 ms d'avance)."""
    look = int(0.005 * SR)
    peak = np.max(np.abs(x), axis=1)
    g = np.minimum(1, ceiling / np.maximum(peak, 1e-9))
    # attaque instantanée (anticipée de `look`), relâchement exponentiel
    out_g = np.empty_like(g)
    cur, a = 1.0, np.exp(-1 / (release * SR))
    ahead = np.concatenate([g[look:], np.ones(look)])
    for i in range(len(g)):
        tgt = min(g[i], ahead[i])
        cur = tgt if tgt < cur else tgt + (cur - tgt) * a
        out_g[i] = cur
    return x * out_g[:, None]


def lufs(path):
    err = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[0-9.]+) LUFS', err)[-1]), float(re.findall(r'Peak:\s+(-?[0-9.]+) dBFS', err)[-1])


out_dir = os.path.join(HERE, 'audio')
os.makedirs(out_dir, exist_ok=True)
path = os.path.join(out_dir, 'teaser-musique.wav')
x = mix / np.max(np.abs(mix)) * 0.5
ceiling = 0.86
for _ in range(8):                           # sonie visée : −14 LUFS, crête vraie ≤ −2 dBTP (marge pour l'AAC)
    y = limiter(x, ceiling)
    wavfile.write(path, SR, (np.clip(y, -1, 1) * 32767).astype(np.int16))
    i_lufs, tp = lufs(path)
    if abs(i_lufs + 14) < 0.3 and tp <= -2.0:
        break
    x = x * 10 ** ((-14 - i_lufs) / 20)
    if tp > -2.0:                            # crêtes entre échantillons : plafond abaissé d'autant
        ceiling *= 10 ** ((-2.2 - tp) / 20)
print(f'{path} · {N / SR:.2f} s · {i_lufs:.1f} LUFS · crête {tp:.1f} dBTP')
