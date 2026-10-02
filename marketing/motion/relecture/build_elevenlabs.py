"""Baitly · Fichier unique à utiliser pour générer les voix off dans ElevenLabs.

À quoi sert ce fichier : à partir du JSON produit par extract-texts.mjs, écrit UN fichier texte qui
réunit les indications (voix, réglages, nommage, dépôt) et les scripts de voix off, séparés par
vidéo puis par langue, avec les balises Eleven v3 de tags_v3.py. Chaque script est encadré par des
repères de début et de fin : seul le texte entre ces repères se colle dans ElevenLabs (un paragraphe
par réplique : paragraphe 1 = b1…). Écrit aussi scripts-v3.json (mêmes textes balisés, pour une
génération automatisée).
Utilisation : python3 relecture/build_elevenlabs.py relecture/textes.json elevenlabs [--langs=fr,en]
(par défaut FR et EN : l'arabe attend la relecture de sa traduction ; --langs=fr,en,ar pour l'ajouter).
À qui il s'adresse : la personne qui génère les voix dans ElevenLabs.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_xlsx import NAMES  # noqa: E402
from tags_v3 import apply as apply_tags  # noqa: E402

VOICES = {'fr': 'Lucie ou Noé (voir la vidéo)', 'en': 'Mark · voice_id WTUK291rZZ9CLPCiFTfh', 'ar': 'Hamida (Professional and Positive)'}
# Voix française par vidéo (décision du 27 septembre 2026) : alternance Lucie / Noé.
FR_VOICE = {
    'reel-01-manifeste': ('Lucie · Narration', 'LFtQZWdaqmvamcTNGpwl'),
    'reel-02-une-seule-verite': ('Noé · Content Creator', '7pDdnNI6PhXmAp0pXFZm'),
    'reel-03-avant-apres': ('Lucie · Narration', 'LFtQZWdaqmvamcTNGpwl'),
    'reel-04-agents-ia': ('Noé · Content Creator', '7pDdnNI6PhXmAp0pXFZm'),
    'reel-05-depart-tardif': ('Lucie · Narration', 'LFtQZWdaqmvamcTNGpwl'),
    'reel-07-tour-produit': ('Noé · Content Creator', '7pDdnNI6PhXmAp0pXFZm'),
    'reel-08-23h40': ('Lucie · Narration', 'LFtQZWdaqmvamcTNGpwl'),
    'reel-09-clim-en-panne': ('Noé · Content Creator', '7pDdnNI6PhXmAp0pXFZm'),
    'reel-10-apres-le-depart': ('Lucie · Narration', 'LFtQZWdaqmvamcTNGpwl'),
    'reel-11-fiches-de-police': ('Noé · Content Creator', '7pDdnNI6PhXmAp0pXFZm'),
    'reel-12-deux-nuits-de-plus': ('Lucie · Narration', 'LFtQZWdaqmvamcTNGpwl'),
    'reel-13-direct-sans-risque': ('Noé · Content Creator', '7pDdnNI6PhXmAp0pXFZm'),
    'reel-14-proprietaire-inquiet': ('Lucie · Narration', 'LFtQZWdaqmvamcTNGpwl'),
    'reel-15-cartes-de-la-journee': ('Noé · Content Creator', '7pDdnNI6PhXmAp0pXFZm'),
    # Série prestataires (29/09) : voix du film de lancement, en Eleven v4 (Stabilité 0,3).
    'reel-16-votre-savoir-faire': ('Paul K · French Ad & Trailer (Eleven v4)', 'ecxPjiGTvAfpGEams6ec'),
    'reel-17-la-mission-cote-prestataire': ('Paul K · French Ad & Trailer (Eleven v4)', 'ecxPjiGTvAfpGEams6ec'),
    'reel-18-six-familles-de-metiers': ('Paul K · French Ad & Trailer (Eleven v4)', 'ecxPjiGTvAfpGEams6ec'),
}
LANG_NAME = {'fr': 'FRANÇAIS', 'en': 'ANGLAIS', 'ar': 'ARABE'}
BIG = '#' * 78
MID = '=' * 78
START = '▼▼▼ DÉBUT DU TEXTE À COLLER DANS ELEVENLABS ▼▼▼'
END = '▲▲▲ FIN DU TEXTE À COLLER ▲▲▲'

HEAD = """BAITLY · VOIX OFF DES VIDÉOS · FICHIER À UTILISER AVEC ELEVENLABS
Version du 27 septembre 2026

{big}
LISEZ-MOI
{big}

1. CE QUE CONTIENT CE FICHIER
   Les scripts de voix off des vidéos en {langs_label}, séparés par vidéo puis par langue.
{later}
   Pour chaque vidéo et chaque langue, le texte à dire est encadré par deux repères :
       {start}
       …texte…
       {end}
   Copier UNIQUEMENT ce qui se trouve entre les deux repères. Tout le reste (titres, consignes,
   repères) ne doit pas être collé : ElevenLabs le lirait à voix haute.
   Dans chaque bloc, un paragraphe = une réplique : paragraphe 1 = b1, paragraphe 2 = b2, etc.

2. VOIX ET RÉGLAGES (documentation ElevenLabs « Prompting Eleven v3 »)
   Modèle     : Eleven v3 (model_id eleven_v3), le seul qui interprète les balises [ … ]
{voices}   Stabilité  : Natural (0,5). Creative (0) est plus expressif mais invente parfois (mots
                ajoutés, balises lues à voix haute) ; Robust (1) ignore en partie les balises.
   Langue     : forcer la langue du bloc (fr, en) plutôt que la détection automatique.
   Vitesse    : 1,0 (défaut). Le rythme se règle par le texte et les balises, pas par la vitesse.
   Pauses     : v3 ne prend PAS les balises SSML <break>. Les pauses viennent des « … », de la
                balise [pause] et des sauts de ligne entre répliques.
   Sortie     : mp3 44,1 kHz 192 kb/s (ou WAV 44,1 kHz) ; le mixage final normalise le volume.

3. ÉCRITURES VOULUES, À NE PAS CORRIGER
   « Bètli » (FR), « Betly » (EN) : la marque est écrite comme elle se prononce.
   « bètli point F R » / « betly dot F R » : l'adresse baitly.fr.
   « I.A. » (FR), « A.I. » (EN) : épelé.
   « … » : une pause voulue à l'intérieur de la réplique.
{arabic}
   BALISES v3 (entre crochets, en anglais : ce sont des indications de jeu, jamais lues)
     [softly]  plus doux, chaleureux        [slowly] / [deliberate]  posé, détaché
     [curious] question sincère             [sighs]  soupir complice
     [whispers] presque chuchoté            [rushed] qui s'accélère (énumérations)
     [excited] un peu d'élan                [mischievously] sourire malicieux
     [worried] petite inquiétude            [pause]  vraie pause
     [stress on next word] appuie le mot suivant
     [warmly], [proudly] : balises expérimentales, à valider au premier essai.
   Si une balise est lue à voix haute, régénérer ; si elle l'est encore, la retirer de la réplique.

4. COMMENT GÉNÉRER
   A. Bloc entier d'un coup (recommandé pour la fluidité) : coller tout le bloc. Même voix, même
      élan d'une réplique à l'autre ; v3 est plus régulier sur un texte long (plus de 250 signes)
      que sur une phrase isolée. Nommer le fichier _prise-complete-<langue>.mp3
      (exemple : _prise-complete-fr.mp3). Le découpage en b1, b2… est fait ensuite.
   B. Réplique par réplique : seulement pour refaire une réplique ratée. La nommer selon sa place
      dans le bloc : b1.mp3, b2.mp3…

5. OÙ DÉPOSER LES FICHIERS
   Le dossier de dépôt est indiqué au-dessus de chaque bloc.
   Formats acceptés : mp3, wav, m4a.

6. DURÉES
   Chaque réplique a une durée maximale (fichier VOIX-OFF.md de chaque vidéo). Si une réplique sort
   trop longue, la régénérer un peu plus vite plutôt que d'accélérer le fichier.

7. SOMMAIRE
{toc}
"""


def build(data, outdir, include=('fr', 'en')):
    os.makedirs(outdir, exist_ok=True)
    toc, blocks = [], []
    scripts, warnings = {}, []
    warn = warnings.append
    for reel in data:
        name, pitch = NAMES[reel['dir']]
        langs = [lg for lg in include if lg in reel['langs'] and any(v.get(lg) for v in reel['voice'])]
        if not langs:
            continue
        done = ''
        toc.append(f"   {name} — {' · '.join(LANG_NAME[l].capitalize() for l in langs)}{done}")
        blocks += ['', '', BIG, f"{name.upper()} — {pitch}", f"Durée de la vidéo : {reel['duration']} s{done}", BIG]
        for lg in langs:
            lines = [apply_tags(reel['dir'], v['id'], lg, v[lg].strip(), warn) for v in reel['voice'] if v.get(lg)]
            scripts.setdefault(reel['dir'], {})[lg] = [{'id': v['id'], 'text': t} for v, t in zip([v for v in reel['voice'] if v.get(lg)], lines)]
            blocks += [
                '', MID,
                f"{name.upper()} · {LANG_NAME[lg]}",
                f"Voix : {(FR_VOICE[reel['dir']][0] + ' · voice_id ' + FR_VOICE[reel['dir']][1]) if lg == 'fr' else VOICES[lg]} · {len(lines)} répliques (b1 à b{len(lines)})",
                f"Déposer dans : marketing/motion/{reel['dir']}/vo/{lg}/",
                MID, '', START, '',
                '\n\n'.join(lines),
                '', END,
            ]
    names = {'fr': 'français', 'en': 'anglais', 'ar': 'arabe'}
    voices = ''.join(f"   {names[lg].capitalize():<11}: {VOICES[lg]}\n" for lg in include)
    later = '' if 'ar' in include else ("   L'ARABE N'EST PAS DANS CE FICHIER : sa traduction est en cours de relecture ; les voix arabes\n"
                                         "   (dont le Reel 06 « Arabie saoudite », en arabe uniquement) seront générées plus tard.\n")
    arabic = ('   « بيتلي » / « بيتلي دوت إف آر » (AR) ; arabe vocalisé (tashkil) pour guider la prononciation.\n' if 'ar' in include else '')
    text = HEAD.format(big=BIG, start=START, end=END, toc='\n'.join(toc), voices=voices, later=later, arabic=arabic,
                       langs_label=' et '.join(names[lg] for lg in include)) + '\n'.join(blocks) + '\n'
    path = os.path.join(outdir, 'baitly-voix-off-elevenlabs.txt')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    with open(os.path.join(outdir, 'scripts-v3.json'), 'w', encoding='utf-8') as f:
        json.dump({'model_id': 'eleven_v3', 'stability': 0.5,
                   'voices': {'fr': {k: v[1] for k, v in FR_VOICE.items()}, 'en': 'WTUK291rZZ9CLPCiFTfh'},
                   'reels': scripts}, f, ensure_ascii=False, indent=1)
    for w in warnings:
        print('ATTENTION ' + w)
    print('Fichier : ' + path)


if __name__ == '__main__':
    opt = next((a for a in sys.argv[3:] if a.startswith('--langs=')), '--langs=fr,en')
    build(json.load(open(sys.argv[1], encoding='utf-8')), sys.argv[2], tuple(opt.split('=', 1)[1].split(',')))
