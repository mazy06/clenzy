// Textes à l'écran du Reel 11 « Les fiches de police ». Les trois pays apparaissent dans toutes
// les langues (c'est le sujet) ; le voyageur, la devise de la taxe et la facture suivent la langue.
// Libellés : actionVerbs « Télédéclarer », « Marquer déclarée » ; GuestDeclaration (livret).
// Transmission RÉELLE en France (Chekin), ANTICIPÉE au Maroc (DGSN) et en Arabie saoudite
// (Shomoos) — voir BESOINS-ET-SERVICES.md §10. Sous-titres réécrits par align-vo.py.
window.STRINGS = {
  fr: {
    dir: 'ltr', illustrative: 'Scène illustrative',
    intro: { kicker: 'Déclaration des voyageurs', rows: [['Maroc', 'DGSN · fiche d’identification'], ['France', 'Fiche individuelle de police'], ['Arabie saoudite', 'Shomoos · شموس']] },
    form: {
      head: 'Riad Nour · Livret d’accueil', title: 'Fiche de police', done: 'Complétée à 100 %',
      fields: [['Nom', 'Sara Benali', true], ['Nationalité', 'Française', true], ['Pièce d’identité', 'Passeport · 14AB52…', false], ['Arrivée', '12 oct. · 15:00', true]],
      pre: 'Pré-rempli', send: 'Envoyer ma fiche',
    },
    win: {
      title: 'Conformité', tabs: ['Maroc', 'France', 'Arabie saoudite'],
      guest: ['Voyageur', 'Sara Benali'], stay: ['Séjour', '12 → 16 oct.'], doc: ['Pièce', 'Passeport'],
      auth: ['DGSN · fiche d’identification', 'Fiche individuelle · via Chekin', 'Shomoos · enregistrement'],
      declare: 'Télédéclarer', stamps: ['Déclaré', 'Transmise', 'Enregistré'],
    },
    tax: {
      agent: 'Agent Conformité', tag: 'Taxe de séjour', wait: 'En attente', done: 'Fait',
      title: 'Déclaration du 3ᵉ trimestre · Riad Nour',
      copy: '412 nuitées, 8 240 MAD de taxe de séjour à déclarer.',
      filed: 'Marquer déclarée', see: 'Voir le détail', doneText: 'Déclarée le 10 oct. · référence tracée',
    },
    tiles: [['receipt', 'Taxe de séjour', 'calculée à chaque réservation'], ['receipttext', 'Factures ZATCA', 'conformes, chaînées'], ['badge', 'Licence NTMP', 'reliée au logement'], ['shield', 'RGPD', 'effacement sur demande']],
    promise: ['Une obligation par pays.', 'Un seul outil.'],
    cta: 'Rejoignez le pré-lancement',
    facts: [['MA · FR · SA', 'déclarations'], ['Livret', 'fiche pré-remplie'], ['AR · FR · EN', '']],
    subtitles: [
      { from: 0.35, to: 2.55, text: "Chaque voyageur doit être déclaré aux autorités.", em: "" },
      { from: 2.57, to: 4.76, text: "Et d'un pays à l'autre, ", em: "les règles changent." },
      { from: 4.95, to: 8.05, text: "Avec Baitly, ", em: "le voyageur remplit sa fiche depuis son livret d'accueil," },
      { from: 8.07, to: 10.72, text: "avant même d'arriver. ", em: "Ce qu'on sait déjà est pré-rempli." },
      { from: 10.92, to: 12.78, text: "Au Maroc, ", em: "la fiche part à la DGSN." },
      { from: 12.8, to: 15.05, text: "En France, ", em: "elle est transmise via Chekin." },
      { from: 15.07, to: 18.31, text: "En Arabie saoudite, ", em: "le voyageur est enregistré sur Shomoos." },
      { from: 18.33, to: 19.9, text: "Le même geste, ", em: "trois pays." },
      { from: 19.92, to: 23.43, text: "Autour, tout suit : ", em: "la taxe de séjour calculée à chaque réservation," },
      { from: 23.45, to: 25.82, text: "les factures conformes ZATCA, ", em: "la licence NTMP," },
      { from: 25.84, to: 28.58, text: "et l'effacement RGPD quand un voyageur le demande.", em: "" },
    ],
  },
  en: {
    dir: 'ltr', illustrative: 'Illustrative scene',
    intro: { kicker: 'Guest registration', rows: [['Morocco', 'DGSN · identification form'], ['France', 'Individual police form'], ['Saudi Arabia', 'Shomoos · شموس']] },
    form: {
      head: 'Nakheel Chalet · Welcome guide', title: 'Police form', done: '100% complete',
      fields: [['Name', 'Sara Benali', true], ['Nationality', 'French', true], ['ID document', 'Passport · 14AB52…', false], ['Arrival', 'Oct 12 · 3:00 pm', true]],
      pre: 'Pre-filled', send: 'Send my form',
    },
    win: {
      title: 'Compliance', tabs: ['Morocco', 'France', 'Saudi Arabia'],
      guest: ['Guest', 'Sara Benali'], stay: ['Stay', 'Oct 12 → 16'], doc: ['Document', 'Passport'],
      auth: ['DGSN · identification form', 'Individual form · via Chekin', 'Shomoos · registration'],
      declare: 'Submit', stamps: ['Declared', 'Sent', 'Registered'],
    },
    tax: {
      agent: 'Compliance agent', tag: 'Tourism fee', wait: 'Pending', done: 'Done',
      title: 'Q3 filing · Nakheel Chalet',
      copy: '412 nights, SAR 6,180 of tourism fees to file.',
      filed: 'Mark as filed', see: 'See details', doneText: 'Filed on Oct 10 · reference logged',
    },
    tiles: [['receipt', 'Tourist tax', 'calculated on every booking'], ['receipttext', 'ZATCA invoices', 'compliant, chained'], ['badge', 'NTMP licence', 'linked to the property'], ['shield', 'GDPR', 'erasure on request']],
    promise: ['One rule per country.', 'One single tool.'],
    cta: 'Join the pre-launch',
    facts: [['MA · FR · SA', 'registrations'], ['Guide', 'pre-filled form'], ['AR · FR · EN', '']],
    subtitles: [
      { from: 0.35, to: 3.36, text: "Every guest has to be declared to the authorities.", em: "" },
      { from: 3.38, to: 6.6, text: "And from one country to the next, ", em: "the rules change." },
      { from: 6.62, to: 9.92, text: "With Baitly, ", em: "guests fill in their form from the welcome guide," },
      { from: 9.94, to: 13.5, text: "before they even arrive. ", em: "Whatever we already know is pre-filled." },
      { from: 13.52, to: 16.59, text: "In Morocco, ", em: "the form goes to the DGSN." },
      { from: 16.61, to: 19.52, text: "In France, ", em: "it's sent through Chekin." },
      { from: 19.54, to: 23.76, text: "In Saudi Arabia, ", em: "the guest is registered on Shomoos." },
      { from: 23.78, to: 26.27, text: "One gesture, ", em: "three countries." },
      { from: 26.29, to: 30.11, text: "And everything around it follows: tourist tax on every booking,", em: "" },
      { from: 30.13, to: 32.74, text: "ZATCA-compliant invoices, ", em: "the NTMP licence," },
      { from: 32.76, to: 35.04, text: "and GDPR erasure when a guest asks.", em: "" },
    ],
  },
};
