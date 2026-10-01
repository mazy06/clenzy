// Baitly Académie · Épisode 11 « La checklist sécurité du logement » · textes à l'écran.
// Obligations FRANÇAISES vérifiées sur service-public.gouv.fr le 01/10/2026 :
// - détecteur de fumée (fiche F19950, vérifiée le 13/05/2026) : au moins un par logement, marquage CE + NF EN 14604 ;
//   location saisonnière/meublée : le propriétaire installe, entretient, renouvelle (CCH L142-1 à L142-4, R142-1 à R142-5) ;
// - piscine (fiche F1722, vérifiée le 13/02/2026) : piscines privées enterrées non couvertes, un dispositif parmi
//   barrière NF P90-306, alarme NF P90-307, couverture NF P90-308, abri NF P90-309 ; en location saisonnière, en place
//   avant l'arrivée ; amende de 45 000 € (CCH L134-10, D134-51 à D134-54, L183-13).
// Maroc, Arabie saoudite : NON vérifiés, renvoyés aux autorités locales. Le reste = recommandations, pas des obligations.
// Phrase produit vérifiée : numéro utile + consignes dans le livret (PracticalInfo.emergencyContact), consignes de ménage
// par logement (Property.cleaningNotes). Photos : ../academie-shared/photos/SOURCES.md. Sous-titres : align-vo.py.
window.STRINGS = {
  fr: {
    dir: 'ltr', illustrative: 'Exemple',
    ep: '11', theme: 'Sécurité', trap: 'Piège',
    q: ['La sécurité du logement,', 'point par point.'],
    hook: {
      price: 'Quelques dizaines d’euros', fire: 'Un incendie : pas de prix',
      cats: [['shield', 'L’obligatoire'], ['ccheck', 'Le recommandé'], ['clipcheck', 'À vérifier à chaque séjour']],
    },
    heads: [
      ['L’obligatoire', 'En France · vérifié le 01/10/2026'],
      ['Le recommandé', 'Ce que la loi n’impose pas, mais qui protège'],
      ['Les consignes', 'Ce que le voyageur doit trouver sans chercher'],
      ['Mise en pratique', 'À chaque ménage, 3 vérifications'],
    ],
    smoke: {
      title: 'Détecteur de fumée',
      rows: [['house', 'Au moins un par logement'], ['badge', 'Marqué CE · norme NF EN 14604'], ['owner', 'Location saisonnière : le propriétaire installe, entretient, remplace']],
      src: 'Source : service-public.gouv.fr (F19950) · CCH art. L142-1 à L142-4',
    },
    pool: {
      photo: 'piscine', label: 'Piscine enterrée, non couverte',
      devices: [['Barrière', 'NF P90-306'], ['Alarme', 'NF P90-307'], ['Couverture', 'NF P90-308'], ['Abri', 'NF P90-309']],
      before: 'En place avant l’arrivée du voyageur', fine: 'Amende : 45 000 €',
      src: 'Source : service-public.gouv.fr (F1722) · CCH art. L134-10',
    },
    places: {
      rows: [['France', 'Vérifié pour cet épisode', true], ['Maroc', 'Règles locales à vérifier', false], ['Arabie saoudite', 'Règles locales à vérifier', false], ['Votre ville', 'Parfois des règles en plus', false]],
      check: 'Vérifiez auprès des autorités locales avant d’accueillir',
    },
    reco: [
      ['wind', 'Détecteur de monoxyde de carbone', 'Chaudière, poêle ou cheminée'],
      ['flame', 'Extincteur', 'Dans la cuisine'],
      ['layers', 'Couverture anti-feu', 'Près des plaques'],
      ['firstaid', 'Trousse de premiers secours', 'Complète, à portée'],
      ['flashlight', 'Lampe torche', 'En cas de coupure'],
    ],
    guide: {
      title: 'Livret d’accueil · Sécurité',
      rows: [
        ['flame', 'Extincteur', 'Placard de l’entrée'],
        ['drops', 'Couper l’eau', 'Vanne sous l’évier'],
        ['flame', 'Couper le gaz', 'Robinet derrière la cuisinière'],
        ['zap', 'Couper l’électricité', 'Tableau dans l’entrée'],
        ['phone', 'Urgence', '112 en Europe'],
        ['call', 'Votre numéro', 'Pour tout le reste'],
      ],
    },
    checks: {
      photo: 'menage-escalier', label: 'Checklist de ménage · sécurité',
      items: ['Bouton test du détecteur', 'Extincteur et couverture à leur place', 'Trousse complétée si elle a servi'],
      time: '30 secondes à chaque séjour',
    },
    log: {
      title: 'Registre de sécurité',
      rows: [['cal', 'Date d’achat de chaque équipement'], ['clipcheck', 'Contrôle de l’extincteur'], ['zap', 'Remplacement des piles']],
      proof: 'Votre preuve que tout était en ordre',
    },
    recap: {
      title: 'À retenir',
      rows: [
        ['shield', 'L’obligatoire d’abord', 'Détecteur de fumée, sécurité de la piscine'],
        ['ccheck', 'Le recommandé ensuite', 'Monoxyde, extincteur, couverture, trousse, lampe'],
        ['bookopen', 'Des consignes claires', 'Équipements, coupures, numéros'],
        ['clipcheck', '3 vérifications à chaque ménage', 'Et un registre à jour'],
      ],
      app: 'Dans Baitly : votre numéro utile et vos consignes dans le livret, vos vérifications dans les consignes de ménage',
      src: 'Sources : service-public.gouv.fr (F19950, F1722) · à jour au 01/10/2026 · information générale, pas un conseil juridique',
    },
    cta: 'Découvrir Baitly',
    facts: [['Baitly Académie', 'le métier expliqué simplement'], ['Épisode 11', 'la checklist sécurité']],
    subtitles: [
      { from: 0.35, to: 3.16, text: "Un détecteur de fumée coûte quelques dizaines d'euros.", em: "" },
      { from: 3.18, to: 6.1, text: "Un incendie dans un logement loué, lui, ", em: "n'a pas de prix." },
      { from: 6.12, to: 9.82, text: "La sécurité, ", em: "c'est la partie du métier qu'on espère ne jamais utiliser." },
      { from: 9.84, to: 12.97, text: "Voyons la checklist complète : l'obligatoire, ", em: "le recommandé," },
      { from: 12.99, to: 15.34, text: "et ce qu'il faut vérifier à chaque séjour.", em: "" },
      { from: 16.04, to: 17.85, text: "Première notion : ", em: "l'obligatoire." },
      { from: 17.87, to: 21.78, text: "En France, ", em: "chaque logement doit avoir au moins un détecteur de fumée," },
      { from: 21.8, to: 24.35, text: "marqué CE et conforme à la norme NF EN 14604.", em: "" },
      { from: 24.37, to: 27.89, text: "En location saisonnière, ", em: "c'est au propriétaire de l'installer," },
      { from: 27.91, to: 30.06, text: "de l'entretenir et de le remplacer.", em: "" },
      { from: 30.41, to: 31.66, text: "Vous avez une piscine ?", em: "" },
      { from: 31.68, to: 33.71, text: "Si elle est enterrée et non couverte,", em: "" },
      { from: 33.73, to: 36.87, text: "elle doit avoir un dispositif de sécurité : ", em: "une barrière," },
      { from: 36.89, to: 38.97, text: "une alarme, ", em: "une couverture ou un abri," },
      { from: 38.99, to: 41.02, text: "installé avant l'arrivée du voyageur.", em: "" },
      { from: 41.04, to: 43.58, text: "Sans lui, ", em: "l'amende peut atteindre 45 000 €." },
      { from: 43.93, to: 46.67, text: "Le piège : ", em: "croire que les règles sont les mêmes partout." },
      { from: 46.69, to: 48.59, text: "Au Maroc, en Arabie saoudite, ", em: "ailleurs," },
      { from: 48.61, to: 51.1, text: "chaque pays fixe les siennes, ", em: "parfois chaque ville." },
      { from: 51.12, to: 54.28, text: "Vérifiez-les auprès des autorités locales avant d'accueillir.", em: "" },
      { from: 54.98, to: 56.54, text: "Deuxième notion : ", em: "le recommandé." },
      { from: 56.56, to: 59.75, text: "Un détecteur de monoxyde de carbone, ", em: "dès qu'il y a une chaudière," },
      { from: 59.77, to: 60.98, text: "un poêle ou une cheminée.", em: "" },
      { from: 61.0, to: 63.8, text: "Un extincteur et une couverture anti-feu dans la cuisine.", em: "" },
      { from: 63.82, to: 66.59, text: "Une trousse de premiers secours, ", em: "et une lampe torche." },
      { from: 67.29, to: 69.04, text: "Troisième notion : ", em: "les consignes." },
      { from: 69.06, to: 72.32, text: "Le voyageur doit savoir, sans chercher : ", em: "où est l'extincteur," },
      { from: 72.34, to: 74.79, text: "comment couper l'eau, ", em: "le gaz et l'électricité," },
      { from: 74.81, to: 76.03, text: "et quel numéro appeler.", em: "" },
      { from: 76.05, to: 79.16, text: "En Europe, le 112. Et votre numéro, ", em: "pour tout le reste." },
      { from: 79.86, to: 83.17, text: "Mise en pratique : à chaque ménage, ", em: "3 vérifications de plus." },
      { from: 83.19, to: 85.4, text: "Appuyer sur le bouton test du détecteur.", em: "" },
      { from: 85.42, to: 88.06, text: "Voir l'extincteur et la couverture à leur place.", em: "" },
      { from: 88.08, to: 91.96, text: "Compléter la trousse si elle a servi. 30 secondes… ", em: "à chaque séjour." },
      { from: 92.31, to: 94.75, text: "Et notez tout : ", em: "la date d'achat de chaque équipement," },
      { from: 94.77, to: 97.3, text: "le contrôle de l'extincteur, ", em: "le remplacement des piles." },
      { from: 97.32, to: 100.53, text: "Le jour d'un problème, ", em: "c'est votre preuve que tout était en ordre." },
      { from: 101.23, to: 103.05, text: "À retenir : ", em: "l'obligatoire d'abord," },
      { from: 103.07, to: 105.87, text: "le détecteur de fumée et la sécurité de la piscine ;", em: "" },
      { from: 105.89, to: 109.34, text: "le recommandé ensuite ; des consignes claires pour le voyageur ;", em: "" },
      { from: 109.36, to: 111.23, text: "et 3 vérifications à chaque ménage.", em: "" },
      { from: 111.25, to: 115.56, text: "Dans Baitly, ", em: "votre livret d'accueil affiche votre numéro utile et vos consignes," },
      { from: 115.58, to: 118.27, text: "et chaque logement garde ses consignes de ménage :", em: "" },
      { from: 118.29, to: 120.5, text: "notez-y vos vérifications de sécurité.", em: "" },
    ],
  },
};
