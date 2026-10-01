"""Baitly · Relecture des textes des Reels : un fichier .txt par vidéo.

À quoi sert ce fichier : transforme le JSON produit par extract-texts.mjs en fichiers texte simples
(UTF-8), un par vidéo, où chaque langue est regroupée : voix off, sous-titres, textes à l'écran.
Un fichier supplémentaire rassemble les voix off seules des 7 vidéos (voix-off-tous-les-reels.txt).
Utilisation : python3 relecture/build_txt.py relecture/textes.json relecture/txt
À qui il s'adresse : marketing, traducteurs (lecture et relecture rapide).
"""
import json
import os
import sys

from build_xlsx import NAMES

LANG_TITLE = {'fr': 'FRANÇAIS', 'en': 'ENGLISH', 'ar': 'العربية (ARABE)'}
RULE = '=' * 78
SUB = '-' * 78


def reel_text(reel):
    name, pitch = NAMES[reel['dir']]
    out = [RULE, f"{name.upper()} — {pitch}", f"Format {reel['fmt']} · {reel['duration']} s · langues : {' · '.join(l.upper() for l in reel['langs'])}", RULE, '']
    out.append('Conventions : dans les voix off, « … » = pause ; la marque est écrite comme elle se prononce')
    out.append('(« Bètli », « Betly », « بيتلي »). Dans les sous-titres et les titres, [ ] = mots affichés en couleur.')
    out.append('')
    langs = list(reel['langs'])
    has_fr_voice = any(v.get('fr') for v in reel['voice'])
    if 'fr' not in langs and has_fr_voice:
        langs = ['ar', 'fr']
    for lg in langs:
        only_voice = lg not in reel['langs']
        title = LANG_TITLE[lg] + (' — traduction de travail de la voix off (non enregistrée)' if only_voice else '')
        out += [SUB, title, SUB, '']
        out.append('VOIX OFF')
        for v in reel['voice']:
            text = v.get(lg)
            if not text:
                continue
            target = v.get(lg + 'Target')
            window = v['window'].split(' (')[0]
            out.append(f"  {v['id']}  [{window}{' · durée visée ' + target if target else ''}]")
            out.append(f"      {text.replace('  (traduction de travail, non enregistrée)', '')}")
        if only_voice:
            out.append('')
            continue
        out.append('')
        out.append('SOUS-TITRES')
        for s in reel['subs']:
            if s.get(lg):
                out.append(f"  {s['id']}  [{s['timing']}]  {s[lg]}")
        out.append('')
        out.append('TEXTES À L’ÉCRAN')
        last_ctx = None
        for i, s in enumerate(reel['screen'], start=1):
            if not s.get(lg):
                continue
            ctx = s['context']
            if ctx != last_ctx:
                out.append(f"  · {ctx}")
                last_ctx = ctx
            out.append(f"      E{i}  {s[lg]}")
        out.append('')
    return '\n'.join(out) + '\n'


def voice_only(data):
    """Les voix off seules, des 7 vidéos, dans un fichier : vidéo → langue → répliques."""
    out = ['BAITLY · VOIX OFF DES 7 VIDÉOS (FR · EN · AR)', '']
    for reel in data:
        name, _ = NAMES[reel['dir']]
        out += [RULE, name.upper(), RULE]
        langs = [l for l in ('fr', 'en', 'ar') if any(v.get(l) for v in reel['voice'])]
        if 'fr' not in reel['langs']:
            langs = ['ar', 'fr']
        for lg in langs:
            label = LANG_TITLE[lg] + (' — traduction de travail, non enregistrée' if lg not in reel['langs'] else '')
            out += ['', label, '']
            for v in reel['voice']:
                if v.get(lg):
                    out.append(f"{v['id']}  {v[lg].replace('  (traduction de travail, non enregistrée)', '')}")
        out.append('')
    return '\n'.join(out) + '\n'


def build(data, outdir):
    os.makedirs(outdir, exist_ok=True)
    everything = []
    for reel in data:
        txt = reel_text(reel)
        everything.append(txt)
        path = os.path.join(outdir, reel['dir'] + '.txt')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(txt)
    with open(os.path.join(outdir, 'voix-off-tous-les-reels.txt'), 'w', encoding='utf-8') as f:
        f.write(voice_only(data))
    print('Fichiers texte : ' + outdir)


if __name__ == '__main__':
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    build(json.load(open(sys.argv[1], encoding='utf-8')), sys.argv[2])
