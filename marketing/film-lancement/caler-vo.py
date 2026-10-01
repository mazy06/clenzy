"""Baitly · Calage de la voix off du film de lancement sur les timecodes du hero (60 s).

À quoi sert ce fichier : à partir d'une prise complète (vo/fr/_prise-complete-*.mp3, les 9 répliques
dites d'un seul passage), il
  1. découpe les répliques au silence (même algorithme que ../motion/align-vo.py) ;
  2. pose chaque réplique à son départ cible (§ 4 de film-lancement.md), ou juste après la
     précédente si celle-ci déborde, sans jamais accélérer la voix ;
  3. écrit la piste voix de 60 s (WAV 48 kHz), les répliques séparées, les sous-titres (.srt) et
     calage.json (départs réels + mots repères pour caler les titres cinétiques).
Utilisation : python3 caler-vo.py vo/fr/_prise-complete-3-posee.mp3
Prérequis : ffmpeg.
À qui il s'adresse : monteur, motion designer.
"""
import importlib.util
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('align_vo', os.path.join(HERE, '..', 'motion', 'align-vo.py'))
av = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(av)
# Film calme : on garde les pauses « … » jusqu'à 0,8 s (les Reels les ramènent à 0,5 s).
av.MAX_PAUSE = 0.8

FILM = 60.0
END_LIMIT = 59.3     # la dernière réplique doit finir avant le fondu de fin (59,5 s)
GAP = 0.25           # respiration minimale entre deux répliques
SUB_MAX = 64         # sous-titre 16:9 : deux lignes de 32 signes

# (texte envoyé à ElevenLabs sans balises, départ cible en s, plan)
LINES = [
    ("Cinq plateformes. Trois équipes de ménage. Des dizaines de messages… et un seul vous.", 0.4, "P01"),
    ("Et si tout s'orchestrait… tout seul ?", 8.6, "P06"),
    ("Voici Bètli.", 13.3, "P08"),
    ("Toutes vos réservations, tous vos logements, réunis au même endroit.", 16.0, "P09"),
    ("Un voyageur part ? Le ménage est déjà planifié.", 24.0, "P12"),
    ("Besoin d'un photographe, d'une blanchisserie, d'un artisan ? Notre marketplace les met à portée de clic.", 30.5, "P15"),
    ("Et vos agents I.A. veillent : ils répondent, anticipent… et vous alertent quand ça compte vraiment.", 39.0, "P18"),
    ("Vous gardez le contrôle. Bètli s'occupe du reste.", 47.0, "P21"),
    ("Bètli. Votre location courte durée, en pilote automatique.", 54.6, "P24"),
]

# Mots repères : (réplique, mot) → moment où le titre cinétique ou l'action doit tomber.
CUES = [
    (0, "plateformes", "« 5 plateformes. »"), (0, "Trois", "« 3 équipes. »"), (0, "un seul vous", "« 1 seul vous. »"),
    (2, "Bètli", "Wordmark"), (3, "même endroit", "« Au même endroit. »"),
    (4, "part", "Brique « Parti »"), (4, "déjà planifié", "« Déjà planifié. »"),
    (5, "photographe", "Carte photographe"), (5, "clic", "« En un clic. »"),
    (6, "veillent", "« Vos agents IA veillent. »"), (6, "alertent", "Carte d'alerte"),
    (7, "contrôle", "« Vous gardez le contrôle. »"), (8, "pilote automatique", "Promesse ligne 2"),
]

DISPLAY = [("Bètli", "Baitly"), ("I.A.", "IA")]

# Fin de chaque réplique sauf la dernière (début du silence qui la suit, en s dans la prise).
# Vincent en v4 marque les « … » et les fins de réplique par des pauses de même longueur
# (0,2 à 0,7 s) : la détection automatique coupe alors sur les « … ». Coupures relevées phrase par
# phrase sur la carte des silences (29/09).
FORCE_BOUNDS = {
    '_prise-complete-1.mp3': [6.20, 9.02, 10.39, 14.04, 16.71, 21.79, 26.89, 29.91],
    '_prise-complete-2.mp3': [6.06, 9.01, 10.50, 14.00, 16.75, 21.78, 26.88, 29.79],
    '_prise-complete-3-posee.mp3': [6.28, 9.64, 11.32, 15.18, 17.95, 23.10, 28.52, 31.77],
    # Voix retenue le 29/09 : Paul K (pub, bande-annonce), direction keynote, Stabilité 0,3.
    '_prise-complete-k1-paulk.mp3': [5.73, 8.92, 10.57, 14.61, 17.44, 22.85, 28.21, 31.23],
}


def forced_bounds(total, sils, ends):
    bounds, start = [], 0.0
    for e in ends:
        sil = next((s for s in sils if abs(s[0] - e) < 0.02), None)
        if sil is None:
            raise SystemExit(f"aucun silence ne commence à {e:.2f} s : corriger FORCE_BOUNDS")
        bounds.append((start, sil[0]))
        start = sil[1]
    bounds.append((start, total))
    return bounds


def display(text):
    t = text
    for a, b in DISPLAY:
        t = t.replace(a, b)
    return t


def srt_time(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def main(take):
    name = os.path.splitext(os.path.basename(take))[0].replace('_prise-complete-', 'prise-')
    out = os.path.join(os.path.dirname(os.path.abspath(take)), name)
    os.makedirs(out, exist_ok=True)

    total = av.duration(take)
    sils = av.silences(take)
    forced = FORCE_BOUNDS.get(os.path.basename(take))
    bounds = forced_bounds(total, sils, forced) if forced else av.split_lines(total, sils, [t for t, _, _ in LINES])

    placed, prev_end = [], 0.0
    for i, ((text, target, shot), (a, b)) in enumerate(zip(LINES, bounds)):
        wav = os.path.join(out, f"b{i + 1}.wav")
        dur = av.cut_line(take, a, b, sils, wav)
        start = max(target, prev_end + GAP if placed else target)
        placed.append({"b": f"b{i + 1}", "plan": shot, "cible": target, "depart": round(start, 2),
                       "fin": round(start + dur, 2), "duree": round(dur, 2), "texte": text,
                       "debit_car_s": round(len(av.spoken(text)) / dur, 1)})
        prev_end = start + dur

    # Piste de 60 s : chaque réplique retardée à son départ, mixée, normalisée (stem voix).
    inputs, graph = [], []
    for i, p in enumerate(placed):
        inputs += ['-i', os.path.join(out, p["b"] + ".wav")]
        ms = int(round(p["depart"] * 1000))
        graph.append(f"[{i}:a]adelay={ms}:all=1[d{i}]")
    graph.append(''.join(f"[d{i}]" for i in range(len(placed))) +
                 f"amix=inputs={len(placed)}:normalize=0,apad=whole_dur={FILM},atrim=0:{FILM},"
                 "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[o]")
    track = os.path.join(out, "vo-hero-60s-fr.wav")
    r = av.sh(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(graph),
               '-map', '[o]', '-ac', '2', '-ar', '48000', track])
    if r.returncode:
        raise SystemExit(r.stderr)

    # Sous-titres : texte d'affichage découpé en morceaux de deux lignes, temps au prorata des signes.
    subs = []
    for p in placed:
        shown = display(p["texte"])
        parts = av.chunks(shown, SUB_MAX)
        total_chars = sum(len(c) for c in parts)
        t = p["depart"]
        for c in parts:
            d = p["duree"] * len(c) / total_chars
            subs.append((t, t + d, c))
            t += d
    with open(os.path.join(out, "vo-hero-60s-fr.srt"), "w", encoding="utf-8") as f:
        for n, (a, b, c) in enumerate(subs, 1):
            # 0,2 s de lecture en plus après la voix, sans empiéter sur le sous-titre suivant
            nxt = subs[n][0] - 0.04 if n < len(subs) else FILM
            f.write(f"{n}\n{srt_time(a)} --> {srt_time(min(b + 0.2, nxt))}\n{c}\n\n")

    cues = []
    for i, word, label in CUES:
        p = placed[i]
        cues.append({"repere": label, "mot": word, "t": round(av.word_time(p["texte"], word, p["depart"], p["duree"]), 2)})

    with open(os.path.join(out, "calage.json"), "w", encoding="utf-8") as f:
        json.dump({"prise": os.path.basename(take), "repliques": placed, "reperes": cues}, f, ensure_ascii=False, indent=2)

    print(f"Prise : {os.path.basename(take)} ({total:.1f} s) → {os.path.relpath(out, HERE)}/")
    print(f"{'':4}{'plan':5}{'cible':>7}{'départ':>8}{'fin':>7}{'durée':>7}{'car/s':>7}  alerte")
    for n, p in enumerate(placed):
        nxt = placed[n + 1]["cible"] if n + 1 < len(placed) else END_LIMIT
        warn = []
        if p["depart"] - p["cible"] > 0.05:
            warn.append(f"retard {p['depart'] - p['cible']:.2f} s")
        if p["fin"] > nxt:
            warn.append(f"déborde de {p['fin'] - nxt:.2f} s sur la suite")
        if not 9 <= p["debit_car_s"] <= 21:
            warn.append("débit anormal : vérifier la coupure")
        print(f"{p['b']:4}{p['plan']:5}{p['cible']:7.1f}{p['depart']:8.2f}{p['fin']:7.2f}{p['duree']:7.2f}{p['debit_car_s']:7.1f}  {', '.join(warn)}")
    print("Repères (estimés au prorata des signes) : " + " · ".join(f"{c['repere']} {c['t']:.1f}" for c in cues))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
