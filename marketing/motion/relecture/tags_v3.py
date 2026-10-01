"""Baitly · Balises Eleven v3 des voix off (intonation, rythme, pauses), par vidéo, réplique et langue.

À quoi sert ce fichier : traduire les consignes d'intonation des VOIX-OFF.md en balises d'Eleven v3
(documentation ElevenLabs « Prompting Eleven v3 » et « Audio tags »), sans toucher aux textes eux-mêmes.
Chaque entrée est une liste d'opérations appliquées au texte courant :
  ('^', '[tag] ')          → préfixe en début de réplique ;
  ('ancre', 'remplacement') → remplace la PREMIÈRE occurrence de l'ancre (qui doit rester présente
                              dans le remplacement). Si l'ancre a disparu (texte retouché), la balise
                              est signalée et ignorée.
Règles suivies : une balise en tête au plus, une balise en ligne seulement quand la consigne demande
un contraste ; les « … » des textes gardent leur rôle de pause ; balises en anglais (langue des
exemples officiels), valables pour le français. Balises documentées : softly, slowly, curious, sighs,
whispers, rushed, deliberate, excited, mischievously, worried, pause, stress on next word.
Balises expérimentales (à valider au premier essai) : warmly, proudly.
À qui il s'adresse : la personne qui génère les voix (build_elevenlabs.py les applique).
"""

P = '^'
TAGS = {
    'reel-01-manifeste': {
        'b1': {'fr': [(P, '[softly] ')], 'en': [(P, '[softly] ')]},
        'b2': {'fr': [(P, '[mischievously] ')], 'en': [(P, '[mischievously] ')]},
        'b3': {'fr': [('tout arrive', '[sighs] tout arrive')], 'en': [('it all lands', '[sighs] it all lands')]},
        'b4': {'fr': [(P, '[deliberate] ')], 'en': [(P, '[deliberate] ')]},
        'b5': {'fr': [('et vous validez', '[warmly] et vous validez')], 'en': [('and you approve', '[warmly] and you approve')]},
        'b6': {'fr': [('Pas votre charge', '[softly] Pas votre charge')], 'en': [('Not your workload', '[softly] Not your workload')]},
        'b7': {'fr': [('Rejoignez', '[pause] [warmly] Rejoignez')], 'en': [('Join', '[pause] [warmly] Join')]},
    },
    'reel-02-une-seule-verite': {
        'b1': {'fr': [(P, '[softly] ')], 'en': [(P, '[softly] ')]},
        'b2': {'fr': [(P, '[worried] ')], 'en': [(P, '[worried] ')]},
        'b3': {'fr': [('Et une belle', '[sighs] Et une belle')], 'en': [('And a sleepless', '[sighs] And a sleepless')]},
        'b4': {'fr': [(P, '[softly] ')], 'en': [(P, '[softly] ')]},
        'b5': {'fr': [('partout ailleurs', '[stress on next word] partout ailleurs')], 'en': [('everywhere else', '[stress on next word] everywhere else')]},
        'b6': {'fr': [(P, '[deliberate] ')], 'en': [(P, '[deliberate] ')]},
        'b7': {'fr': [('Rejoignez', '[warmly] Rejoignez')], 'en': [('Join', '[warmly] Join')]},
    },
    'reel-03-avant-apres': {
        'b1': {'fr': [(P, '[curious] ')], 'en': [(P, '[curious] ')]},
        'b2': {'fr': [(P, '[slowly] '), ('Puis un autre', '[sighs] Puis un autre')], 'en': [(P, '[slowly] '), ('Then another', '[sighs] Then another')]},
        'b3': {'fr': [(P, '[slowly] '), ('Il faut prévenir', '[rushed] Il faut prévenir')], 'en': [(P, '[slowly] '), ('Warn housekeeping', '[rushed] Warn housekeeping')]},
        'b4': {'fr': [(P, '[slowly] '), ('Baisser le prix', '[curious] Baisser le prix')], 'en': [(P, '[slowly] '), ('Should you', '[curious] Should you')]},
        'b5': {'fr': [(P, '[slowly] '), ("D'un côté", "[rushed] D'un côté"), ("De l'autre", "[softly] De l'autre")],
               'en': [(P, '[slowly] '), ('On one side', '[rushed] On one side'), ('On the other', '[softly] On the other')]},
        'b6': {'fr': [(P, '[warmly] ')], 'en': [(P, '[warmly] ')]},
        'b7': {'fr': [('Rejoignez', '[warmly] Rejoignez')], 'en': [(P, '[warmly] ')]},
    },
    'reel-04-agents-ia': {
        'b1': {'fr': [(P, '[curious] ')], 'en': [(P, '[curious] ')]},
        'b2': {'fr': [(P, '[deliberate] ')], 'en': [(P, '[deliberate] ')]},
        'b3': {'fr': [], 'en': []},
        'b4': {'fr': [(P, '[deliberate] ')], 'en': [(P, '[deliberate] ')]},
        'b5': {'fr': [('limites', '[stress on next word] limites')], 'en': [('limits', '[stress on next word] limits')]},
        'b6': {'fr': [], 'en': []},
        'b7': {'fr': [('Rejoignez', '[warmly] Rejoignez')], 'en': [('Join', '[warmly] Join')]},
    },
    'reel-05-depart-tardif': {
        'b1': {'fr': [(P, '[whispers] '), ('Votre voyageur', '[softly] Votre voyageur')], 'en': [(P, '[whispers] '), ('Your guest', '[softly] Your guest')]},
        'b2': {'fr': [(P, '[softly] ')], 'en': [(P, '[softly] ')]},
        'b3': {'fr': [], 'en': []},
        'b4': {'fr': [('Il réserve', '[excited] Il réserve'), ('En trois secondes', '[mischievously] En trois secondes')],
               'en': [('They book', '[excited] They book'), ('All in three', '[mischievously] All in three')]},
        'b5': {'fr': [(P, '[mischievously] ')], 'en': [(P, '[mischievously] ')]},
        'b6': {'fr': [(P, '[slowly] '), ("Et c'est vendu", "[softly] Et c'est vendu")], 'en': [(P, '[slowly] '), ("And it's sold", "[softly] And it's sold")]},
        'b7': {'fr': [('Rejoignez', '[warmly] Rejoignez')], 'en': [('Join', '[warmly] Join')]},
    },
    'reel-07-tour-produit': {
        'b1': {'fr': [(P, '[rushed] '), ('Et si tout', '[curious] Et si tout')], 'en': [(P, '[rushed] '), ('What if', '[curious] What if')]},
        'b2': {'fr': [('partout ailleurs', '[stress on next word] partout ailleurs')], 'en': [('everywhere else', '[stress on next word] everywhere else')]},
        'b3': {'fr': [('et zéro commission', '[excited] et zéro commission')], 'en': [('and zero commission', '[excited] and zero commission')]},
        'b4': {'fr': [('vous validez', '[deliberate] vous validez')], 'en': [('you decide', '[deliberate] you decide')]},
        'b5': {'fr': [(P, '[warmly] ')], 'en': [(P, '[warmly] ')]},
        'b6': {'fr': [], 'en': []},
        'b7': {'fr': [], 'en': []},
        'b8': {'fr': [(P, '[proudly] ')], 'en': [(P, '[proudly] ')]},
        'b9': {'fr': [('Faites grandir', '[pause] [warmly] Faites grandir')], 'en': [('Grow your', '[pause] [warmly] Grow your')]},
    },
    'reel-08-23h40': {
        'b1': {'fr': [(P, '[softly] '), ('et les voisins', '[mischievously] et les voisins')], 'en': [(P, '[softly] '), ('and so are', '[mischievously] and so are')]},
        'b2': {'fr': [(P, '[deliberate] ')], 'en': [(P, '[deliberate] ')]},
        'b3': {'fr': [('Deux minutes', '[softly] Deux minutes')], 'en': [('Two minutes', '[softly] Two minutes')]},
        'b4': {'fr': [(P, '[deliberate] ')], 'en': [(P, '[deliberate] ')]},
        'b5': {'fr': [(P, '[softly] '), ('Vous aussi', '[warmly] Vous aussi')], 'en': [(P, '[softly] '), ('And so do you', '[warmly] And so do you')]},
        'b6': {'fr': [('Rejoignez', '[warmly] Rejoignez')], 'en': [('Join', '[warmly] Join')]},
    },
    'reel-09-clim-en-panne': {
        'b1': {'fr': [(P, '[sighs] ')], 'en': [(P, '[sighs] ')]},
        'b2': {'fr': [(P, '[deliberate] ')], 'en': [(P, '[deliberate] ')]},
        'b3': {'fr': [(P, '[softly] '), ('remboursés', '[warmly] remboursés')], 'en': [(P, '[softly] '), ('in one click', '[warmly] in one click')]},
        'b4': {'fr': [('Rien ne part', '[deliberate] Rien ne part')], 'en': [('Nothing goes out', '[deliberate] Nothing goes out')]},
        'b5': {'fr': [(P, '[softly] '), ('pas un mauvais', '[warmly] pas un mauvais')], 'en': [(P, '[softly] '), ('not a bad', '[warmly] not a bad')]},
        'b6': {'fr': [('Rejoignez', '[warmly] Rejoignez')], 'en': [('Join', '[warmly] Join')]},
    },
    'reel-10-apres-le-depart': {
        'b1': {'fr': [], 'en': []},
        'b2': {'fr': [("Sur l'une", "[worried] Sur l'une")], 'en': [('One of them', '[worried] One of them')]},
        'b3': {'fr': [('Jamais plus', '[deliberate] Jamais plus')], 'en': [('Never more', '[deliberate] Never more')]},
        'b4': {'fr': [], 'en': []},
        'b5': {'fr': [(P, '[softly] '), ("Rien n", "[warmly] Rien n")], 'en': [(P, '[softly] '), ('Nothing forgotten', '[warmly] Nothing forgotten')]},
        'b6': {'fr': [('Rejoignez', '[warmly] Rejoignez')], 'en': [('Join', '[warmly] Join')]},
    },
    'reel-11-fiches-de-police': {
        'b1': {'fr': [(P, '[deliberate] ')], 'en': [(P, '[deliberate] ')]},
        'b2': {'fr': [], 'en': []},
        'b3': {'fr': [('Le même geste', '[deliberate] Le même geste')], 'en': [('One gesture', '[deliberate] One gesture')]},
        'b4': {'fr': [], 'en': []},
        'b5': {'fr': [(P, '[softly] '), ('Un seul outil', '[warmly] Un seul outil')], 'en': [(P, '[softly] '), ('One single tool', '[warmly] One single tool')]},
        'b6': {'fr': [('Rejoignez', '[warmly] Rejoignez')], 'en': [('Join', '[warmly] Join')]},
    },
    'reel-12-deux-nuits-de-plus': {
        'b1': {'fr': [(P, '[softly] '), ('et vous demande', '[mischievously] et vous demande')], 'en': [(P, '[softly] '), ('and asks', '[mischievously] and asks')]},
        'b2': {'fr': [(P, '[deliberate] ')], 'en': [(P, '[deliberate] ')]},
        'b3': {'fr': [], 'en': []},
        'b4': {'fr': [], 'en': []},
        'b5': {'fr': [(P, '[softly] '), ('Zéro recalcul', '[warmly] Zéro recalcul')], 'en': [(P, '[softly] '), ('Zero recalculating', '[warmly] Zero recalculating')]},
        'b6': {'fr': [('Rejoignez', '[warmly] Rejoignez')], 'en': [('Join', '[warmly] Join')]},
    },
    'reel-13-direct-sans-risque': {
        'b1': {'fr': [('Mais ce soir', '[sighs] Mais ce soir')], 'en': [('But tonight', '[sighs] But tonight')]},
        'b2': {'fr': [('Et la réservation revient', '[excited] Et la réservation revient')], 'en': [('And the booking', '[excited] And the booking')]},
        'b3': {'fr': [(P, '[curious] ')], 'en': [(P, '[curious] ')]},
        'b4': {'fr': [('Vous le déposez', '[deliberate] Vous le déposez')], 'en': [('You submit', '[deliberate] You submit')]},
        'b5': {'fr': [(P, '[softly] '), ('Sans les risques', '[warmly] Sans les risques')], 'en': [(P, '[softly] '), ('Without the risks', '[warmly] Without the risks')]},
        'b6': {'fr': [('Rejoignez', '[warmly] Rejoignez')], 'en': [('Join', '[warmly] Join')]},
    },
    'reel-14-proprietaire-inquiet': {
        'b1': {'fr': [('un appel', '[worried] un appel')], 'en': [('one call', '[worried] one call')]},
        'b2': {'fr': [(P, '[deliberate] ')], 'en': [(P, '[deliberate] ')]},
        'b3': {'fr': [], 'en': []},
        'b4': {'fr': [('Sans rien', '[warmly] Sans rien')], 'en': [('Nothing to re-type', '[warmly] Nothing to re-type')]},
        'b5': {'fr': [(P, '[softly] '), ('Pas inquiets', '[warmly] Pas inquiets')], 'en': [(P, '[softly] '), ('Not worried', '[warmly] Not worried')]},
        'b6': {'fr': [('Rejoignez', '[warmly] Rejoignez')], 'en': [('Join', '[warmly] Join')]},
    },
    'reel-15-cartes-de-la-journee': {
        'b1': {'fr': [(P, '[curious] ')], 'en': [(P, '[curious] ')]},
        'b2': {'fr': [], 'en': []},
        'b3': {'fr': [], 'en': []},
        'b4': {'fr': [], 'en': []},
        'b5': {'fr': [(P, '[softly] '), ('Et entre deux', '[warmly] Et entre deux')], 'en': [(P, '[softly] '), ('And between', '[warmly] And between')]},
        'b6': {'fr': [('et les remboursements', '[deliberate] et les remboursements'), ('À vous de', '[warmly] À vous de')], 'en': [('and refunds', '[deliberate] and refunds'), ('You set', '[warmly] You set')]},
        'b7': {'fr': [(P, '[deliberate] '), ("Bètli s'occupe", "[warmly] Bètli s'occupe")], 'en': [(P, '[deliberate] '), ('Betly handles', '[warmly] Betly handles')]},
        'b8': {'fr': [('Rejoignez', '[warmly] Rejoignez')], 'en': [('Join', '[warmly] Join')]},
    },
    # Série prestataires (Reels 16-18, 29/09) : Eleven v4, Paul K, direction « keynote » (balises en
    # langage naturel, empilées) ; « [pause] » en tête des répliques 2 à 6 pour que la découpe au
    # silence retrouve les fins de réplique. Anglais à venir.
    'reel-16-votre-savoir-faire': {
        'b1': {'fr': [(P, '[confident, crisp, a touch of urgency] '), ('les hôtes', '[beat] les hôtes')]},
        'b2': {'fr': [(P, '[pause] [bright, enthusiastic] '), ('et à leurs', '[beat] et à leurs')]},
        'b3': {'fr': [(P, '[pause] [quick, light, playful pace] ')]},
        'b4': {'fr': [(P, '[pause] [confident, emphatic] ')]},
        'b5': {'fr': [(P, '[pause] [bold, proud] '), ('… Sa place', '[beat] Sa place')]},
        'b6': {'fr': [(P, '[pause] [warm but upbeat] ')]},
    },
    'reel-17-la-mission-cote-prestataire': {
        'b1': {'fr': [(P, '[confident, crisp, a touch of urgency] '), ("et l'arrivée", "[beat] et l'arrivée")]},
        'b2': {'fr': [(P, '[pause] [energetic] ')]},
        'b3': {'fr': [(P, '[pause] [quick, light, playful pace] '), ("et l'hôte", "[with a smile] et l'hôte")]},
        'b4': {'fr': [(P, '[pause] [confident, emphatic] ')]},
        'b5': {'fr': [(P, '[pause] [bold, proud] '), ('… Un travail', '[beat] Un travail')]},
        'b6': {'fr': [(P, '[pause] [warm but upbeat] ')]},
    },
    'reel-18-six-familles-de-metiers': {
        'b1': {'fr': [(P, '[confident, crisp, a touch of urgency] ')]},
        'b2': {'fr': [(P, '[pause] [quick, light, playful pace] ')]},
        'b3': {'fr': [(P, '[pause] [quick, light, playful pace] ')]},
        'b4': {'fr': [(P, '[pause] [confident, emphatic] '), ('et pour leurs', '[beat] et pour leurs')]},
        'b5': {'fr': [(P, '[pause] [bold, proud] '), ('avec votre', '[beat] avec votre')]},
        'b6': {'fr': [(P, '[pause] [warm but upbeat] ')]},
    },
}


def apply(reel, bid, lang, text, warn):
    """Applique les balises d'une réplique ; signale les ancres introuvables."""
    for anchor, repl in TAGS.get(reel, {}).get(bid, {}).get(lang, []):
        if anchor == P:
            text = repl + text
        elif anchor in text:
            text = text.replace(anchor, repl, 1)
        else:
            warn(f'{reel} {bid} {lang} : ancre « {anchor} » absente, balise ignorée')
    return text
