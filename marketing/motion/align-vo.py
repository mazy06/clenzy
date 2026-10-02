"""Baitly · Calage d'une voix off générée en une prise sur l'animation d'un Reel.

À quoi sert ce fichier : à partir de la prise complète d'une langue (vo/<langue>/_prise-complete-*.mp3,
toutes les répliques dites d'un seul passage), il
  1. découpe les répliques au silence (b1.wav, b2.wav…), en resserrant les pauses internes trop
     longues (au-delà de MAX_PAUSE) pour garder une diction fluide et dynamique ;
  2. cale chaque réplique au début de sa scène (départs par défaut de timeline.js), ou juste après
     la réplique précédente si celle-ci déborde : pas de blanc inutile, pas de chevauchement
     (reels de FOLLOW : la réplique enchaîne après une courte respiration et les plans suivent) ;
  3. recale les moments synchronisés (clics, brique qui se pose, logo…) sur les mots réellement dits
     (position estimée au prorata des caractères dans la réplique) → timeline.js, lang.<langue> ;
  4. réécrit les sous-titres de la langue à partir du texte dit (écriture d'affichage : « Baitly »,
     « 23 h 14 »…), en morceaux de deux lignes au plus, calés sur la voix → i18n.js.
Utilisation : python3 align-vo.py reel-02-une-seule-verite fr
Prérequis : ffmpeg ; elevenlabs/scripts-v3.json (textes balisés, voir relecture/build_elevenlabs.py).
À qui il s'adresse : la personne qui intègre les voix (marketing / développeur).
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MAX_PAUSE = 0.5          # une pause interne plus longue est ramenée à cette durée
EDGE = 0.04              # marge gardée en tête et en queue de réplique
GAP = 0.15               # écart minimal entre deux répliques
TEMPO_MAX = 1.08         # accélération maximale (sans changer la hauteur) d'une réplique qui déborde
SUB_MAX = 66             # longueur maximale d'un sous-titre (deux lignes à 44 px sur 860 px)

# Moments synchronisés : (réplique, mot déclencheur, décalage en s). Le mot (un par langue) est
# cherché dans le texte dit ; le moment tombe au début du mot (+ décalage).
def W(fr, en):
    return {'fr': fr, 'en': en}


BAITLY = W('Bètli', 'Betly')
SYNC = {
    'reel-01-manifeste': {
        'click': ('b5', W('validez', 'approve'), -0.1), 'promise2': ('b6', W('Pas', 'Not'), 0.0),
    },
    'reel-02-une-seule-verite': {
        'drop': ('b5', W('arrive', 'lands'), 0.0), 'close': ('b5', W('ferment', 'close'), 0.0),
        'offline': ('b6', W('répond', 'stops'), 0.0), 'end': ('b7', BAITLY, 0.1),
    },
    'reel-03-avant-apres': {
        'nt': [('b2', W('voyageur', 'guest'), 0.0), ('b2', W('autre', 'another'), 0.0), ('b2', W('troisième', 'third'), 0.0)],
        'send': ('b2', W('e-mail', 'email'), -0.6), 'extend': ('b3', W('décaler', 'move'), 0.0),
        'approve': ('b4', W('combien', 'how much'), -0.6), 'welcome': ('b5', W("l'autre", 'the other'), 0.0),
        'merge': ('b6', BAITLY, -0.2), 'end': ('b7', BAITLY, 0.0),
    },
    'reel-04-agents-ia': {
        'hl': [('b2', W('prix', 'rates'), 0.0), ('b2', W('messages', 'messages'), 0.0), ('b2', W('ménage', 'housekeeping'), 0.0),
               ('b2', W('paiements', 'payments'), 0.0), ('b2', W('conformité', 'compliance'), 0.0)],
        'propose': ('b3', W('proposent', 'propose it'), 0.0), 'adjust': ('b4', W('ajustez', 'adjust'), 0.0),
        'approve': ('b4', W('approuvez', 'approve'), 0.0), 'toggles': ('b5', W('automatique', 'auto'), 0.0),
        'end': ('b7', BAITLY, 0.0),
    },
    'reel-05-depart-tardif': {
        'tapBook': ('b4', W('réserve', 'book'), 0.0), 'tapPay': ('b4', W('paie', 'pay'), 0.0),
        'extend': ('b5', W("s'allonge", 'stretches'), 0.0),
    },
    'reel-08-23h40': {
        'loud': ('b1', W('musique', 'music'), 0.0), 'neigh': ('b1', W('voisins', 'neighbours'), 0.0),
        'send': ('b2', W("d'avertir", 'warning'), 0.5), 'reply': ('b3', W('Deux minutes', 'Two minutes'), 0.0),
        'calm': ('b3', W('redescend', 'drops'), 0.0), 'block': ('b4', W('bloquer', 'blocking'), 0.4),
        'end': ('b6', BAITLY, 0.0),
    },
    'reel-09-clim-en-panne': {
        'broken': ('b1', W('lâcher', 'gave out'), 0.0), 'fixed': ('b2', W('deux heures', 'two hours'), 0.3),
        'refund': ('b3', W('quinze', 'fifteen'), 0.2), 'draft': ('b4', W('rédige', 'drafts'), 0.0),
        'insert': ('b4', W('relisez', 'read it'), 0.0), 'edit': ('b4', W('changez', 'change'), 0.2),
        'publish': ('b4', W('publiez', 'publish'), 0.0), 'end': ('b6', BAITLY, 0.0),
    },
    'reel-10-apres-le-depart': {
        'approve': ('b2', W('valider', 'approving'), 0.0), 'flag': ('b2', W('dégât', 'damage'), 0.0),
        'withhold': ('b3', W('retenir', 'withholding'), 0.4), 'pay': ('b4', W('débloque', 'releases'), 0.2),
        'order': ('b4', W('commande', 'order'), 0.2), 'end': ('b6', BAITLY, 0.0),
    },
    'reel-11-fiches-de-police': {
        'send': ('b2', W('avant même', 'before they even'), 0.6), 'ma': ('b3', W('Maroc', 'Morocco'), 0.3),
        'fr': ('b3', W('En France', 'In France'), 0.0), 'sa': ('b3', W('Arabie', 'Saudi'), 0.0),
        'tax': ('b4', W('taxe', 'tourist tax'), 0.0), 'zatca': ('b4', W('ZATCA', 'ZATCA'), 0.0),
        'ntmp': ('b4', W('NTMP', 'NTMP'), 0.0), 'gdpr': ('b4', W('RGPD', 'GDPR'), 0.0),
        'filed': ('b4', W('réservation', 'booking'), 0.3), 'end': ('b6', BAITLY, 0.0),
    },
    'reel-12-deux-nuits-de-plus': {
        'msg': ('b1', W('adore', 'loving'), 0.0), 'send': ('b2', W('chiffré', 'priced'), 0.6),
        'accept': ('b3', W('accepte', 'accepts'), 0.0), 'extend': ('b4', W("s'allonge", 'stretches'), 0.0),
        'clean': ('b4', W('ménage', 'cleaning'), 0.0), 'code': ('b4', W('code', 'access code'), 0.0),
        'end': ('b6', BAITLY, 0.0),
    },
    'reel-13-direct-sans-risque': {
        'leave': ('b1', W("s'arrête", 'stops'), 0.2), 'send': ('b2', W('relancer', 'following up'), 0.5),
        'back': ('b2', W('revient', 'comes back'), 0.0), 'block': ('b3', W('bloquez', 'block'), 0.0),
        'submit': ('b4', W('livret', 'the guide'), 0.4), 'end': ('b6', BAITLY, 0.0),
    },
    'reel-14-proprietaire-inquiet': {
        'ring': ('b1', W('appel', 'call'), 0.0), 'send': ('b2', W('relisez', 'read it'), 0.2),
        'dl': ('b3', W('explication', 'explanation'), 0.3), 'reply': ('b3', W('relevé', 'statement'), 0.0),
        'approve': ('b4', W('clic', 'click'), -0.3), 'end': ('b6', BAITLY, 0.0),
    },
    'reel-15-cartes-de-la-journee': {
        'k1': ('b2', W('libérée', 'released'), 0.0), 'k2': ('b2', W('prête', 'ready'), 0.0),
        'k3': ('b3', W('contrôlé', 'checked'), 0.0), 'k4': ('b3', W('accordé', 'granted'), 0.0),
        'thermo': ('b4', W('thermostat', 'thermostat'), 0.0), 'k5': ('b4', W('relevé', 'statement'), 0.3),
        'k6': ('b5', W('avertissement', 'noise warning'), 0.0), 'rest': ('b5', W('entre deux cartes', 'between two cards'), 0.0),
        'trust': ('b6', W("l'automatiser", 'automate'), 0.2), 'auto1': ('b6', W('ménage', 'Cleaning'), 0.0),
        'auto2': ('b6', W('caution', 'deposits'), 0.0), 'lock': ('b6', W('remboursements', 'refunds'), 0.0),
        'end': ('b8', BAITLY, 0.0),
    },
    # Baitly Académie (épisodes de formation, 9:16 et 16:9 depuis le même dossier).
    'academie-01-kpi': {
        'q2': ('b1', W('mais', 'but'), 0.0), 'three': ('b1', W('Trois chiffres', 'Three numbers'), 0.0),
        'f1n': ('b2', W('nuits vendues', 'nights sold'), 0.0), 'f1d': ('b2', W('nuits disponibles', 'available'), 0.0),
        'f1x': ('b3', W('vous en vendez', 'you sell'), 0.0), 'f1r': ('b3', W('soixante-treize', 'seventy-three'), 0.0),
        'trap1': ('b4', W('Attention', 'Watch out'), 0.0), 'blk': ('b4', W('Cinq nuits', 'Five nights'), 0.0),
        'f1b': ('b4', W('quatre-vingt-huit', 'eighty-eight'), 0.0),
        'f2n': ('b5', W("chiffre d'affaires", 'revenue'), 0.0), 'f2d': ('b5', W('nuits vendues', 'nights sold'), 0.0),
        'f2x': ('b6', W('deux mille', 'two thousand'), 0.0), 'f2r': ('b6', W('cent vingt', 'hundred and twenty'), 0.0),
        'trap2': ('b7', W('Deuxième piège', 'Second trap'), 0.0), 'fee1': ('b7', W('trois cent trente', 'three hundred and thirty'), 0.0),
        'fee2': ('b7', W('cent dix', 'hundred and ten'), 0.0), 'wrong': ('b7', W('cent quarante', 'hundred and forty'), 0.0),
        'diff': ('b7', W('vingt euros de trop', 'twenty euros too much'), 0.0),
        'f3n': ('b8', W('même chiffre', 'same revenue'), 0.0), 'f3d': ('b8', W('toutes les nuits', 'every night'), 0.0),
        'empty': ('b8', W('nuits vides', 'empty nights'), 0.0),
        'f3x': ('b9', W('Deux mille', 'Two thousand'), 0.0), 'f3r': ('b9', W('quatre-vingt-huit', 'eighty-eight'), 0.0),
        'id': ('b9', W('occupation multipliée', 'occupancy times'), 0.0),
        'why': ('b10', W('nuit vide', 'empty night'), 0.0), 'unite': ('b10', W('réunit', 'combines'), 0.0),
        'sA': ('b11', W('bradez', 'slash'), 0.0), 'sAn': ('b11', W('Vingt-sept', 'Twenty-seven'), 0.0), 'sAr': ('b11', W('RevPAR de', 'RevPAR of'), 0.0),
        'sB': ('b12', W('cent soixante', 'hundred and sixty'), 0.0), 'sBn': ('b12', W('Douze', 'Twelve'), 0.0),
        'sBr': ('b12', W('soixante-quatre', 'sixty-four'), 0.0), 'sC': ('b12', W('prix juste', 'right price'), 0.0),
        'sCn': ('b12', W('Vingt-deux', 'Twenty-two'), 0.0), 'sCr': ('b12', W('meilleur', 'best'), 0.0),
        'm1': ('b13', W('Occupation haute', 'High occupancy'), 0.0), 'm2': ('b13', W('Occupation basse', 'Low occupancy'), 0.0),
        'm3': ('b14', W('Occupation basse', 'Low occupancy'), 0.0), 'm4': ('b14', W('deux sont hauts', 'both are high'), 0.0),
        'season': ('b15', W('juin à juin', 'June to June'), 0.0),
        'k1': ('b16', W("l'occupation", 'occupancy'), 0.0), 'k2': ('b16', W('prix moyen', 'average rate'), 0.0), 'k3': ('b16', W('RevPAR', 'RevPAR'), 0.0),
        'app': ('b16', W('Dans', 'In'), 0.0), 'end': ('b17', BAITLY, 0.0),
    },
    # Académie 02 (anglais à venir, les mots EN sont provisoires).
    'academie-02-revenu-net': {
        'q2': ('b1', W('mais', 'but'), 0.0), 'follow': ('b1', W('Suivons', "Let's follow"), 0.0),
        'p1': ('b2', W('six cents', 'six hundred'), 0.0), 'p2': ('b2', W('Soixante euros', 'Sixty euros'), 0.0), 'p3': ('b2', W('dix euros', 'ten euros'), 0.0),
        'tax': ('b3', W('ne vous appartient', 'is not yours'), 0.0), 'r660': ('b3', W('six cent soixante', 'six hundred and sixty'), 0.0),
        'com': ('b4', W('quinze pour cent', 'fifteen percent'), 0.0), 'com2': ('b4', W('quatre-vingt-dix-neuf', 'ninety-nine'), 0.0), 'pay': ('b4', W('versement', 'payout'), 0.0),
        'trap1': ('b5', W('Attention', 'Watch out'), 0.0), 'clean0': ('b5', W('nettoyé', 'cleaned'), 0.0),
        'c1': ('b6', W('ménage', 'cleaning'), 0.0), 'c2': ('b6', W('linge', 'linen'), 0.0), 'c3': ('b6', W('consommables', 'supplies'), 0.0),
        'net': ('b7', W('quatre cent soixante-huit', 'four hundred and sixty-eight'), 0.0), 'aff': ('b7', W('affichiez', 'listed'), 0.0), 'keep': ('b7', W('gardez', 'keep'), 0.0),
        'trap2': ('b8', W('Deuxième piège', 'Second trap'), 0.0), 'f60': ('b8', W('Soixante euros', 'Sixty euros'), 0.0),
        'f70': ('b8', W('soixante-dix', 'seventy'), 0.0), 'f10': ('b8', W('dix euros par', 'ten euros per'), 0.0),
        'm4': ('b9', W('Quatre séjours', 'Four stays'), 0.0), 'm1872': ('b9', W('mille huit cent', 'one thousand eight hundred'), 0.0),
        'fixed': ('b9', W('charges fixes', 'fixed costs'), 0.0), 'f450': ('b9', W('quatre cent cinquante', 'four hundred and fifty'), 0.0),
        'mnet': ('b10', W('mille quatre cent', 'one thousand four hundred'), 0.0), 'half': ('b10', W('moitié', 'half'), 0.0),
        'a1': ('b11', W('suivez', 'track'), 0.0), 'a2': ('b11', W('prix plancher', 'floor price'), 0.0), 'a3': ('b11', W('comparez vos canaux', 'compare your channels'), 0.0),
        'k0': ('b12', W('prix payé', 'price paid'), 0.0), 'k1': ('b12', W('taxe', 'tax'), 0.0), 'k2': ('b12', W('commission', 'commission'), 0.0),
        'k3': ('b12', W('coûts', 'costs'), 0.0), 'k4': ('b12', W('charges', 'charges'), 0.0), 'app': ('b12', W('Dans', 'In'), 0.0),
        'end': ('b13', BAITLY, 0.0),
    },
    # Académie 18 (anglais à venir, les mots EN sont provisoires).
    'academie-18-direct-ou-plateforme': {
        'q2': ('b1', W('vous ne gardez', "you don't keep"), 0.0), 'calc': ('b1', W('Faisons', "Let's"), 0.0),
        's660': ('b2', W('six cent soixante', 'six hundred and sixty'), 0.0), 'com': ('b2', W('quinze pour cent', 'fifteen percent'), 0.0),
        'com2': ('b2', W('quatre-vingt-dix-neuf', 'ninety-nine'), 0.0), 'rest1': ('b2', W('cinq cent soixante et un', 'five hundred and sixty-one'), 0.0),
        'dir': ('b3', W('En direct', 'Direct'), 0.0), 'fee': ('b3', W('un virgule cinq', 'one point five'), 0.0),
        'fee2': ('b3', W('dix euros quinze', 'ten fifteen'), 0.0), 'rest2': ('b3', W('six cent quarante-neuf', 'six hundred and forty-nine'), 0.0),
        'gap': ('b4', W('quatre-vingt-huit', 'eighty-eight'), 0.0), 'year': ('b4', W('vingt séjours', 'twenty stays'), 0.0), 'y1800': ('b4', W('mille huit cents', 'eighteen hundred'), 0.0),
        'why': ('b5', W('pourquoi', 'why'), 0.0), 'o1': ('b5', W('voyageurs', 'guests'), 0.0), 'o2': ('b5', W('paiement', 'payment'), 0.0),
        'o3': ('b5', W('avis', 'reviews'), 0.0), 'o4': ('b5', W('service client', 'support'), 0.0),
        'd1': ('b6', W('un site', 'a website'), 0.0), 'd2': ('b6', W('photos', 'photos'), 0.0), 'd3': ('b6', W('publicité', 'ads'), 0.0), 'd4': ('b6', W('temps', 'time'), 0.0),
        'q': ('b7', W('combien vous coûte', 'how much'), 0.0), 'th': ('b7', W('quatre-vingt-huit', 'eighty-eight'), 0.0),
        'ad': ('b7', W('Trente euros', 'Thirty euros'), 0.0), 'keep': ('b7', W('cinquante-huit', 'fifty-eight'), 0.0),
        'st1': ('b8', W('plateforme pour', 'platform to'), 0.0), 'st2': ('b8', W('le direct pour', 'direct to'), 0.0), 'st3': ('b8', W('revenir chez vous', 'come back'), 0.0),
        'disc': ('b9', W('cinq pour cent', 'five percent'), 0.0), 'g593': ('b9', W('cinquante-neuf', 'fifty-nine'), 0.0),
        'rule': ('b10', W('Une règle', 'One rule'), 0.0), 'ban': ('b10', W("ne l'invitez", 'never invite'), 0.0), 'find': ('b10', W('facile à trouver', 'easy to find'), 0.0),
        'f1': ('b10', W('un site', 'a website'), 0.0), 'f2': ('b10', W('fiche Google', 'Google'), 0.0), 'f3': ('b10', W('bouche', 'word of mouth'), 0.0),
        'bal': ('b11', W('équilibre', 'balance'), 0.0), 'fill': ('b11', W('remplir', 'fill'), 0.0), 'grow': ('b11', W('faites grandir', 'grow'), 0.0),
        'k1': ('b12', W('comparez', 'compare'), 0.0), 'k2': ('b12', W('Le direct gagne', 'Direct wins'), 0.0),
        'app': ('b12', W('Dans', 'In'), 0.0), 'app2': ('b12', W('assistant', 'assistant'), 0.0),
        'end': ('b13', BAITLY, 0.0),
    },
    # Académie 03 (voix : Lucie) et 04 (voix : Paul K) ; anglais à venir, mots EN provisoires.
    'academie-03-delai-duree': {
        'q2': ('b1', W('Pourtant', 'Yet'), 0.0), 'two': ('b1', W('deux chiffres', 'two numbers'), 0.0),
        'lt': ('b2', W('délai de réservation', 'lead time'), 0.0), 'def': ('b2', W('nombre de jours', 'number of days'), 0.0),
        'ex': ('b3', W('deux mai', 'May 2'), 0.0), 'arr': ('b3', W('seize juin', 'June 16'), 0.0), 'd45': ('b3', W('quarante-cinq jours', 'forty-five days'), 0.0),
        'list': ('b3', W('Sur tout le mois', 'Over the month'), 0.0), 'avg': ('b3', W('En moyenne', 'On average'), 0.0),
        'use': ('b4', W('À quoi', 'What'), 0.0), 'j10': ('b4', W('dix jours', 'ten days'), 0.0), 'act': ('b4', W('agir sur le prix', 'act on price'), 0.0),
        'trap': ('b5', W('Attention', 'Watch out'), 0.0), 'stly': ('b5', W('même mois', 'same month'), 0.0),
        'dms': ('b6', W('durée moyenne', 'average length'), 0.0), 'f': ('b6', W('nuits vendues', 'nights sold'), 0.0),
        'n24': ('b7', W('vingt-quatre nuits', 'twenty-four nights'), 0.0), 'sA': ('b7', W('Le premier', 'The first'), 0.0), 'sB': ('b7', W('Le second', 'The second'), 0.0),
        'work': ('b8', W('pas le même travail', 'not the same work'), 0.0), 'clean': ('b8', W('huit ménages', 'eight cleanings'), 0.0),
        'c560': ('b8', W('cinq cent soixante', 'five hundred and sixty'), 0.0), 'c280': ('b8', W('contre deux cent', 'versus two hundred'), 0.0), 'diff': ('b8', W('écart', 'difference'), 0.0),
        'orph': ('b9', W('nuits orphelines', 'orphan nights'), 0.0), 'min3': ('b9', W('minimum de trois', 'three-night minimum'), 0.0), 'gap': ('b9', W('trou de deux', 'two-night gap'), 0.0),
        'sol': ('b10', W('La solution', 'The fix'), 0.0), 'fill': ('b10', W('Deux nuits à cent vingt', 'Two nights at'), 0.0), 'gain': ('b10', W('deux cent quarante', 'two hundred and forty'), 0.0),
        'a1': ('b11', W('Suivez', 'Track'), 0.0), 'a2': ('b11', W('Réglez', 'Set'), 0.0), 'a3': ('b11', W('comblez', 'fill'), 0.0),
        'k1': ('b12', W('le délai', 'lead time'), 0.0), 'k2': ('b12', W('la durée de séjour', 'length of stay'), 0.0), 'app': ('b12', W('Dans', 'In'), 0.0),
        'end': ('b13', BAITLY, 0.0),
    },
    'academie-04-qualite': {
        'q2': ('b1', W('mais les réservations', 'but bookings'), 0.0), 'i1': ('b1', W('les annulations', 'cancellations'), 0.0),
        'i2': ('b1', W('les avis', 'reviews'), 0.0), 'i3': ('b1', W('temps de réponse', 'response time'), 0.0),
        'can': ('b2', W("taux d'annulation", 'cancellation rate'), 0.0), 'f': ('b2', W('Les réservations annulées', 'Cancelled bookings'), 0.0),
        'ex': ('b2', W('Vingt-cinq', 'Twenty-five'), 0.0), 'r8': ('b2', W('huit pour cent', 'eight percent'), 0.0),
        'guest': ('b3', W('Celle du voyageur', "The guest's"), 0.0), 'policy': ('b3', W('politique', 'policy'), 0.0),
        'host': ('b3', W('Celle que vous faites', 'Yours'), 0.0), 'pen': ('b3', W('pénalisent', 'penalise'), 0.0),
        'cal': ('b4', W('calendrier', 'calendar'), 0.0),
        'rev': ('b5', W('vos avis', 'your reviews'), 0.0), 'note': ('b5', W('La note', 'The rating'), 0.0), 'count': ('b5', W("nombre d'avis", 'number of reviews'), 0.0),
        'a12': ('b6', W('douze avis', 'twelve reviews'), 0.0), 'drop': ('b6', W('quatre virgule trente-deux', 'four point three two'), 0.0),
        'a80': ('b6', W('quatre-vingts avis', 'eighty reviews'), 0.0), 'stable': ('b6', W('quatre virgule soixante-quinze', 'four point seven five'), 0.0),
        'ask': ('b7', W('demandez', 'ask'), 0.0), 'reply': ('b7', W('répondez', 'reply'), 0.0),
        'react': ('b8', W('réactivité', 'responsiveness'), 0.0), 'f24': ('b8', W('vingt-quatre heures', 'twenty-four hours'), 0.0), 'r95': ('b8', W('Trente-huit', 'Thirty-eight'), 0.0),
        'speed': ('b9', W('vitesse', 'speed'), 0.0), 'wait': ('b9', W('attend pas', "won't wait"), 0.0),
        'a1': ('b10', W('réponses types', 'templates'), 0.0), 'a2': ('b10', W('notifications', 'notifications'), 0.0), 'a3': ('b10', W('chaque mois', 'every month'), 0.0),
        'k1': ('b11', W('aucune annulation', 'no cancellation'), 0.0), 'k2': ('b11', W('des avis', 'reviews'), 0.0), 'k3': ('b11', W('des réponses rapides', 'fast replies'), 0.0),
        'app': ('b11', W('Dans', 'In'), 0.0), 'app2': ('b11', W('brouillon', 'draft'), 0.0),
        'end': ('b12', BAITLY, 0.0),
    },
    # Académie 17 (voix : Lucie) et 19 (voix : Noé) ; anglais à venir, mots EN provisoires.
    'academie-17-prix-dynamique': {
        'q2': ('b1', W('tous les jours', 'every day'), 0.0), 'sat': ('b1', W('le samedi', 'on Saturday'), 0.0),
        'tue': ('b1', W('le mardi', 'on Tuesday'), 0.0), 'rules': ('b1', W('trois règles', 'three rules'), 0.0),
        'r1': ('b2', W('Règle numéro un', 'Rule one'), 0.0), 'calc': ('b2', W('calculez', 'work out'), 0.0),
        'ch': ('b3', W('Vos charges', 'Your costs'), 0.0), 'c25': ('b3', W('vingt-cinq euros', 'twenty-five'), 0.0),
        'men': ('b3', W('Le ménage', 'Cleaning'), 0.0), 'c20': ('b3', W('vingt euros par nuit', 'twenty euros a night'), 0.0),
        'c45': ('b3', W('quarante-cinq euros', 'forty-five'), 0.0),
        'trap1': ('b4', W('Attention', 'Watch out'), 0.0), 'com': ('b4', W('quinze pour cent', 'fifteen percent'), 0.0),
        'show53': ('b4', W('afficher', 'list'), 0.0), 'floor': ('b4', W('Votre plancher', 'Your floor'), 0.0), 'loss': ('b4', W('perdez', 'lose'), 0.0),
        'r2': ('b5', W('Règle numéro deux', 'Rule two'), 0.0), 'up': ('b5', W('elle monte', 'it rises'), 0.0),
        'wk': ('b6', W('Cent euros', 'A hundred'), 0.0), 'w120': ('b6', W('cent vingt', 'hundred and twenty'), 0.0),
        'p20': ('b6', W('plus vingt pour cent', 'plus twenty'), 0.0), 'cond': ('b6', W('Si ces nuits', 'If those nights'), 0.0),
        'w160': ('b6', W('cent soixante', 'hundred and sixty'), 0.0),
        'how': ('b7', W('Comment savoir', 'How do you'), 0.0), 'cheap': ('b7', W('trop bon marché', 'too cheap'), 0.0),
        'ev': ('b7', W('Même logique', 'Same logic'), 0.0), 'e1': ('b7', W('vacances', 'holidays'), 0.0),
        'e2': ('b7', W('un salon', 'a trade fair'), 0.0), 'e3': ('b7', W('un festival', 'a festival'), 0.0), 'e4': ('b7', W('un match', 'a match'), 0.0),
        'r3': ('b8', W('Règle numéro trois', 'Rule three'), 0.0), 'zero': ('b8', W('ne rapporte rien', 'earns nothing'), 0.0),
        'j7': ('b9', W('sept jours', 'seven days'), 0.0), 'p90': ('b9', W('quatre-vingt-dix', 'ninety'), 0.0),
        'j3': ('b9', W('trois jours', 'three days'), 0.0), 'p80': ('b9', W('quatre-vingts euros', 'eighty'), 0.0),
        'fl': ('b9', W('jamais sous', 'never below'), 0.0),
        'trap2': ('b10', W('Le piège', 'The trap'), 0.0), 'wait': ('b10', W('attendre', 'wait'), 0.0),
        'g1': ('b11', W('Un prix sous', 'A price below'), 0.0), 'a1': ('b11', W('Je remonte', 'Raise it'), 0.0),
        'g2': ('b11', W('Mes week-ends', 'My weekends'), 0.0), 'a2': ('b11', W("J'augmente", 'Increase'), 0.0),
        'g3': ('b11', W('Une nuit libre', 'A free night'), 0.0), 'a3': ('b11', W('Je baisse', 'Lower'), 0.0),
        'k1': ('b12', W('un plancher', 'a floor'), 0.0), 'k2': ('b12', W('des week-ends', 'weekends'), 0.0),
        'k3': ('b12', W('une dernière minute', 'last minute'), 0.0), 'app': ('b12', W('Dans', 'In'), 0.0),
        'app2': ('b12', W('ajustements', 'adjustments'), 0.0),
        'end': ('b13', BAITLY, 0.0),
    },
    'academie-19-extras': {
        'q2': ('b1', W("mais il n'a pas", "but they're not"), 0.0), 'x1': ('b1', W('Une arrivée plus tôt', 'An earlier'), 0.0),
        'x2': ('b1', W('un départ plus tard', 'a later'), 0.0), 'x3': ('b1', W('un transfert', 'a transfer'), 0.0), 'x4': ('b1', W('une activité', 'an activity'), 0.0),
        'own': ('b2', W('Premier type', 'First kind'), 0.0), 's1': ('b2', W('une arrivée anticipée', 'early check-in'), 0.0),
        's2': ('b2', W('un départ tardif', 'late check-out'), 0.0), 's3': ('b2', W('un ménage', 'cleaning'), 0.0),
        's4': ('b2', W('un panier', 'breakfast'), 0.0), 's5': ('b2', W('un transfert', 'transfer'), 0.0),
        'calc': ('b3', W('Faisons le calcul', "Let's do"), 0.0), 'p35': ('b3', W('trente-cinq euros', 'thirty-five'), 0.0),
        'one5': ('b3', W('un voyageur sur cinq', 'one guest in five'), 0.0), 'v20': ('b3', W('vingt séjours', 'twenty stays'), 0.0),
        'v4': ('b3', W('quatre ventes', 'four sales'), 0.0), 'v140': ('b3', W('cent quarante', 'hundred and forty'), 0.0),
        'nonight': ('b3', W('sans une seule nuit', 'without'), 0.0),
        'trap1': ('b4', W('Le piège', 'The trap'), 0.0), 'clash': ('b4', W("le jour d'", 'on the day'), 0.0),
        'cond': ('b4', W('fixez vos conditions', 'set your rules'), 0.0), 'c1': ('b4', W('selon disponibilité', 'availability'), 0.0),
        'c2': ('b4', W('un délai', 'notice'), 0.0), 'c3': ('b4', W('un nombre de nuits', 'minimum nights'), 0.0),
        'act': ('b5', W('Deuxième type', 'Second kind'), 0.0), 'gyg': ('b5', W('Get Your Guide', 'GetYourGuide'), 0.0),
        'via': ('b5', W('Viator', 'Viator'), 0.0), 'klk': ('b5', W('Klouk', 'Klook'), 0.0), 'k1000': ('b5', W('des milliers', 'thousands'), 0.0),
        'connect': ('b6', W('vous connectez', 'connect'), 0.0), 'livret': ('b6', W('livret', 'guidebook'), 0.0),
        'a1': ('b6', W('Une montgolfière', 'A balloon'), 0.0), 'a2': ('b6', W('un atelier', 'a cooking'), 0.0),
        'a3': ('b6', W('une soirée', 'an evening'), 0.0), 'comm': ('b6', W('commission', 'commission'), 0.0),
        'ex': ('b7', W('Exemple', 'Example'), 0.0), 'e130': ('b7', W('cent trente', 'hundred and thirty'), 0.0),
        'e8': ('b7', W('huit pour cent', 'eight percent'), 0.0), 'e1040': ('b7', W('dix euros quarante', 'ten forty'), 0.0),
        'pays': ('b7', W('Le voyageur paie', 'The guest pays'), 0.0),
        'custom': ('b8', W('Troisième type', 'Third kind'), 0.0), 'm1': ('b8', W('Un cours de surf', 'A surf'), 0.0),
        'm2': ('b8', W('un massage', 'a massage'), 0.0), 'm3': ('b8', W('des vélos', 'bikes'), 0.0), 'm4': ('b8', W('un dîner', 'a dinner'), 0.0),
        'create': ('b8', W('créez votre extra', 'create'), 0.0),
        'pack': ('b9', W('composez des packs', 'bundles'), 0.0), 'arr': ('b9', W('Arrivée anticipée', 'Early check-in'), 0.0),
        'pdj': ('b9', W('panier', 'breakfast'), 0.0), 'sum': ('b9', W('trente plus', 'thirty plus'), 0.0),
        'p55': ('b9', W('cinquante-cinq', 'fifty-five'), 0.0), 'p50': ('b9', W('proposés ensemble', 'together'), 0.0),
        'win': ('b9', W('Le voyageur économise', 'The guest saves'), 0.0),
        't1': ('b10', W('À la réservation', 'At booking'), 0.0), 't2': ('b10', W('Quelques jours avant', 'A few days'), 0.0),
        't3': ('b10', W('Pendant le séjour', 'During'), 0.0), 'simple': ('b10', W('une photo', 'a photo'), 0.0),
        'k1': ('b11', W('vos services', 'your services'), 0.0), 'k2': ('b11', W('les activités', 'activities'), 0.0),
        'k3': ('b11', W('vos extras sur mesure', 'custom extras'), 0.0), 'app': ('b11', W('Dans', 'In'), 0.0),
        'pay': ('b11', W('Straïpe', 'Stripe'), 0.0),
        'end': ('b12', BAITLY, 0.0),
    },
    'academie-13-menage-rotation': {
        'dep': ('b1', W('Onze heures', 'Eleven'), 0.0), 'arr': ('b1', W('Seize heures', 'Four'), 0.0),
        'gap': ('b1', W('cinq heures', 'five hours'), 0.0), 'q2': ('b1', W("C'est le ménage", "That's"), 0.0),
        'win': ('b2', W('Départ à', 'Check-out'), 0.0), 'win5': ('b2', W('un créneau de cinq', 'a five-hour'), 0.0),
        'calc': ('b3', W('Faisons le compte', "Let's count"), 0.0), 'tr': ('b3', W('Le trajet', 'Travel'), 0.0),
        'men': ('b3', W('Le ménage', 'Cleaning'), 0.0), 'lin': ('b3', W('Le linge', 'Linen'), 0.0),
        'tot': ('b3', W('Total', 'Total'), 0.0), 'marge': ('b3', W('Il reste', 'That leaves'), 0.0),
        'trap1': ('b4', W('Le piège', 'The trap'), 0.0), 'late': ('b4', W('midi et demi', 'twelve thirty'), 0.0),
        'left': ('b4', W('il ne reste que', 'only'), 0.0), 'm30': ('b4', W('votre marge tombe', 'your margin'), 0.0),
        'fix': ('b4', W('fixez', 'set'), 0.0), 'tard': ('b4', W("n'accordez", 'only grant'), 0.0),
        'steps': ('b5', W('Deuxième notion', 'Second'), 0.0), 'hb': ('b5', W('du haut', 'top'), 0.0),
        'fs': ('b5', W('du fond', 'back'), 0.0), 'clean': ('b5', W('on ne salit', 'never'), 0.0),
        'st1': ('b6', W('Un :', 'One:'), 0.0), 'st2': ('b6', W('Deux :', 'Two:'), 0.0), 'st3': ('b6', W('Trois :', 'Three:'), 0.0),
        'st4': ('b7', W('Quatre :', 'Four:'), 0.0), 'st5': ('b7', W('Cinq :', 'Five:'), 0.0),
        'trap2': ('b8', W('Le piège', 'The trap'), 0.0), 'towel': ('b8', W('une serviette', 'a towel'), 0.0),
        'fridge': ('b8', W('un frigo', 'a fridge'), 0.0), 'check': ('b8', W('Avec une checklist', 'With a written'), 0.0),
        'same': ('b8', W('tout le monde', 'everyone'), 0.0),
        'photos': ('b9', W('Troisième notion', 'Third'), 0.0), 'ph1': ('b9', W('Une photo par pièce', 'One photo'), 0.0),
        'proof': ('b9', W('la preuve', 'proof'), 0.0),
        'ex': ('b10', W('Exemple', 'Example'), 0.0), 'sofa': ('b10', W('La photo de fin', 'The final photo'), 0.0),
        'other': ('b10', W("Et dans l'autre sens", 'And the other way'), 0.0), 'glass': ('b10', W('un verre cassé', 'a broken glass'), 0.0),
        'dep2': ('b10', W('dépôt de garantie', 'deposit'), 0.0),
        'num': ('b11', W('Mettons des chiffres', 'Put numbers'), 0.0), 'c50': ('b11', W('Un ménage coûte', 'A cleaning costs'), 0.0),
        'redo': ('b11', W('cinquante euros de plus', 'fifty more'), 0.0), 'g30': ('b11', W('trente euros', 'thirty'), 0.0),
        'l80': ('b11', W('Quatre-vingts', 'Eighty'), 0.0), 'avis': ('b11', W('sans compter', 'not counting'), 0.0),
        'ctrl': ('b11', W('Le contrôle final', 'The final check'), 0.0),
        'k1': ('b12', W('un créneau', 'a window'), 0.0), 'k2': ('b12', W('cinq étapes', 'five steps'), 0.0),
        'k3': ('b12', W('une checklist écrite', 'a written'), 0.0), 'k4': ('b12', W('des photos à chaque', 'photos every'), 0.0),
        'app': ('b12', W('Dans', 'In'), 0.0), 'pay': ('b12', W('Son paiement', 'Their payment'), 0.0),
        'end': ('b13', BAITLY, 0.0),
    },
    'academie-14-questions-voyageurs': {
        'wifi': ('b1', W('Quel est', 'What'), 0.0), 'seven': ('b1', W('les mêmes sept', 'the same seven'), 0.0),
        'q2': ('b1', W('Voyons', "Let's see"), 0.0),
        'cost': ('b2', W("D'abord", 'First'), 0.0), 'msg': ('b2', W('un message à lire', 'a message'), 0.0),
        'rep': ('b2', W('une réponse à écrire', 'a reply'), 0.0), 'bad': ('b2', W('en plein ménage', 'mid-cleaning'), 0.0),
        'night': ('b2', W('tard le soir', 'late at night'), 0.0),
        'calc': ('b3', W('Faisons le calcul', "Let's do"), 0.0), 'v20': ('b3', W('Vingt séjours', 'Twenty stays'), 0.0),
        'v3': ('b3', W('trois questions', 'three questions'), 0.0), 'v5': ('b3', W('cinq minutes', 'five minutes'), 0.0),
        'v300': ('b3', W('trois cents', 'three hundred'), 0.0), 'v5h': ('b3', W('Cinq heures', 'Five hours'), 0.0),
        'list': ('b4', W('Voici les sept', 'Here are'), 0.0), 'n1': ('b4', W('un, comment', 'one, how'), 0.0),
        'n2': ('b4', W('Deux,', 'Two,'), 0.0), 'n3': ('b4', W('Trois,', 'Three,'), 0.0),
        'n4': ('b5', W('quatre,', 'four,'), 0.0), 'n5': ('b5', W('Cinq,', 'Five,'), 0.0), 'n6': ('b5', W('Six,', 'Six,'), 0.0),
        'n7': ('b5', W('sept,', 'seven,'), 0.0),
        'trap1': ('b6', W('Le piège', 'The trap'), 0.0), 'nobody': ('b6', W('Personne', 'Nobody'), 0.0),
        'short': ('b6', W('Il faut', 'You need'), 0.0), 'exq': ('b6', W('Par exemple', 'For example'), 0.0),
        'onep': ('b6', W('Une phrase', 'One sentence'), 0.0),
        'moment': ('b7', W('Deuxième notion', 'Second'), 0.0), 't1': ('b7', W('Quelques jours', 'A few days'), 0.0),
        't2': ('b7', W('Pendant le séjour', 'During'), 0.0), 't3': ('b7', W('La veille', 'The day before'), 0.0),
        'code': ('b8', W('Et le code', 'And the door'), 0.0), 'week': ('b8', W('Un code envoyé', 'A code sent'), 0.0),
        'early': ('b8', W('entrer avant', 'get in early'), 0.0), 'dday': ('b8', W('Le code, c', 'The code'), 0.0),
        'prat': ('b9', W('Mise en pratique', 'In practice'), 0.0), 'm100': ('b9', W('tombent à cent', 'drop to'), 0.0),
        'h140': ('b9', W('une heure quarante', 'one hour forty'), 0.0), 'rest': ('b9', W('Et les messages', 'And the messages'), 0.0),
        'r1': ('b9', W('une panne', 'a breakdown'), 0.0), 'r2': ('b9', W('un imprévu', 'a surprise'), 0.0), 'r3': ('b9', W('une demande', 'a request'), 0.0),
        'k1': ('b10', W('sept questions', 'seven questions'), 0.0), 'k2': ('b10', W('une réponse courte', 'a short answer'), 0.0),
        'k3': ('b10', W('au bon moment', 'right time'), 0.0), 'k4': ('b10', W("et le code d'accès", 'and the door code'), 0.0),
        'app': ('b10', W('Dans', 'In'), 0.0), 'lock': ('b10', W("y reste masqué", 'stays hidden'), 0.0),
        'bot': ('b10', W('un assistant', 'an assistant'), 0.0),
        'end': ('b11', BAITLY, 0.0),
    },
    'academie-15-avis-negatif': {
        'stars': ('b1', W('Deux étoiles', 'Two stars'), 0.0), 'quote': ('b1', W('Salle de bain', 'Bathroom'), 0.0),
        'reflex': ('b1', W('Votre premier réflexe', 'Your first'), 0.0), 'bad': ('b1', W('Mauvaise idée', 'Bad idea'), 0.0),
        'readers': ('b1', W("c'est à tous ceux", 'everyone'), 0.0), 'q2': ('b1', W('Voyons', "Let's see"), 0.0),
        'pub': ('b2', W('Votre réponse reste', 'Your reply stays'), 0.0), 'fut': ('b2', W('Le futur voyageur', 'The future guest'), 0.0),
        'judge': ('b2', W('il juge votre façon', 'they judge how'), 0.0),
        'trap1': ('b3', W('Le piège', 'The trap'), 0.0), 'hot': ('b3', W("C'est faux", "That's false"), 0.0),
        'fight': ('b3', W('le lecteur ne voit', 'the reader'), 0.0), 'wait': ('b3', W('Laissez passer', 'Let'), 0.0),
        'calm': ('b3', W('répondez calmement', 'reply calmly'), 0.0),
        'four': ('b4', W('Deuxième notion', 'Second'), 0.0), 's1': ('b4', W('Un :', 'One:'), 0.0),
        's2': ('b5', W('Deux :', 'Two:'), 0.0), 's3': ('b6', W('Trois :', 'Three:'), 0.0), 's4': ('b6', W('Quatre :', 'Four:'), 0.0),
        'trap2': ('b7', W('Le piège', 'The trap'), 0.0), 'copy': ('b7', W('copiée', 'copied'), 0.0),
        'gift': ('b7', W('Et le geste', 'And the gesture'), 0.0), 'priv': ('b7', W('en message privé', 'private'), 0.0),
        'cost': ('b8', W('Troisième notion', 'Third'), 0.0), 'r20': ('b8', W('Vingt avis', 'Twenty reviews'), 0.0),
        'r2': ('b8', W('Un avis à deux', 'One two-star'), 0.0), 'r467': ('b8', W('tombe à', 'drops'), 0.0),
        'back': ('b8', W('Pour revenir', 'To get back'), 0.0), 'r14': ('b8', W('Quatorze', 'Fourteen'), 0.0),
        'note': ('b9', W('Votre réponse ne changera', "Your reply won't"), 0.0), 'hesit': ('b9', W('Mais elle change', 'But it changes'), 0.0),
        'fix': ('b9', W("Et l'avis", 'And the review'), 0.0),
        'prat': ('b10', W('Mise en pratique', 'In practice'), 0.0), 'w40': ('b10', W('quatre phrases', 'four sentences'), 0.0),
        'm1': ('b10', W('Merci, le point', 'Thanks'), 0.0), 'm2': ('b10', W('le point précis', 'the precise'), 0.0),
        'm3': ('b10', W("l'action", 'the action'), 0.0), 'm4': ('b10', W('une note positive', 'a positive'), 0.0),
        'reread': ('b10', W('Relisez', 'Reread'), 0.0),
        'k1': ('b11', W('vous répondez pour', 'you reply for'), 0.0), 'k2': ('b11', W('à froid', 'calmly'), 0.0),
        'k3': ('b11', W('le geste se règle', 'the gesture'), 0.0), 'app': ('b11', W('Dans', 'In'), 0.0),
        'draft': ('b11', W('un brouillon', 'a draft'), 0.0), 'valid': ('b11', W("Rien n'est publié", 'Nothing'), 0.0),
        'end': ('b12', BAITLY, 0.0),
    },
    'academie-12-assurance': {
        'water': ('b1', W('Dégât des eaux', 'Water damage'), 0.0), 'leave': ('b1', W('Votre voyageur doit partir', 'Your guest'), 0.0),
        'cancel': ('b1', W('vos trois réservations', 'your next three'), 0.0), 'who': ('b1', W('Qui paie', 'Who pays'), 0.0),
        'q2': ('b1', W('Voyons', "Let's see"), 0.0),
        'home': ('b2', W('Une assurance habitation', 'Home insurance'), 0.0), 'live': ('b2', W('pour y vivre', 'to live'), 0.0),
        'guests': ('b2', W('pas pour accueillir', 'not to host'), 0.0), 'ask': ('b2', W('ne supposez rien', "don't assume"), 0.0),
        'write': ('b2', W('gardez sa réponse', 'keep'), 0.0),
        'n1': ('b3', W('Première question', 'First question'), 0.0), 'each': ('b3', W('Si vous louez', 'If you rent'), 0.0),
        'n2': ('b4', W('Deux :', 'Two:'), 0.0), 'n3': ('b4', W('Trois :', 'Three:'), 0.0), 'n4': ('b4', W('Quatre :', 'Four:'), 0.0),
        'n5': ('b5', W('Cinq :', 'Five:'), 0.0), 'n6': ('b5', W('Six :', 'Six:'), 0.0),
        'trap1': ('b6', W('Le piège', 'The trap'), 0.0), 'some': ('b6', W('Certaines', 'Some'), 0.0),
        'only': ('b6', W('elle ne vaut que', 'only'), 0.0), 'direct': ('b6', W('Vos réservations directes', 'Your direct'), 0.0),
        'nums': ('b7', W('Deuxième notion', 'Second'), 0.0), 'rep': ('b7', W('Trois mille', 'Three thousand'), 0.0),
        'lost': ('b7', W('neuf cents euros', 'nine hundred'), 0.0), 'fr': ('b7', W('Avec une franchise', 'With a'), 0.0),
        'rest': ('b7', W('il vous reste', 'you pay'), 0.0), 'without': ('b7', W('Sans cette garantie', 'Without'), 0.0),
        'total': ('b7', W('mille deux cents', 'twelve hundred'), 0.0),
        'proofs': ('b8', W('Troisième notion', 'Third'), 0.0), 'p1': ('b8', W("l'état du logement", 'the state'), 0.0),
        'p2': ('b8', W('les photos des dégâts', 'photos of the damage'), 0.0), 'p3': ('b8', W('vos échanges', 'your messages'), 0.0),
        'word': ('b8', W('Sans photos', 'Without photos'), 0.0),
        'prat': ('b9', W('Mise en pratique', 'In practice'), 0.0), 'each2': ('b9', W('logement par logement', 'property by property'), 0.0),
        'file': ('b9', W('classez', 'file'), 0.0), 'hour': ('b9', W('Une heure', 'One hour'), 0.0),
        'k1': ('b10', W('ne supposez rien', "don't assume"), 0.0), 'k2': ('b10', W('posez les six', 'ask the six'), 0.0),
        'k3': ('b10', W('faites couvrir', 'get cover'), 0.0), 'k4': ('b10', W('gardez vos preuves', 'keep your proof'), 0.0),
        'app': ('b10', W('Dans', 'In'), 0.0), 'inc': ('b10', W('chaque incident', 'every incident'), 0.0),
        'end': ('b11', BAITLY, 0.0),
    },
    'academie-20-gestion-proprietaire': {
        'owner': ('b1', W('Un propriétaire', 'An owner'), 0.0), 'how': ('b1', W('combien je touche', 'how much'), 0.0),
        'why': ('b1', W('et pourquoi', 'and why'), 0.0), 'clear': ('b1', W('Gérer pour', 'Managing'), 0.0),
        'p1': ('b1', W('le mandat', 'the agreement'), 0.0), 'p2': ('b1', W('le reversement', 'the payout'), 0.0), 'p3': ('b1', W('et le relevé', 'and the statement'), 0.0),
        'mand': ('b2', W('Première pièce', 'First'), 0.0), 'm1': ('b2', W('ce que vous faites', 'what you do'), 0.0),
        'm2': ('b2', W('combien vous prenez', 'how much'), 0.0), 'm3': ('b2', W('sur quelle base', 'on what basis'), 0.0),
        'm4': ('b2', W('comment on se sépare', 'how to part'), 0.0),
        'base': ('b3', W('La base', 'The basis'), 0.0), 'v2000': ('b3', W('deux mille', 'two thousand'), 0.0),
        'v300': ('b3', W('dont trois cents', 'including'), 0.0), 'gross': ('b3', W('sur le brut', 'on gross'), 0.0),
        'net': ('b3', W('sur le net', 'on net'), 0.0), 'gap': ('b3', W('Soixante', 'Sixty'), 0.0),
        'trap1': ('b4', W('Le piège', 'The trap'), 0.0), 'vague': ('b4', W('Vingt pour cent des revenus', 'Twenty percent'), 0.0),
        'who': ('b4', W('Et les frais', 'And the fees'), 0.0), 'write': ('b4', W('Écrivez', 'Write'), 0.0),
        'rev': ('b5', W('Deuxième pièce', 'Second'), 0.0), 'minus1': ('b5', W('moins les frais', 'minus fees'), 0.0),
        'minus2': ('b5', W('moins votre commission', 'minus your'), 0.0), 'minus3': ('b5', W('moins les dépenses', 'minus the'), 0.0),
        'again': ('b6', W('Reprenons', "Let's"), 0.0), 'r2000': ('b6', W('deux mille euros de revenus', 'two thousand'), 0.0),
        'r300': ('b6', W('moins trois cents', 'minus three hundred'), 0.0), 'r340': ('b6', W('moins trois cent quarante', 'minus three forty'), 0.0),
        'r160': ('b6', W('moins cent soixante', 'minus one sixty'), 0.0), 'r1200': ('b6', W('Il reste', 'That leaves'), 0.0),
        'trap2': ('b7', W('Le piège', 'The trap'), 0.0), 'apart': ('b7', W('gardez-les à part', 'keep it apart'), 0.0),
        'fixed': ('b7', W('reversez à date fixe', 'pay on a fixed'), 0.0),
        'stmt': ('b8', W('Troisième pièce', 'Third'), 0.0), 'detail': ('b8', W('séjour par séjour', 'stay by stay'), 0.0),
        'same': ('b8', W('Les mêmes chiffres', 'The same figures'), 0.0),
        'calm': ('b9', W('Un relevé clair', 'A clear'), 0.0), 'trust': ('b9', W('et un propriétaire', 'and an owner'), 0.0),
        'prat': ('b10', W('Mise en pratique', 'In practice'), 0.0), 'c1': ('b10', W('La base de la commission', 'The commission basis'), 0.0),
        'c2': ('b10', W('Qui paie', 'Who pays'), 0.0), 'c3': ('b10', W('La date du reversement', 'The payout date'), 0.0),
        'c4': ('b10', W('Le relevé mensuel', 'The monthly'), 0.0), 'c5': ('b10', W('Et les règles', 'And the rules'), 0.0),
        'card': ('b10', W('une carte professionnelle', 'a licence'), 0.0),
        'k1': ('b11', W('un mandat précis', 'a precise'), 0.0), 'k2': ('b11', W('un reversement calculé', 'a payout'), 0.0),
        'k3': ('b11', W('un relevé chaque mois', 'a statement'), 0.0), 'app': ('b11', W('Dans', 'In'), 0.0),
        'sign': ('b11', W('le mandat se signe', 'the agreement'), 0.0), 'base2': ('b11', W('chaque contrat fixe', 'each contract'), 0.0),
        'valid': ('b11', W('le reversement part', 'the payout goes'), 0.0), 'auto': ('b11', W('et le relevé mensuel', 'and the monthly'), 0.0),
        'end': ('b12', BAITLY, 0.0),
    },
    'academie-11-securite': {
        'det': ('b1', W('Un détecteur', 'A smoke'), 0.0), 'fire': ('b1', W('Un incendie', 'A fire'), 0.0),
        'q2': ('b1', W('La sécurité', 'Safety'), 0.0), 'o': ('b1', W("l'obligatoire", 'the mandatory'), 0.0),
        'r': ('b1', W('le recommandé', 'the recommended'), 0.0), 'v': ('b1', W("et ce qu", 'and what'), 0.0),
        'oblig': ('b2', W('Première notion', 'First'), 0.0), 'smoke': ('b2', W('au moins un détecteur', 'at least one'), 0.0),
        'ce': ('b2', W('marqué', 'marked'), 0.0), 'owner': ('b2', W('En location saisonnière', 'In holiday'), 0.0),
        'pool': ('b3', W('Vous avez une piscine', 'Got a pool'), 0.0), 'd1': ('b3', W('une barrière', 'a fence'), 0.0),
        'd2': ('b3', W('une alarme', 'an alarm'), 0.0), 'd3': ('b3', W('une couverture', 'a cover'), 0.0), 'd4': ('b3', W('ou un abri', 'or a shelter'), 0.0),
        'before': ('b3', W('installé avant', 'installed before'), 0.0), 'fine': ('b3', W('Sans lui', 'Without'), 0.0),
        'trap1': ('b4', W('Le piège', 'The trap'), 0.0), 'ma': ('b4', W('Au Maroc', 'In Morocco'), 0.0),
        'city': ('b4', W('parfois chaque ville', 'sometimes each city'), 0.0), 'check': ('b4', W('Vérifiez-les', 'Check'), 0.0),
        'reco': ('b5', W('Deuxième notion', 'Second'), 0.0), 'co': ('b5', W('Un détecteur de monoxyde', 'A carbon'), 0.0),
        'ext': ('b5', W('Un extincteur', 'An extinguisher'), 0.0), 'kit': ('b5', W('Une trousse', 'A first-aid'), 0.0),
        'torch': ('b5', W('une lampe', 'a torch'), 0.0),
        'cons': ('b6', W('Troisième notion', 'Third'), 0.0), 'w1': ('b6', W("où est l'extincteur", 'where the'), 0.0),
        'w2': ('b6', W('comment couper', 'how to cut'), 0.0), 'w3': ('b6', W('quel numéro', 'which number'), 0.0),
        'e112': ('b6', W('En Europe', 'In Europe'), 0.0), 'mine': ('b6', W('Et votre numéro', 'And your number'), 0.0),
        'prat': ('b7', W('Mise en pratique', 'In practice'), 0.0), 't1': ('b7', W('Appuyer', 'Press'), 0.0),
        't2': ('b7', W("Voir l'extincteur", 'See the'), 0.0), 't3': ('b7', W('Compléter', 'Refill'), 0.0), 's30': ('b7', W('Trente secondes', 'Thirty'), 0.0),
        'note': ('b8', W('Et notez tout', 'And log'), 0.0), 'n1': ('b8', W("la date d'achat", 'the purchase'), 0.0),
        'n2': ('b8', W('le contrôle', 'the check'), 0.0), 'n3': ('b8', W('le remplacement', 'the replacement'), 0.0),
        'proof': ('b8', W("Le jour d", 'The day'), 0.0),
        'k1': ('b9', W("l'obligatoire d'abord", 'the mandatory'), 0.0), 'k2': ('b9', W('le recommandé ensuite', 'the recommended'), 0.0),
        'k3': ('b9', W('des consignes claires', 'clear'), 0.0), 'k4': ('b9', W('et trois vérifications', 'and three'), 0.0),
        'app': ('b9', W('Dans', 'In'), 0.0), 'notes': ('b9', W('chaque logement garde', 'each property'), 0.0),
        'end': ('b10', BAITLY, 0.0),
    },
    # Série prestataires (16-18) : anglais à venir, les mots EN sont provisoires.
    'reel-16-votre-savoir-faire': {
        'm': [('b1', W('Ménage', 'Cleaning'), 0.0), ('b1', W('dépannage', 'repairs'), 0.0), ('b1', W('linge', 'linen'), 0.0),
              ('b1', W('jardin', 'garden'), 0.0), ('b1', W('accueil', 'check-in'), 0.0)],
        'stay': ('b1', W('chaque séjour', 'every stay'), 0.0), 'guests': ('b2', W('voyageurs', 'guests'), 0.0),
        'f1': ('b3', W('métier', 'trade'), 0.0), 'f2': ('b3', W('zone', 'area'), 0.0), 'f3': ('b3', W('informations', 'details'), 0.0),
        'r1': ('b4', W('lieu', 'place'), 0.0), 'r2': ('b4', W('consignes', 'instructions'), 0.0), 'r3': ('b4', W('tarif', 'rate'), 0.0),
        'end': ('b6', W('Préparez', 'Set up'), 0.0),
    },
    'reel-17-la-mission-cote-prestataire': {
        'notif': ('b1', W('voyageur', 'guest'), 0.0), 'arrive': ('b1', W('quinze heures', 'three'), 0.0),
        'd1': ('b2', W('adresse', 'address'), 0.0), 'd2': ('b2', W("l'accès", 'access'), 0.0),
        'd3': ('b2', W('consignes', 'instructions'), 0.0), 'd4': ('b2', W('checklist', 'checklist'), 0.0),
        'tick': ('b3', W('cochez', 'tick'), 0.0), 'photo': ('b3', W('photos', 'photos'), 0.0), 'host': ('b3', W("l'hôte", 'host'), 0.0),
        'valid': ('b4', W('valide', 'approves'), 0.0), 'pay': ('b4', W('règlement', 'payment'), 0.0),
        'end': ('b6', W('Préparez', 'Set up'), 0.0),
    },
    'reel-18-six-familles-de-metiers': {
        'c1': ('b2', W('Ménage', 'Cleaning'), 0.0), 'c2': ('b2', W('Maintenance', 'Maintenance'), 0.0), 'c3': ('b2', W('Blanchisserie', 'Laundry'), 0.0),
        'c4': ('b3', W('Jardin', 'Garden'), 0.0), 'c5': ('b3', W('Accueil', 'Welcome'), 0.0), 'c6': ('b3', W('Chef', 'Chef'), 0.0),
        'hosts': ('b4', W('hôtes', 'hosts'), 0.0), 'guests': ('b4', W('voyageurs', 'guests'), 0.0),
        'end': ('b6', W('Préparez', 'Set up'), 0.0),
    },
    'reel-07-tour-produit': {
        'drop': ('b2', W('arrive', 'lands'), 0.0), 'approve': ('b4', W('vous validez', 'you decide'), 0.0),
        'add': ('b5', W('chef', 'chef'), 0.0), 'proof': ('b6', W('preuve', 'proof'), 0.0),
        'statement': ('b7', W('relevés', 'statements'), 0.0),
        'flips': [('b8', W('arabe', 'Arabic'), 0.0), ('b8', W('anglais', 'French'), 0.0)],
    },
}

# Délais minimaux qu'exige l'animation entre deux moments : clé → (moment de référence, écart).
# Une référence égale à la clé = écart entre les éléments successifs d'une liste.
MIN_AFTER = {
    'reel-04-agents-ia': {'approve': ('adjust', 2.9)},     # deux clics « +5 » entre Ajuster et Approuver (marge pour la déformation du temps)
    'reel-05-depart-tardif': {'tapPay': ('tapBook', 1.0)},  # la feuille de paiement doit s'ouvrir
    'reel-07-tour-produit': {'flips': ('flips', 1.6)},      # une bascule de langue dure 1,2 s (+ marge de déformation)
    # la carte doit se lire avant le clic (entrée 0,6 s + ~1,5 s de lecture) ; au Reel 08, la carte
    # « Bloquer » n'entre qu'après l'historique des alertes (1,8 s).
    'reel-08-23h40': {'send': ('slot1', 2.2), 'block': ('slot3', 3.2)},
    # pile de cartes : chaque carte entre 0,75 s après le clic précédent et doit se lire ~1,2 s
    'reel-15-cartes-de-la-journee': {'k1': ('slot1', 1.3), 'k2': ('k1', 1.9), 'k3': ('k2', 1.9), 'k4': ('k3', 1.9), 'thermo': ('k4', 1.5), 'k5': ('thermo', 2.4), 'k6': ('k5', 1.9), 'rest': ('k6', 1.3),
                                     'trust': ('slot5', 2.2), 'auto1': ('trust', 1.2), 'auto2': ('auto1', 1.0), 'lock': ('auto2', 1.0)},
    'reel-14-proprietaire-inquiet': {'send': ('slot1', 2.4), 'dl': ('slot2', 1.4), 'reply': ('dl', 1.2), 'approve': ('slot3', 2.0)},
    'reel-13-direct-sans-risque': {'send': ('slot1', 2.0), 'back': ('send', 1.4), 'block': ('slot2', 2.6), 'submit': ('slot3', 3.0)},
    'reel-12-deux-nuits-de-plus': {'msg': ('slot0', 1.4), 'send': ('slot1', 2.2), 'accept': ('slot2', 1.6), 'clean': ('extend', 0.9), 'code': ('clean', 0.8)},
    'reel-11-fiches-de-police': {'send': ('slot1', 3.0), 'ma': ('slot2', 1.2), 'fr': ('ma', 1.2), 'sa': ('fr', 1.2), 'filed': ('slot3', 2.0)},
    'reel-10-apres-le-depart': {'approve': ('slot1', 2.2), 'flag': ('approve', 1.0), 'withhold': ('slot2', 2.2), 'pay': ('slot3', 2.0), 'order': ('pay', 2.2)},
    'reel-09-clim-en-panne': {'refund': ('slot2', 2.4), 'insert': ('draft', 1.3), 'edit': ('insert', 0.9), 'publish': ('edit', 1.0)},
    # Série prestataires : les profils se lisent avant la bascule voyageurs ; la zone se tape
    # (~0,8 s) avant les informations ; quatre cases cochées (0,45 s chacune) avant les photos.
    'reel-16-votre-savoir-faire': {'m': ('m', 0.3), 'guests': ('slot1', 1.8), 'f1': ('slot2', 0.9), 'f2': ('f1', 0.8), 'f3': ('f2', 1.3),
                                   'r1': ('slot3', 1.2), 'r2': ('r1', 0.7), 'r3': ('r2', 0.7)},
    'reel-17-la-mission-cote-prestataire': {'notif': ('slot0', 0.8), 'd1': ('slot1', 1.0), 'd2': ('d1', 0.6), 'd3': ('d2', 0.6), 'd4': ('d3', 0.6),
                                            'tick': ('slot2', 0.8), 'photo': ('tick', 1.6), 'host': ('photo', 0.6), 'valid': ('slot3', 0.5), 'pay': ('valid', 0.8)},
    'reel-18-six-familles-de-metiers': {'c1': ('slot1', 0.2), 'c4': ('slot2', 0.2), 'hosts': ('slot3', 1.0), 'guests': ('hosts', 0.9)},
    'academie-02-revenu-net': {'p1': ('slot1', 1.0), 'p2': ('p1', .6), 'p3': ('p2', .6), 'r660': ('tax', .8), 'com': ('slot2', 1.0), 'pay': ('com2', .6),
                               'c1': ('slot3', 1.0), 'c2': ('c1', .5), 'c3': ('c2', .5), 'keep': ('aff', .6), 'f70': ('f60', .6), 'f10': ('f70', .6),
                               'm4': ('slot4', .8), 'f450': ('fixed', .5), 'half': ('mnet', .8), 'a1': ('slot5', .8), 'a2': ('a1', .8), 'a3': ('a2', .8),
                               'k1': ('k0', .35), 'k2': ('k1', .35), 'k3': ('k2', .35), 'k4': ('k3', .35), 'app': ('k4', .5)},
    'academie-18-direct-ou-plateforme': {'com': ('slot1', 1.0), 'rest1': ('com2', .6), 'fee2': ('fee', .6), 'rest2': ('fee2', .6), 'y1800': ('year', .6),
                                         'o1': ('slot2', 1.0), 'o2': ('o1', .5), 'o3': ('o2', .5), 'o4': ('o3', .5), 'd2': ('d1', .45), 'd3': ('d2', .45), 'd4': ('d3', .45),
                                         'th': ('slot3', 1.0), 'ad': ('th', .8), 'keep': ('ad', .8), 'st1': ('slot4', .8), 'st2': ('st1', .6), 'st3': ('st2', .6),
                                         'f2': ('f1', .4), 'f3': ('f2', .4), 'fill': ('bal', .5), 'grow': ('fill', .5), 'k2': ('k1', .6), 'app2': ('app', .6)},
    'academie-03-delai-duree': {'def': ('lt', .8), 'arr': ('ex', .5), 'd45': ('arr', .5), 'avg': ('list', 1.2), 'act': ('j10', .6), 'f': ('dms', .7),
                                'sB': ('sA', 1.0), 'c560': ('clean', .6), 'c280': ('c560', .5), 'diff': ('c280', .5), 'gap': ('min3', .5), 'gain': ('fill', .6),
                                'a2': ('a1', .8), 'a3': ('a2', .8), 'k2': ('k1', .6), 'app': ('k2', .6)},
    'academie-04-qualite': {'f': ('can', .6), 'ex': ('f', .8), 'r8': ('ex', .6), 'host': ('guest', .8), 'pen': ('host', .5), 'count': ('note', .6),
                            'drop': ('a12', .8), 'a80': ('drop', .6), 'stable': ('a80', .8), 'reply': ('ask', .6), 'r95': ('f24', .6),
                            'a2': ('a1', .6), 'a3': ('a2', .6), 'k2': ('k1', .5), 'k3': ('k2', .5), 'app': ('k3', .5), 'app2': ('app', .6)},
    'academie-17-prix-dynamique': {'c25': ('ch', .6), 'men': ('c25', .5), 'c20': ('men', .6), 'c45': ('c20', .7), 'show53': ('com', .8), 'floor': ('show53', .8),
                                   'w120': ('wk', .6), 'p20': ('w120', .6), 'cond': ('p20', .6), 'w160': ('cond', .6), 'cheap': ('how', 1.0),
                                   'e2': ('e1', .35), 'e3': ('e2', .35), 'e4': ('e3', .35), 'p90': ('j7', .6), 'j3': ('p90', .6), 'p80': ('j3', .6), 'fl': ('p80', .6),
                                   'a1': ('g1', .6), 'g2': ('a1', .6), 'a2': ('g2', .6), 'g3': ('a2', .6), 'a3': ('g3', .6),
                                   'k2': ('k1', .5), 'k3': ('k2', .5), 'app': ('k3', .5), 'app2': ('app', .6)},
    'academie-13-menage-rotation': {'arr': ('dep', .6), 'gap': ('arr', .5), 'men': ('tr', .5), 'lin': ('men', .5), 'tot': ('lin', .5), 'marge': ('tot', .5),
                                    'left': ('late', .6), 'm30': ('left', .5), 'tard': ('fix', .6), 'fs': ('hb', .5),
                                    'st2': ('st1', .6), 'st3': ('st2', .6), 'st4': ('st3', .6), 'st5': ('st4', .6), 'fridge': ('towel', .5),
                                    'redo': ('c50', .6), 'g30': ('redo', .6), 'l80': ('g30', .6), 'ctrl': ('avis', .6),
                                    'k2': ('k1', .5), 'k3': ('k2', .5), 'k4': ('k3', .5), 'app': ('k4', .5), 'pay': ('app', .6)},
    'academie-14-questions-voyageurs': {'rep': ('msg', .5), 'bad': ('rep', .5), 'night': ('bad', .5), 'v3': ('v20', .5), 'v5': ('v3', .5), 'v300': ('v5', .5), 'v5h': ('v300', .6),
                                        'n2': ('n1', .6), 'n3': ('n2', .6), 'n5': ('n4', .6), 'n6': ('n5', .6), 'n7': ('n6', .6),
                                        't2': ('t1', .8), 't3': ('t2', .8), 'h140': ('m100', .5), 'r2': ('r1', .4), 'r3': ('r2', .4),
                                        'k2': ('k1', .5), 'k3': ('k2', .5), 'k4': ('k3', .5), 'app': ('k4', .5), 'lock': ('app', .6), 'bot': ('lock', .6)},
    'academie-15-avis-negatif': {'quote': ('stars', .6), 'bad': ('reflex', .6), 'fut': ('pub', .6), 'judge': ('fut', .6), 'fight': ('hot', .6),
                                 'wait': ('fight', .6), 'calm': ('wait', .6), 's4': ('s3', .8), 'gift': ('copy', .8), 'r2': ('r20', .6), 'r467': ('r2', .5),
                                 'back': ('r467', .6), 'r14': ('back', .5), 'm2': ('m1', .45), 'm3': ('m2', .45), 'm4': ('m3', .45),
                                 'k2': ('k1', .5), 'k3': ('k2', .5), 'app': ('k3', .5), 'draft': ('app', .6), 'valid': ('draft', .6)},
    'academie-12-assurance': {'leave': ('water', .6), 'cancel': ('leave', .5), 'live': ('home', .5), 'guests': ('live', .5), 'write': ('ask', .6),
                              'n3': ('n2', .6), 'n4': ('n3', .6), 'n6': ('n5', .6), 'only': ('some', .6), 'direct': ('only', .6),
                              'lost': ('rep', .6), 'rest': ('fr', .5), 'total': ('without', .5), 'p2': ('p1', .5), 'p3': ('p2', .5),
                              'k2': ('k1', .5), 'k3': ('k2', .5), 'k4': ('k3', .5), 'app': ('k4', .5), 'inc': ('app', .6)},
    'academie-20-gestion-proprietaire': {'why': ('how', .5), 'p2': ('p1', .5), 'p3': ('p2', .5), 'm2': ('m1', .5), 'm3': ('m2', .5), 'm4': ('m3', .5),
                                         'v300': ('v2000', .5), 'net': ('gross', .7), 'gap': ('net', .6), 'minus2': ('minus1', .5), 'minus3': ('minus2', .5),
                                         'r300': ('r2000', .5), 'r340': ('r300', .5), 'r160': ('r340', .5), 'r1200': ('r160', .5), 'fixed': ('apart', .6),
                                         'c2': ('c1', .5), 'c3': ('c2', .5), 'c4': ('c3', .5), 'c5': ('c4', .5),
                                         'k2': ('k1', .5), 'k3': ('k2', .5), 'app': ('k3', .5), 'base2': ('sign', .6), 'valid': ('base2', .6), 'auto': ('valid', .6)},
    'academie-11-securite': {'fire': ('det', .6), 'r': ('o', .4), 'v': ('r', .4), 'd2': ('d1', .4), 'd3': ('d2', .4), 'd4': ('d3', .4),
                             'ext': ('co', .6), 'kit': ('ext', .6), 'torch': ('kit', .5), 'w2': ('w1', .5), 'w3': ('w2', .5), 'e112': ('w3', .5), 'mine': ('e112', .5),
                             't2': ('t1', .6), 't3': ('t2', .6), 'n2': ('n1', .5), 'n3': ('n2', .5),
                             'k2': ('k1', .5), 'k3': ('k2', .5), 'k4': ('k3', .5), 'app': ('k4', .5), 'notes': ('app', .6)},
    'academie-19-extras': {'x2': ('x1', .4), 'x3': ('x2', .4), 'x4': ('x3', .4), 's2': ('s1', .35), 's3': ('s2', .35), 's4': ('s3', .35), 's5': ('s4', .35),
                           'p35': ('calc', .6), 'v4': ('v20', .5), 'v140': ('v4', .5), 'c2': ('c1', .4), 'c3': ('c2', .4),
                           'via': ('gyg', .5), 'klk': ('via', .5), 'a2': ('a1', .5), 'a3': ('a2', .5), 'e8': ('e130', .6), 'e1040': ('e8', .6),
                           'm2': ('m1', .5), 'm3': ('m2', .5), 'm4': ('m3', .5), 'pdj': ('arr', .6), 'p55': ('sum', .5), 'p50': ('p55', .6),
                           't2': ('t1', .8), 't3': ('t2', .8), 'k2': ('k1', .5), 'k3': ('k2', .5), 'app': ('k3', .5), 'pay': ('app', .6)},
    # Académie 01 : la formule se lit avant l'exemple, l'exemple roule avant le résultat.
    'academie-01-kpi': {'f1n': ('slot1', 1.0), 'f1d': ('f1n', .8), 'f1x': ('f1d', .8), 'f1r': ('f1x', 1.0), 'blk': ('trap1', 1.0), 'f1b': ('blk', 1.2),
                        'f2n': ('slot2', 1.0), 'f2d': ('f2n', .8), 'f2x': ('f2d', .8), 'f2r': ('f2x', 1.0),
                        'fee1': ('trap2', 1.0), 'fee2': ('fee1', .7), 'wrong': ('fee2', .8), 'diff': ('wrong', .8),
                        'f3n': ('slot3', 1.0), 'f3d': ('f3n', .8), 'empty': ('f3d', .5), 'f3x': ('empty', .8), 'f3r': ('f3x', 1.0), 'id': ('f3r', .8), 'unite': ('why', .6),
                        'sA': ('slot4', .8), 'sAn': ('sA', .6), 'sAr': ('sAn', .9), 'sB': ('sAr', .8), 'sBn': ('sB', .6), 'sBr': ('sBn', .6),
                        'sC': ('sBr', .6), 'sCn': ('sC', .6), 'sCr': ('sCn', .8),
                        'm1': ('slot5', .8), 'm2': ('m1', .8), 'm3': ('m2', .8), 'm4': ('m3', .8), 'season': ('m4', .8),
                        'k2': ('k1', .4), 'k3': ('k2', .4), 'app': ('k3', .5)},
}

# Reels dont les plans suivent la voix : une réplique qui laisserait un blanc de plus de CHAIN_GAP
# après la précédente est avancée d'autant ; les plans (sync.slots, ouverts par les répliques
# listées) et la durée de la vidéo (fin de la voix + TAIL) sont recalés pour la langue.
FOLLOW = {
    'reel-03-avant-apres': {'slots': ['b2', 'b3', 'b4', 'b5'], 'slot_end': 'merge'},
    # Série 08-15 : un plan par réplique, jusqu'à l'écran de fin.
    'reel-08-23h40': {'slots': ['b1', 'b2', 'b3', 'b4', 'b5'], 'slot_end': 'end'},
    'reel-09-clim-en-panne': {'slots': ['b1', 'b2', 'b3', 'b4', 'b5'], 'slot_end': 'end'},
    'reel-10-apres-le-depart': {'slots': ['b1', 'b2', 'b3', 'b4', 'b5'], 'slot_end': 'end'},
    'reel-11-fiches-de-police': {'slots': ['b1', 'b2', 'b3', 'b4', 'b5'], 'slot_end': 'end'},
    'reel-12-deux-nuits-de-plus': {'slots': ['b1', 'b2', 'b3', 'b4', 'b5'], 'slot_end': 'end'},
    'reel-13-direct-sans-risque': {'slots': ['b1', 'b2', 'b3', 'b4', 'b5'], 'slot_end': 'end'},
    'reel-14-proprietaire-inquiet': {'slots': ['b1', 'b2', 'b3', 'b4', 'b5'], 'slot_end': 'end'},
    'reel-15-cartes-de-la-journee': {'slots': ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'], 'slot_end': 'end'},
    # Série prestataires (16-18) : même principe.
    'reel-16-votre-savoir-faire': {'slots': ['b1', 'b2', 'b3', 'b4', 'b5'], 'slot_end': 'end'},
    'reel-17-la-mission-cote-prestataire': {'slots': ['b1', 'b2', 'b3', 'b4', 'b5'], 'slot_end': 'end'},
    'reel-18-six-familles-de-metiers': {'slots': ['b1', 'b2', 'b3', 'b4', 'b5'], 'slot_end': 'end'},
    # Académie : un plan par chapitre ; respirations plus longues qu'un Reel (on apprend).
    'academie-01-kpi': {'slots': ['b1', 'b2', 'b5', 'b8', 'b11', 'b13', 'b16'], 'slot_end': 'end', 'gap': 0.5, 'scene_gap': 0.85},
    'academie-02-revenu-net': {'slots': ['b1', 'b2', 'b4', 'b6', 'b9', 'b11', 'b12'], 'slot_end': 'end', 'gap': 0.5, 'scene_gap': 0.85},
    'academie-18-direct-ou-plateforme': {'slots': ['b1', 'b2', 'b5', 'b7', 'b8', 'b11', 'b12'], 'slot_end': 'end', 'gap': 0.5, 'scene_gap': 0.85},
    'academie-03-delai-duree': {'slots': ['b1', 'b2', 'b6', 'b9', 'b11', 'b12'], 'slot_end': 'end', 'gap': 0.5, 'scene_gap': 0.85},
    'academie-04-qualite': {'slots': ['b1', 'b2', 'b5', 'b8', 'b10', 'b11'], 'slot_end': 'end', 'gap': 0.5, 'scene_gap': 0.85},
    'academie-17-prix-dynamique': {'slots': ['b1', 'b2', 'b5', 'b8', 'b11', 'b12'], 'slot_end': 'end', 'gap': 0.5, 'scene_gap': 0.85},
    'academie-13-menage-rotation': {'slots': ['b1', 'b2', 'b5', 'b9', 'b11', 'b12'], 'slot_end': 'end', 'gap': 0.5, 'scene_gap': 0.85},
    'academie-14-questions-voyageurs': {'slots': ['b1', 'b2', 'b4', 'b7', 'b9', 'b10'], 'slot_end': 'end', 'gap': 0.5, 'scene_gap': 0.85},
    'academie-15-avis-negatif': {'slots': ['b1', 'b2', 'b4', 'b8', 'b10', 'b11'], 'slot_end': 'end', 'gap': 0.5, 'scene_gap': 0.85},
    'academie-12-assurance': {'slots': ['b1', 'b2', 'b3', 'b7', 'b8', 'b10'], 'slot_end': 'end', 'gap': 0.5, 'scene_gap': 0.85},
    'academie-20-gestion-proprietaire': {'slots': ['b1', 'b2', 'b5', 'b8', 'b10', 'b11'], 'slot_end': 'end', 'gap': 0.5, 'scene_gap': 0.85},
    'academie-11-securite': {'slots': ['b1', 'b2', 'b5', 'b6', 'b7', 'b9'], 'slot_end': 'end', 'gap': 0.5, 'scene_gap': 0.85},
    'academie-19-extras': {'slots': ['b1', 'b2', 'b5', 'b8', 'b10', 'b11'], 'slot_end': 'end', 'gap': 0.5, 'scene_gap': 0.85},
}
# Reels à plans FIXES (minutages codés dans l'animation) dont on supprime quand même les blancs :
# les répliques s'enchaînent (respiration CHAIN_GAP) et l'animation est DÉFORMÉE dans le temps —
# chaque départ réel de réplique est ramené sur son départ prévu (`lang.<langue>.warp`, table de
# correspondance temps réel → temps de l'animation, appliquée par le kit). Les moments synchronisés
# restent calés sur les mots ; les sous-titres restent en temps réel.
WARP = {'reel-04-agents-ia', 'reel-07-tour-produit'}
WARP_RANGE = (0.7, 1.45)  # vitesse d'animation acceptable par scène (au-delà : avertissement)
CHAIN_GAP = 0.35         # respiration entre deux scènes
SLOT_LEAD = 0.2          # le plan s'ouvre un peu avant la réplique qui le raconte
TAIL = 1.5               # écran de fin tenu après la dernière syllabe

# Au-delà de cet instant, les titres de promesse puis l'écran de fin disent déjà le texte :
# pas de sous-titre en doublon
# (clé = moment de la timeline de la langue, id de réplique = son départ, ou nombre).
SUB_UNTIL = {'reel-01-manifeste': 'b6', 'reel-02-une-seule-verite': 25.6, 'reel-03-avant-apres': 'merge',
             'reel-04-agents-ia': 'b7', 'reel-05-depart-tardif': 'b6', 'reel-07-tour-produit': 'b9',
             'reel-08-23h40': 'b5', 'reel-09-clim-en-panne': 'b5',
             'reel-10-apres-le-depart': 'b5', 'reel-11-fiches-de-police': 'b5',
             'reel-12-deux-nuits-de-plus': 'b5', 'reel-13-direct-sans-risque': 'b5',
             'reel-14-proprietaire-inquiet': 'b5', 'reel-15-cartes-de-la-journee': 'b7',
             'reel-16-votre-savoir-faire': 'b5', 'reel-17-la-mission-cote-prestataire': 'b5', 'reel-18-six-familles-de-metiers': 'b5',
             'academie-01-kpi': 'b17', 'academie-02-revenu-net': 'b13', 'academie-18-direct-ou-plateforme': 'b13',
             'academie-03-delai-duree': 'b13', 'academie-04-qualite': 'b12',
             'academie-17-prix-dynamique': 'b13', 'academie-19-extras': 'b12',
             'academie-13-menage-rotation': 'b13', 'academie-14-questions-voyageurs': 'b11',
             'academie-15-avis-negatif': 'b12', 'academie-12-assurance': 'b11',
             'academie-20-gestion-proprietaire': 'b12', 'academie-11-securite': 'b10'}
# Sous-titres plus longs sur le 16:9 (1 400 px de large, 36 px) ; une seule ligne sur le Reel 05,
# où le montant « 150 MAD » s'affiche juste au-dessus des sous-titres.
SUB_MAX_REEL = {'reel-07-tour-produit': 100, 'reel-05-depart-tardif': 40, 'reel-15-cartes-de-la-journee': 54}

# Écriture d'affichage des sous-titres (la voix off est écrite pour être prononcée). Espaces
# insécables entre nombre et unité : un sous-titre ne doit jamais couper « 15 | % ».
DISPLAY = {
    'fr': [('Sept heures et demie', '7 h 30'), ('Neuf heures', '9 h'), ('Quatorze heures', '14 h'), ('trente-quatre degrés', '34 °C'), ('quinze pour cent', '15 %'), ('vingt-trois heures quarante', '23 h 40'), ('Sept heures deux', '7 h 02'), ('quatorze heures', '14 h'), ('cent cinquante dirhams', '150 dirhams'),
           ('Dix agents I.A.', '10 agents IA'), ('Vingt-trois heures quatorze', '23 h 14'), ('Vingt-trois heures seize', '23 h 16'),
           ('Dix-neuf heures', '19 h'), ('Seize heures', '16 h'), ('Onze heures', '11 h'), ('Huit heures', '8 h'), ('quinze heures', '15 h'),
           ('Vingt-deux nuits sur trente', '22 nuits sur 30'), ('soixante-treize pour cent', '73 %'), ('Deux mille six cent quarante euros', '2 640 €'),
           ('vingt-deux nuits', '22 nuits'), ('cent vingt euros', '120 €'), ('quatre-vingt-huit euros', '88 €'), ('quatre-vingt-quinze euros', '95 €'),
           ('quatre-vingt-dix pour cent', '90 %'), ('quatre-vingt-cinq cinquante', '85,50 €'),
           ('bètli point F R', 'baitly.fr'), ('Bètli', 'Baitly'), ('I.A.', 'IA')],
    'en': [('Seven thirty', '7:30'), ('Nine a.m.', '9 a.m.'), ('Two p.m.', '2 p.m.'), ('forty-five degrees', '45 °C'), ('fifteen percent', '15%'), ('eleven forty p.m.', '11:40 p.m.'), ('Eleven fourteen p.m.', '11:14 p.m.'), ('Eleven sixteen.', '11:16 p.m.'), ('Seven-oh-two.', '7:02 a.m.'),
           ('Eight a.m.', '8 a.m.'), ('Eleven a.m.', '11 a.m.'), ('Four p.m.', '4 p.m.'), ('Seven p.m.', '7 p.m.'),
           ('two p.m.', '2 p.m.'), ('sixty riyals', '60 riyals'), ('Ten A.I. agents', '10 AI agents'), ('A.I.', 'AI'),
           ('betly dot F R', 'baitly.fr'), ('Betly', 'Baitly')],
}

# Écriture d'affichage propre à un épisode (nombres écrits en toutes lettres pour la voix), avant
# DISPLAY : l'ordre compte (« quatre-vingt-cinq » contient « vingt-cinq »).
DISPLAY_REEL = {
    'academie-01-kpi': {'fr': [
        ('Vingt-deux sur trente', '22 sur 30'), ('trente nuits', '30 nuits'), ('vendez vingt-deux.', 'vendez 22.'),
        ('soixante-treize pour cent', '73 %'), ('Cinq nuits', '5 nuits'), ('par vingt-cinq', 'par 25'),
        ('quatre-vingt-huit pour cent', '88 %'), ('A.D.R.', 'ADR.'), ('vingt-deux nuits', '22 nuits'), ('Vingt-deux nuits', '22 nuits'),
        ('deux mille six cent quarante euros', '2 640 €'), ('Deux mille six cent quarante euros', '2 640 €'),
        ('cent vingt euros', '120 €'), ('trois cent trente euros', '330 €'), ('cent dix euros', '110 €'),
        ('cent quarante euros', '140 €'), ('vingt euros de trop', '20 € de trop'), ('quatre-vingt-huit euros', '88 €'),
        ('quatre-vingt-quinze euros', '95 €'), ('Vingt-sept nuits', '27 nuits'), ('quatre-vingt-dix pour cent', '90 %'),
        ('quatre-vingt-cinq euros cinquante', '85,50 €'), ('cent soixante euros', '160 €'), ('Douze nuits', '12 nuits'),
        ('soixante-quatre euros', '64 €'),
    ]},
    'academie-02-revenu-net': {'fr': [
        ('six cent soixante-dix euros', '670 €'), ('cinq nuits à cent vingt euros', '5 nuits à 120 €'), ('six cents euros', '600 €'),
        ('cent vingt euros', '120 €'), ('six cent soixante euros', '660 €'), ('soixante-dix euros', '70 €'), ('Soixante euros', '60 €'),
        ('dix euros de taxe', '10 € de taxe'), ('quinze pour cent', '15 %'), ('quatre-vingt-dix-neuf euros', '99 €'),
        ('cinq cent soixante et un euros', '561 €'), ('cinquante-cinq euros', '55 €'), ('quinze euros', '15 €'), ('vingt-trois euros', '23 €'),
        ('quatre cent soixante-huit euros', '468 €'), ('quatre-vingt-treize soixante', '93,60 €'), ('dix euros par séjour', '10 € par séjour'),
        ('Quatre séjours', '4 séjours'), ('mille huit cent soixante-douze euros', '1 872 €'), ('quatre cent cinquante euros', '450 €'),
        ('mille quatre cent vingt-deux euros', '1 422 €'), ('épisode dix-huit', 'épisode 18'), ('cinq nuits', '5 nuits'),
    ]},
    'academie-18-direct-ou-plateforme': {'fr': [
        ('six cent soixante euros', '660 €'), ('quinze pour cent', '15 %'), ('quatre-vingt-dix-neuf euros', '99 €'),
        ('cinq cent soixante et un euros', '561 €'), ('un virgule cinq pour cent, plus vingt-cinq centimes', '1,5 % + 0,25 €'),
        ('dix euros quinze', '10,15 €'), ('six cent quarante-neuf euros quatre-vingt-cinq', '649,85 €'),
        ('quatre-vingt-huit euros quatre-vingt-cinq', '88,85 €'), ('vingt séjours', '20 séjours'), ('mille huit cents euros', '1 800 €'),
        ('Trente euros', '30 €'), ('cinquante-huit euros quatre-vingt-cinq', '58,85 €'), ('cinq pour cent', '5 %'),
        ('cinquante-neuf euros trente', '59,30 €'),
    ]},
    'academie-03-delai-duree': {'fr': [
        ('quarante-cinq, trente, douze, soixante et trois jours', '45, 30, 12, 60 et 3 jours'), ('deux mai', '2 mai'), ('seize juin', '16 juin'),
        ('quarante-cinq jours', '45 jours'), ('trente jours', '30 jours'), ('dix jours', '10 jours'), ('vingt-quatre nuits', '24 nuits'),
        ('huit séjours', '8 séjours'), ('quatre séjours', '4 séjours'), ('trois nuits', '3 nuits'), ('six nuits', '6 nuits'),
        ('Huit départs', '8 départs'), ('huit ménages', '8 ménages'), ('soixante-dix euros', '70 €'), ('cinq cent soixante euros', '560 €'),
        ('contre deux cent quatre-vingts', 'contre 280 €'), ('Deux cent quatre-vingts euros', '280 €'), ('trou de deux nuits', 'trou de 2 nuits'),
        ('ces deux nuits', 'ces 2 nuits'), ('Deux nuits à cent vingt euros', '2 nuits à 120 €'), ('deux cent quarante euros', '240 €'),
    ]},
    'academie-04-qualite': {'fr': [
        ('Vingt-cinq réservations', '25 réservations'), ('deux annulations', '2 annulations'), ('quatre-vingt-quinze pour cent', '95 %'),
        ('huit pour cent', '8 %'), ('douze avis à quatre virgule six', '12 avis à 4,6'), ('une étoile', '1 étoile'),
        ('quatre virgule trente-deux', '4,32'), ('quatre-vingts avis à quatre virgule huit', '80 avis à 4,8'),
        ('quatre virgule soixante-quinze', '4,75'), ('vingt-quatre heures', '24 heures'), ('Trente-huit sur quarante', '38 sur 40'),
    ]},
    'academie-17-prix-dynamique': {'fr': [
        ('sept cent cinquante euros', '750 €'), ('trente nuits', '30 nuits'), ('vingt-cinq euros', '25 €'), ('cent soixante euros', '160 €'),
        ('soixante euros', '60 €'), ('trois nuits', '3 nuits'), ('vingt euros par nuit', '20 € par nuit'), ('quarante-cinq euros', '45 €'),
        ('cinquante-trois euros', '53 €'), ('Cent euros', '100 €'), ('cent vingt euros', '120 €'), ('plus vingt pour cent', '+20 %'),
        ('quatre week-ends', '4 week-ends'), ('huit nuits', '8 nuits'), ('deux mois', '2 mois'), ('sept jours', '7 jours'),
        ('moins dix pour cent', '−10 %'), ('quatre-vingt-dix euros', '90 €'), ('trois jours', '3 jours'), ('moins vingt pour cent', '−20 %'),
        ('quatre-vingts euros', '80 €'), ('Règle numéro un', 'Règle n° 1'), ('Règle numéro deux', 'Règle n° 2'), ('Règle numéro trois', 'Règle n° 3'),
    ]},
    'academie-13-menage-rotation': {'fr': [
        ('onze heures', '11 h'), ('seize heures', '16 h'), ('midi et demi', '12 h 30'), ('trois heures et demie', '3 h 30'),
        ('deux heures de marge', '2 h de marge'), ('trente minutes', '30 min'), ('deux heures', '2 h'), ('trois heures', '3 h'),
        ('cinq heures', '5 h'), ('cinquante euros', '50 €'), ('trente euros', '30 €'), ('Quatre-vingts euros', '80 €'),
        ('cinq minutes', '5 minutes'), ('cinq étapes', '5 étapes'),
    ]},
    'academie-14-questions-voyageurs': {'fr': [
        ('les mêmes sept questions', 'les mêmes 7 questions'), ('Vingt séjours', '20 séjours'), ('trois questions par séjour', '3 questions par séjour'),
        ('cinq minutes', '5 minutes'), ('trois cents minutes', '300 minutes'), ('Cinq heures', '5 heures'), ('cinq heures', '5 heures'),
        ('vingt pages', '20 pages'), ('deux questions sur trois', '2 questions sur 3'), ('tombent à cent', 'tombent à 100'),
        ('une heure quarante', '1 h 40'), ('sept questions', '7 questions'),
    ]},
    'academie-15-avis-negatif': {'fr': [
        ('Un avis à deux étoiles', 'Un avis à 2 étoiles'), ('Deux étoiles', '2 étoiles'), ('quatre virgule soixante-sept', '4,67'),
        ('quatre virgule huit', '4,8'), ('Vingt avis', '20 avis'), ('Quatorze avis à cinq étoiles', '14 avis à 5 étoiles'),
        ('quatre étapes', '4 étapes'), ('quatre phrases', '4 phrases'),
    ]},
    'academie-12-assurance': {'fr': [
        ('vos trois réservations', 'vos 3 réservations'), ('Trois mille euros', '3 000 €'), ('trois réservations annulées', '3 réservations annulées'),
        ('neuf cents euros', '900 €'), ('trois cents plus neuf cents', '300 + 900'), ('trois cents euros', '300 €'),
        ('mille deux cents euros', '1 200 €'), ('six questions', '6 questions'),
    ]},
    'academie-20-gestion-proprietaire': {'fr': [
        ('deux mille euros', '2 000 €'), ('trois cent quarante euros', '340 €'), ('trois cents euros', '300 €'), ('Vingt pour cent', '20 %'),
        ('quatre cents euros', '400 €'), ('Soixante euros', '60 €'), ('moins trois cent quarante de commission', '− 340 € de commission'),
        ('moins trois cents de frais', '− 300 € de frais'), ('moins cent soixante', '− 160 €'), ('mille deux cents euros', '1 200 €'),
        ('le cinq de chaque mois', 'le 5 de chaque mois'), ('cinq points', '5 points'), ('trois pièces', '3 pièces'),
    ]},
    'academie-11-securite': {'fr': [
        ('marqué C E', 'marqué CE'), ('N F E N quatorze six cent quatre', 'NF EN 14604'), ('quarante-cinq mille euros', '45 000 €'),
        ('le cent douze', 'le 112'), ('Trente secondes', '30 secondes'), ('trois vérifications', '3 vérifications'),
    ]},
    'academie-19-extras': {'fr': [
        ('Get Your Guide', 'GetYourGuide'), ('Klouk', 'Klook'), ('Straïpe', 'Stripe'), ('trente-cinq euros', '35 €'),
        ('un voyageur sur cinq', '1 voyageur sur 5'), ('vingt séjours', '20 séjours'), ('quatre ventes', '4 ventes'), ('cent quarante euros', '140 €'),
        ('soixante-cinq euros', '65 €'), ('deux personnes', '2 personnes'), ('cent trente euros', '130 €'), ('huit pour cent', '8 %'),
        ('dix euros quarante', '10,40 €'), ('trente plus vingt-cinq', '30 + 25'), ('cinquante-cinq euros', '55 €'), ('cinquante euros', '50 €'),
    ]},
}


def sh(args):
    return subprocess.run(args, capture_output=True, text=True)


def detect(path, noise, d):
    err = sh(['ffmpeg', '-hide_banner', '-i', path, '-af', f'silencedetect=noise={noise}:d={d}', '-f', 'null', '-']).stderr
    starts = [float(x) for x in re.findall(r'silence_start: ([0-9.]+)', err)]
    ends = [float(x) for x in re.findall(r'silence_end: ([0-9.]+)', err)]
    return list(zip(starts, ends))


def silences(path):
    """Silences francs (-35 dB, 0,18 s), complétés des courtes pauses plus bruitées (-28 dB, ≥ 0,2 s)
    qui ne recouvrent aucun silence franc : certaines prises enchaînent deux répliques avec un simple
    souffle (Reel 08 FR, Lucie : 0,33 s à -28 dB, rien à -35 dB). Les silences francs gardent leur
    durée, pour ne pas fausser le choix des frontières (validé sur les 14 prises FR/EN du 28/09)."""
    base = detect(path, '-35dB', 0.18)
    extra = [(a, b) for a, b in detect(path, '-28dB', 0.1)
             if b - a >= 0.2 and not any(a < e + .02 and b > s - .02 for s, e in base)]
    return sorted(base + extra)


def duration(path):
    return float(sh(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).stdout)


def spoken(text):
    return re.sub(r'\s+', ' ', re.sub(r'\[[^\]]+\]', '', text)).strip()


def split_lines(total, sils, lines, w_pause=1.5, w_gap=1.0, w_ell=1.0, long_min=0.6):
    """Choisit ensemble les frontières entre répliques parmi les silences : une frontière vaut
    d'autant plus que le silence est long (w_pause par seconde) et proche de la position attendue
    au prorata des caractères (w_gap par seconde d'écart). Une réplique qui contient « … » doit
    contenir autant de longues pauses (≥ long_min) et pas davantage (w_ell par écart) : sans cela,
    la pause « … » d'une voix posée (Mark) volait la place d'une vraie fin de réplique.
    Programmation dynamique ; réglages validés le 28/09 sur les 12 prises FR/EN des Reels 01 à 07
    (Noé, Lucie, Mark). Cas limite rencontré : un « [whispers] » si bas qu'il passe pour du silence,
    suivi d'un enchaînement sans pause (Reel 05 EN). Une coupure fausse se repère au message
    « débit anormal » ; la corriger alors dans FORCE_BOUNDS."""
    texts = [spoken(l) for l in lines]
    # +12 ≈ la pause de fin de réplique, +10 par « … », +3 par fin de phrase interne
    weights = [len(t) + 12 + 10 * t.count('…') + 3 * len(re.findall(r'[.?!:](?=\s)', t)) for t in texts]
    ells = [t.count('…') for t in texts]
    acc, expected = 0, []
    for w in weights[:-1]:
        acc += w
        expected.append(total * acc / sum(weights))
    n, m, neg = len(expected), len(sils), float('-inf')
    score = lambda k, j: (sils[j][1] - sils[j][0]) * w_pause - abs((sils[j][0] + sils[j][1]) / 2 - expected[k]) * w_gap

    def trans(k, a, b):  # réplique k entre le silence a et le silence b (-1 = début, m = fin de prise)
        lo = sils[a][1] if a >= 0 else 0.0
        hi = sils[b][0] if b < m else total
        longs = sum(1 for s, e in sils if s > lo + .05 and e < hi - .05 and e - s >= long_min)
        return -w_ell * abs(longs - ells[k])
    best = [[neg] * m for _ in range(n)]
    back = [[-1] * m for _ in range(n)]
    for j in range(m):
        best[0][j] = score(0, j) + trans(0, -1, j)
    for k in range(1, n):
        for j in range(m):
            prev = [(best[k - 1][i] + trans(k, i, j), i) for i in range(j) if best[k - 1][i] > neg]
            if prev:
                v, i = max(prev)
                best[k][j], back[k][j] = v + score(k, j), i
    j = max(range(m), key=lambda x: best[n - 1][x] + trans(n, x, m))
    path = [j]
    for k in range(n - 1, 0, -1):
        j = back[k][j]
        path.append(j)
    chosen = [sils[x] for x in reversed(path)]
    bounds, start = [], 0.0
    for s in chosen:
        bounds.append((start, s[0]))
        start = s[1]
    bounds.append((start, total))
    return bounds


# Coupures imposées (fin de chaque réplique sauf la dernière, en s dans la prise), pour une prise que
# la détection automatique découperait mal. Vide tant que la détection suffit.
FORCE_BOUNDS = {
    # Lucie marque autant la pause des deux-points (« Et tout suit : ») que la fin de réplique.
    ('reel-12-deux-nuits-de-plus', 'fr'): [7.12, 13.28, 19.33, 25.70, 29.95],
    # Mark : pause « … » de 0,5 s seulement, la pause suivante (0,9 s) passait pour la fin de b4.
    ('reel-13-direct-sans-risque', 'en'): [7.02, 15.75, 21.58, 31.64, 34.82],
    # Académie 01 (Paul K, 17 répliques) : la détection plaçait b5 et b12-b15 une phrase trop loin.
    # Frontières recoupées phrase par phrase (pauses de ponctuation) et par comptage de syllabes.
    ('academie-01-kpi', 'fr'): [10.40, 19.25, 26.84, 41.20, 48.23, 53.44, 65.50, 76.44, 83.72, 90.80,
                                101.16, 113.81, 125.28, 136.95, 141.38, 156.79],
    # Académie 18 : la pause de « Une règle, cependant : » passait pour la fin de b9, et celle de
    # « une fiche Google, » pour la fin de b10 (vérifié phrase par phrase sur les pauses fines).
    ('academie-18-direct-ou-plateforme', 'fr'): [11.76, 22.69, 33.61, 40.84, 51.99, 61.16, 75.47, 85.03, 92.37, 105.0, 113.20, 130.07],
    # Académie 17 (Lucie) : la pause de la virgule « ne rapporte rien, » passait pour la fin de b8 ;
    # b8 finit après « se revend jamais » (comptage de syllabes par segment).
    ('academie-17-prix-dynamique', 'fr'): [13.21, 21.60, 35.23, 48.00, 56.35, 69.81, 82.27, 88.72, 99.28, 107.34, 119.64, 135.10],
    # Académie 19 (Noé, prise ralentie) : peu de silences ; la détection coupait b9 au milieu de la première
    # phrase de b10 (« Le moment compte… » commence après la pause de 0,6 s à 106,37).
    ('academie-19-extras', 'fr'): [12.73, 23.73, 33.32, 47.29, 56.32, 69.02, 83.74, 95.24, 106.37, 121.57, 136.44],
}


def cut_line(src, a, b, sils, out, tempo=1.0):
    """Extrait [a, b], rogne les bords, ramène les pauses internes à MAX_PAUSE."""
    inner = [(s, e) for s, e in sils if s > a + 0.05 and e < b - 0.05]
    head = next((e for s, e in sils if s <= a + 0.02 and e > a), a)
    tail = next((s for s, e in sils if s < b and e >= b - 0.02), b)
    a, b = max(a, head - EDGE), min(b, tail + EDGE)
    keep, cur = [], a
    for s, e in inner:
        if e - s > MAX_PAUSE:
            keep.append((cur, s + MAX_PAUSE / 2))
            cur = e - MAX_PAUSE / 2
    keep.append((cur, b))
    parts = ''.join(f'[0:a]atrim={x:.3f}:{y:.3f},asetpts=PTS-STARTPTS[p{i}];' for i, (x, y) in enumerate(keep))
    graph = parts + ''.join(f'[p{i}]' for i in range(len(keep))) + f'concat=n={len(keep)}:v=0:a=1'
    graph += f',atempo={tempo:.3f}[o]' if tempo > 1.001 else '[o]'
    r = sh(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-filter_complex', graph, '-map', '[o]', '-ar', '44100', out])
    if r.returncode:
        raise SystemExit(r.stderr)
    return duration(out)


def word_time(text, word, start, dur):
    t = spoken(text)
    i = t.find(word)
    if i < 0:
        raise SystemExit(f'mot « {word} » introuvable dans : {t}')
    return start + dur * i / len(t)


def chunks(text, sub_max=SUB_MAX):
    """Regroupe les membres de phrase (coupés après . ? ! … , « : » et « ; ») en sous-titres de
    SUB_MAX caractères au plus : deux lignes lisibles, jamais un fragment isolé. Une citation
    reste entière : on ne coupe jamais avant son « » » fermant, mais juste après."""
    pieces = [p for p in re.split(r'(?<=[,.?!…])\s+(?!»)|(?<=[.?!…] »)\s+|(?<=\s[:;])\s+', text) if p]
    out = []
    for p in pieces:
        # un fragment court qui FINIT une phrase (« automatiquement. ») rejoint le précédent,
        # quitte à dépasser un peu ; un début de phrase (« De l'autre, ») ouvre un nouveau sous-titre
        # (une fin de phrase suivie du « » » d'une citation reste une fin de phrase)
        end = lambda x: x.rstrip(' »')[-1:]
        tail = len(p) < 18 and end(p) in '.?!…'
        # une phrase qui commence ne s'accroche pas derrière une phrase finie si elle continue
        # au sous-titre suivant (« …la DGSN. En France, » / « elle est transmise… ») ; une phrase
        # complète et courte peut s'y accrocher
        opens = out and end(out[-1]) in '.?!…' and end(p) not in '.?!…'
        if out and not opens and len(out[-1]) + 1 + len(p) <= sub_max + (10 if tail else 0):
            out[-1] = out[-1] + ' ' + p
        else:
            out.append(p)
    # un sous-titre très court (« 7 h 02. ») resterait affiché une fraction de seconde : il rejoint le suivant
    for n in range(len(out) - 2, -1, -1):
        if len(out[n]) < 20 and len(out[n]) + 1 + len(out[n + 1]) <= sub_max + 14:
            out[n:n + 2] = [out[n] + ' ' + out[n + 1]]
    return out


def emphasize(c):
    """Met en couleur la dernière proposition quand le sous-titre en compte plusieurs (mêmes
    coupures que chunks : un « » » fermant reste avec sa citation)."""
    pieces = [p for p in re.split(r'(?<=[,.?!…])\s+(?!»)|(?<=[.?!…] »)\s+|(?<=\s:)\s+', c) if p]
    if len(pieces) < 2:
        return c, ''
    return ' '.join(pieces[:-1]) + ' ', pieces[-1]


def display(text, lang, reel=None):
    t = spoken(text).replace(' … ', ' ')          # « … » isolé = pause dite, pas écrite
    for a, b in DISPLAY_REEL.get(reel, {}).get(lang, []) + DISPLAY.get(lang, []):
        t = t.replace(a, b)
    t = re.sub(r'[ \t\n]+', ' ', t).strip()
    # un sous-titre ne coupe jamais « 1 800 | € » ni « 2 | 640 » : espaces insécables
    t = re.sub(r'(\d) (?=\d{3}(?!\d))', '\\1\u00a0', t)
    return re.sub(r'(\d) (€|%)', '\\1\u00a0\\2', t)


def js(v):
    return json.dumps(v, ensure_ascii=False)


def main(reel, lang):
    rdir = os.path.join(HERE, reel)
    vo = os.path.join(rdir, 'vo', lang)
    take = next(os.path.join(vo, f) for f in sorted(os.listdir(vo)) if f.startswith('_prise-complete'))
    scripts = json.load(open(os.path.join(HERE, 'elevenlabs', 'scripts-v3.json'), encoding='utf-8'))
    academie = os.path.join(HERE, 'academie-shared', 'scripts-academie.json')   # série Académie : textes à part
    if reel not in scripts['reels'] and os.path.exists(academie):
        scripts = json.load(open(academie, encoding='utf-8'))
    lines = scripts['reels'][reel][lang]
    tl = open(os.path.join(rdir, 'timeline.js'), encoding='utf-8').read()
    defaults = {m.group(1): float(m.group(2)) for m in re.finditer(r"\{ id: '(b\d+)', start: ([0-9.]+) \}", tl)}
    total = duration(take)
    sils = silences(take)
    forced = FORCE_BOUNDS.get((reel, lang))
    if forced:
        ends = [next(e for st, e in sils if abs(st - f) < .05) for f in forced]
        bounds = list(zip([0.0] + ends, forced + [total]))
    else:
        bounds = split_lines(total, sils, [l['text'] for l in lines])
    avg_rate = sum(len(spoken(l['text'])) for l in lines) / total
    follow = FOLLOW.get(reel)
    warp = reel in WARP
    starts, placed, prev_end = {}, [], 0.0
    ids = [l['id'] for l in lines]
    for n, (l, (a, b)) in enumerate(zip(lines, bounds)):
        out = os.path.join(vo, f"{l['id']}.wav")
        d = cut_line(take, a, b, sils, out)
        if warp and placed:
            wanted = prev_end + CHAIN_GAP
        else:
            gap = (follow.get('scene_gap', CHAIN_GAP) if l['id'] in follow['slots'] else follow.get('gap', CHAIN_GAP)) if follow else CHAIN_GAP
            wanted = min(defaults[l['id']], prev_end + gap) if follow and placed else defaults[l['id']]
        st = max(wanted, prev_end + GAP)
        # Réplique qui déborde sur la scène suivante (plans fixes) : légère accélération, bornée.
        room = defaults[ids[n + 1]] - GAP - st if n + 1 < len(ids) and not follow and not warp else None
        if room and d > room:
            tempo = min(TEMPO_MAX, d / room)
            d = cut_line(take, a, b, sils, out, tempo)
            print(f"{l['id']}  accélérée ×{tempo:.2f} (débordait de {d * tempo - room:.2f} s)")
        starts[l['id']] = round(st, 2)
        placed.append((l, st, d))
        prev_end = st + d
        rate = len(spoken(l['text'])) / d
        flag = '  ⚠ débit anormal, vérifier la coupure' if abs(rate - avg_rate) / avg_rate > 0.45 else ''
        print(f"{l['id']}  prise {a:5.2f}→{b:5.2f}  durée {d:4.2f} s  départ {st:5.2f} (défaut {defaults[l['id']]:5.2f})  fin {prev_end:5.2f}{flag}")
    by_id = {l['id']: (l, st, d) for l, st, d in placed}
    sync = {}
    for key, spec in SYNC.get(reel, {}).items():
        specs = spec if isinstance(spec, list) else [spec]
        vals = [round(word_time(by_id[i][0]['text'], w[lang] if isinstance(w, dict) else w, by_id[i][1], by_id[i][2]) + off, 2)
                for i, w, off in specs]
        sync[key] = vals if isinstance(spec, list) else vals[0]
    if follow:
        opens = [round(starts[i] - SLOT_LEAD, 2) for i in follow['slots']]
        sync['slots'] = [[a, b] for a, b in zip(opens, opens[1:] + [sync[follow['slot_end']]])]
        sync['duration'] = round(-(-(prev_end + TAIL) * 10 // 1) / 10, 1)
    for key, (ref, gap) in MIN_AFTER.get(reel, {}).items():
        if ref == key:
            for n in range(1, len(sync[key])):
                sync[key][n] = round(max(sync[key][n], sync[key][n - 1] + gap), 2)
            continue
        base_t = sync['slots'][int(ref[4:])][0] if ref.startswith('slot') else sync[ref]   # « slotN » = début du plan N
        if sync[key] < base_t + gap:
            print(f'{key} repoussé de {base_t + gap - sync[key]:.2f} s (écart minimal après {ref})')
            sync[key] = round(base_t + gap, 2)
    base = float(re.search(r'duration: ([0-9.]+)', tl).group(1))
    if warp:
        real_end = round(-(-(prev_end + TAIL) * 10 // 1) / 10, 1)
        knots = [[0.0, 0.0]] + [[starts[i], defaults[i]] for i in ids] + [[real_end, base]]
        for (r0, d0), (r1, d1) in zip(knots, knots[1:]):
            f = (d1 - d0) / max(.01, r1 - r0)
            flag = '  ⚠ hors plage' if not WARP_RANGE[0] <= f <= WARP_RANGE[1] else ''
            print(f'  animation {d0:5.2f}→{d1:5.2f} jouée en {r0:5.2f}→{r1:5.2f} : vitesse ×{f:.2f}{flag}')
        sync['warp'] = knots
        sync['duration'] = real_end
    elif not follow and prev_end + TAIL > base:     # l'écran de fin est tenu le temps que la voix finisse
        sync['duration'] = round(-(-(prev_end + TAIL) * 10 // 1) / 10, 1)
    # Sous-titres : texte dit, écriture d'affichage, calés au prorata des caractères.
    subs = []
    for l, st, d in placed:
        text = display(l['text'], lang, reel)
        cs = chunks(text, SUB_MAX_REEL.get(reel, SUB_MAX))
        total_chars = sum(len(c) for c in cs)
        t0 = st
        for c in cs:
            t1 = t0 + d * len(c) / total_chars
            lead, em = emphasize(c)
            # guillemets français : espace insécable, jamais un « » » seul en début de ligne
            nb = lambda x: x.replace('« ', '«\u00a0').replace(' »', '\u00a0»')
            subs.append({'from': round(t0 - 0.05, 2), 'to': round(t1 + 0.1, 2), 'text': nb(lead), 'em': nb(em)})
            t0 = t1
    until = SUB_UNTIL.get(reel)
    until = (starts[until] if until in starts else sync.get(until)) if isinstance(until, str) else until
    if until is not None:
        subs = [x for x in subs if x['from'] < until - 0.2]
        if subs:
            subs[-1]['to'] = min(subs[-1]['to'], round(until, 2))
    for a, b in zip(subs, subs[1:]):
        a['to'] = min(a['to'], round(b['from'] - 0.02, 2))
    # timeline.js : départs + moments synchronisés de la langue
    lang_block = {lang: dict(starts=starts, **sync)}
    old = re.search(r'\n  lang: (\{[^\n]*\}),?\n', tl)
    if not old:
        raise SystemExit('timeline.js : bloc lang sur plusieurs lignes, fusion manuelle à faire')
    merged = json.loads(old.group(1)) if old.group(1) != '{}' else {}
    merged.update(lang_block)
    tl2 = tl[:old.start()] + '\n  lang: ' + js(merged) + ',\n' + tl[old.end():]
    open(os.path.join(rdir, 'timeline.js'), 'w', encoding='utf-8').write(tl2)
    # i18n.js : sous-titres de la langue
    src = open(os.path.join(rdir, 'i18n.js'), encoding='utf-8').read()
    # à partir de window.STRINGS : un i18n.js peut définir avant d'autres blocs par langue (Reel 07 : planning)
    i = src.index(f'  {lang}: {{', src.find('window.STRINGS') + 1)
    j = src.index('    subtitles: [', i)
    if src.startswith('    subtitles: [],', j):          # liste encore vide : on l'ouvre sur deux lignes
        src = src[:j] + '    subtitles: [\n    ],' + src[j + len('    subtitles: [],'):]
    k = src.index('\n    ],', j)
    rows = '\n'.join(f"      {{ from: {s['from']}, to: {s['to']}, text: {js(s['text'])}, em: {js(s['em'])} }}," for s in subs)
    src = src[:j] + '    subtitles: [\n' + rows + src[k:]
    open(os.path.join(rdir, 'i18n.js'), 'w', encoding='utf-8').write(src)
    print('sync', json.dumps(sync, ensure_ascii=False))
    print(f'{len(subs)} sous-titres écrits · fin de la voix à {prev_end:.2f} s')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
