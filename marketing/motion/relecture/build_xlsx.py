"""Baitly · Relecture des textes des Reels : classeur Excel pour les traducteurs.

À quoi sert ce fichier : transforme le JSON produit par extract-texts.mjs en un classeur .xlsx
(un onglet « Lisez-moi » + un onglet par vidéo), avec les textes FR / EN / AR côte à côte et des
colonnes à remplir par les traducteurs (statut, proposition, commentaire).
Utilisation : python3 relecture/build_xlsx.py relecture/textes.json relecture/textes-reels-a-relire.xlsx
À qui il s'adresse : marketing (préparer la relecture), traducteurs (via le fichier produit).
"""
import json
import sys

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

NAMES = {
    'reel-01-manifeste': ('Reel 01 · Manifeste', 'Manifeste de la marque : de l’accueil aux coulisses'),
    'reel-02-une-seule-verite': ('Reel 02 · Une seule vérité', 'Channel manager : une réservation ferme les dates partout'),
    'reel-03-avant-apres': ('Reel 03 · Avant-après', 'Une journée d’hôte, sans et avec Baitly (écran scindé)'),
    'reel-04-agents-ia': ('Reel 04 · Agents IA', 'Les agents IA proposent, l’hôte décide'),
    'reel-05-depart-tardif': ('Reel 05 · Départ tardif', 'Le livret vend un départ tardif pendant que l’hôte dort'),
    'reel-06-arabie-saoudite': ('Reel 06 · Arabie saoudite', 'Conformité et localisation saoudiennes (arabe uniquement)'),
    'reel-07-tour-produit': ('Reel 07 · Tour produit', 'Baitly en 75 secondes (vidéo d’explication 16:9)'),
    'reel-08-23h40': ('Reel 08 · 23 h 40', 'Tapage nocturne : capteur de bruit, avertissement WhatsApp, blocage en cas de récidive'),
    'reel-09-clim-en-panne': ('Reel 09 · La clim en panne', 'Incident pendant le séjour : geste avant l’avis, réponse d’avis rédigée par l’IA'),
    'reel-10-apres-le-depart': ('Reel 10 · Après le départ', 'Contrôle du ménage, caution retenue sur un dégât, prestataire payé, linge commandé'),
    'reel-11-fiches-de-police': ('Reel 11 · Les fiches de police', 'Une obligation par pays : Maroc, France, Arabie saoudite, puis taxes et RGPD'),
    'reel-12-deux-nuits-de-plus': ('Reel 12 · Deux nuits de plus', 'Prolongation chiffrée, acceptée par le voyageur, tout suit'),
    'reel-13-direct-sans-risque': ('Reel 13 · Le direct, sans les risques', 'Panier abandonné relancé, réservation suspecte bloquée, litige bancaire documenté'),
    'reel-14-proprietaire-inquiet': ('Reel 14 · Le propriétaire inquiet', 'Note de revenus envoyée avant la question, relevé et reversement'),
    'reel-15-cartes-de-la-journee': ('Reel 15 · Les cartes de la journée', 'Une journée d’hôte, carte après carte'),
    'reel-16-votre-savoir-faire': ('Reel 16 · Votre savoir-faire', 'Invitation des prestataires : métiers, réseau, profil, mission'),
    'reel-17-la-mission-cote-prestataire': ('Reel 17 · La mission, côté prestataire', 'Consignes, checklist, photos et validation dans le téléphone du prestataire'),
    'reel-18-six-familles-de-metiers': ('Reel 18 · Six familles de métiers', 'Les six familles de services du réseau prestataires'),
}

INK = '1B2A35'
TERRE = '9A6C3A'
HEAD_FILL = PatternFill('solid', fgColor='25406E')
SECTION_FILL = PatternFill('solid', fgColor='F4EBDC')
TODO_FILL = PatternFill('solid', fgColor='FFFBEA')
THIN = Side(style='thin', color='D5DEE7')
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical='top')
WRAP_RTL = Alignment(wrap_text=True, vertical='top', horizontal='right', readingOrder=2)

COLUMNS = [
    ('ID', 9), ('Élément', 14), ('Contexte (où, quand, contrainte)', 42),
    ('Français', 46), ('English', 46), ('العربية', 46),
    ('Statut', 13), ('Proposition FR', 40), ('Proposal EN', 40), ('اقتراح AR', 40), ('Commentaire', 34),
]
LANG_COL = {'fr': 4, 'en': 5, 'ar': 6}

README = [
    ('Objet', 'Relire les textes des 7 vidéos motion design Baitly (réseaux sociaux et vidéo d’explication) : voix off, sous-titres et textes à l’écran, en français, anglais et arabe. Valider chaque ligne ou proposer une meilleure formulation.'),
    ('Ce qu’il faut remplir', 'Pour chaque ligne de votre langue : colonne « Statut » (OK / À modifier / Question), puis votre proposition dans la colonne de votre langue (Proposition FR, Proposal EN ou اقتراح AR) et, si besoin, un commentaire. Ne pas modifier les colonnes Français / English / العربية : ce sont les textes actuels.'),
    ('1 · Voix off : la durée compte', 'Chaque réplique doit tenir dans sa fenêtre de temps (colonne Contexte). Une proposition plus longue n’est utilisable que si elle se dit dans la fenêtre à un débit naturel. Les « … » marquent une pause voulue.'),
    ('2 · Orthographe phonétique voulue', 'Dans les voix off, la marque est écrite comme elle se prononce, pour le générateur de voix : « Bètli » (FR), « Betly » (EN), « بيتلي » (AR) ; l’adresse s’écrit « bètli point F R », « betly dot F R », « بيتلي دوت إف آر ». Ne pas corriger en « Baitly ». À l’écran, la marque s’écrit « Baitly » (latin) et « بيتلي » (arabe).'),
    ('3 · Arabe', 'Arabe standard moderne, naturel pour le Golfe et le Maghreb. Les voix off sont vocalisées (tashkil) pour aider le générateur de voix ; à l’écran, pas de vocalisation. Chiffres occidentaux (0-9), comme sur la landing. Lecture de droite à gauche.'),
    ('4 · Sous-titres', 'Deux lignes au maximum. La partie entre [crochets] s’affiche en couleur (mise en valeur) : garder un segment équivalent dans la proposition. Ils résument la voix off, ils n’ont pas à la reprendre mot pour mot.'),
    ('5 · Textes à l’écran', 'Ce sont des maquettes d’interface (boutons, onglets, cartes). La place est comptée : rester à ±20 % de la longueur actuelle, surtout pour les boutons et onglets. Dans les titres, les mots entre [crochets] sont en couleur.'),
    ('6 · À ne pas changer', 'Chiffres, montants et devises (MAD, SAR, ر.س), dates, noms des marques (Airbnb, Booking.com, Gathern, PayTabs, Stripe…), noms fictifs de logements et de voyageurs (une translittération arabe peut être proposée). Ne pas ajouter de promesse chiffrée ou de garantie absente du texte actuel.'),
    ('7 · Reel 06', 'Vidéo en arabe uniquement (marché saoudien). La colonne Français des voix off est une traduction de travail, pour comprendre le sens : elle n’est pas enregistrée. Le planning apparaît d’abord en anglais, volontairement, avant de basculer en arabe.'),
    ('Légende « Élément »', 'Voix off = texte lu par la voix · Sous-titre = texte incrusté en bas de l’image, synchronisé avec la voix · Écran = texte visible dans l’animation (titre, bouton, maquette).'),
]


def style_header(ws, row):
    for i, (label, width) in enumerate(COLUMNS, start=1):
        c = ws.cell(row=row, column=i, value=label)
        c.font = Font(bold=True, color='FFFFFF')
        c.fill = HEAD_FILL
        c.alignment = Alignment(wrap_text=True, vertical='center', horizontal='right' if label == 'العربية' or label == 'اقتراح AR' else 'left', readingOrder=2 if 'ع' in label or 'ا' in label else 0)
        c.border = BORDER
        ws.column_dimensions[c.column_letter].width = width


def section(ws, row, label):
    ws.cell(row=row, column=1, value=label).font = Font(bold=True, color=TERRE, size=12)
    for col in range(1, len(COLUMNS) + 1):
        ws.cell(row=row, column=col).fill = SECTION_FILL
    return row + 1


def write_row(ws, row, rid, kind, context, texts, dv):
    values = [rid, kind, context, texts.get('fr', ''), texts.get('en', ''), texts.get('ar', '')]
    for col, v in enumerate(values, start=1):
        c = ws.cell(row=row, column=col, value=v)
        c.alignment = WRAP_RTL if col == 6 else WRAP
        c.border = BORDER
        if col in (1, 2, 3):
            c.font = Font(color='4D5A64', size=10)
    for col in range(7, len(COLUMNS) + 1):
        c = ws.cell(row=row, column=col)
        c.fill = TODO_FILL
        c.border = BORDER
        c.alignment = WRAP_RTL if col == 10 else WRAP
    dv.add(ws.cell(row=row, column=7))
    longest = max((len(str(v or '')) for v in values[3:6]), default=0)
    ws.row_dimensions[row].height = max(30, min(150, 15 * (1 + longest // 44)))
    return row + 1


def build(data, out):
    wb = Workbook()
    ws = wb.active
    ws.title = 'Lisez-moi'
    ws.column_dimensions['A'].width = 30
    ws.column_dimensions['B'].width = 120
    ws['A1'] = 'Baitly · Textes des vidéos à relire (FR · EN · AR)'
    ws['A1'].font = Font(bold=True, size=16, color=INK)
    ws['A2'] = 'Version du 27 septembre 2026 · généré depuis les fichiers sources des vidéos (marketing/motion).'
    ws['A2'].font = Font(italic=True, color='67757C')
    r = 4
    for k, v in README:
        ws.cell(row=r, column=1, value=k).font = Font(bold=True, color=INK)
        c = ws.cell(row=r, column=2, value=v)
        c.alignment = WRAP
        ws.cell(row=r, column=1).alignment = WRAP
        ws.row_dimensions[r].height = max(30, 15 * (1 + len(v) // 115))
        r += 1
    r += 1
    ws.cell(row=r, column=1, value='Vidéos').font = Font(bold=True, size=13, color=TERRE)
    r += 1
    for reel in data:
        name, pitch = NAMES[reel['dir']]
        ws.cell(row=r, column=1, value=name).font = Font(bold=True)
        ws.cell(row=r, column=2, value=f"{pitch} · {reel['fmt']} · {reel['duration']} s · langues : {' · '.join(l.upper() for l in reel['langs'])} · "
                 f"{len(reel['voice'])} répliques de voix off, {len(reel['subs'])} sous-titres, {len(reel['screen'])} textes à l’écran")
        r += 1

    for reel in data:
        name, pitch = NAMES[reel['dir']]
        ws = wb.create_sheet(name[:31])
        ws['A1'] = f'{name} — {pitch}'
        ws['A1'].font = Font(bold=True, size=14, color=INK)
        ws['A2'] = f"Format {reel['fmt']} · {reel['duration']} s · langues : {' · '.join(l.upper() for l in reel['langs'])}"
        ws['A2'].font = Font(italic=True, color='67757C')
        style_header(ws, 4)
        ws.freeze_panes = 'D5'
        dv = DataValidation(type='list', formula1='"OK,À modifier,Question"', allow_blank=True)
        ws.add_data_validation(dv)
        row = 5
        row = section(ws, row, '1 · Voix off (texte lu, dans l’ordre)')
        for v in reel['voice']:
            targets = ' · '.join(f"{lg.upper()} {v[lg + 'Target']}" for lg in ('fr', 'en', 'ar') if v.get(lg + 'Target'))
            tone = v.get('frTone') or v.get('arTone') or ''
            ctx = f"Fenêtre : {v['window']}\nDurée visée : {targets}\nImage : {v['scene']}\nTon : {tone}"
            row = write_row(ws, row, v['id'], 'Voix off', ctx, v, dv)
        row = section(ws, row + 1, '2 · Sous-titres (incrustés en bas, [ ] = mis en couleur)')
        for s in reel['subs']:
            row = write_row(ws, row, s['id'], 'Sous-titre', f"Affiché de {s['timing']} · 2 lignes maximum", s, dv)
        row = section(ws, row + 1, '3 · Textes à l’écran (titres, boutons, maquettes)')
        for i, s in enumerate(reel['screen'], start=1):
            row = write_row(ws, row, f'E{i}', 'Écran', f"{s['context']}\n(clé : {s['key']})", s, dv)
    wb.save(out)


if __name__ == '__main__':
    build(json.load(open(sys.argv[1], encoding='utf-8')), sys.argv[2])
    print('Classeur : ' + sys.argv[2])
