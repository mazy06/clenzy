// Textes à l'écran du Reel 14 « Le propriétaire inquiet », par langue. FR : Maroc (MAD) ;
// EN : Arabie saoudite (SAR). Libellés repris du produit (actionRegistry : « Informer le
// propriétaire des revenus » / « Envoyer la note » ; OWNER_PAYOUT : « Approuver », le virement
// reste bancaire). Sous-titres réécrits par align-vo.py.
window.STRINGS = {
  fr: {
    dir: 'ltr', illustrative: 'Scène illustrative',
    kpi: { title: 'Villa Palmeraie · octobre', tiles: [['Revenus', '6 420 MAD', '−18 %'], ['Occupation', '61 %', '−9 pts'], ['Prix moyen', '780 MAD', '−4 %']] },
    owner: { name: 'Karim Idrissi', role: 'Propriétaire · Villa Palmeraie', call: 'Appel entrant…' },
    note: {
      agent: 'Agent Propriétaire', tag: 'Relation propriétaire', wait: 'En attente', done: 'Fait',
      title: 'Recul des revenus · Villa Palmeraie',
      copy: 'Note factuelle, recalculée à l’envoi, avec le relevé détaillé en lien.',
      grid: [['Octobre 2025', '7 830 MAD'], ['Octobre 2026', '6 420 MAD'], ['Écart', '−18 %']],
      preview: 'Bonjour Karim, voici le point sur octobre : 6 420 MAD de revenus, contre 7 830 MAD l’an dernier. Le détail est dans votre relevé mensuel.',
      send: 'Envoyer la note', edit: 'Modifier', dismiss: 'Ignorer', doneText: 'Note envoyée à Karim · 09:05',
    },
    portal: {
      head: 'Espace propriétaire', prop: 'Villa Palmeraie', sumLabel: 'Net à reverser · octobre', section: 'Relevés mensuels',
      months: ['Juillet 2026', 'Août 2026', 'Septembre 2026', 'Octobre 2026'], net: ['6 912 MAD', '7 344 MAD', '5 890 MAD', '5 136 MAD'],
      reply: 'Merci pour la transparence, c’est très clair.', sent: 'Téléchargé',
    },
    payout: {
      agent: 'Agent Propriétaire', tag: 'Reversement', wait: 'En attente', done: 'Fait',
      title: 'Reversement de Karim · octobre',
      rows: [['Revenus des séjours', '6 420 MAD'], ['Commission · 20 %', '−1 284 MAD'], ['Net propriétaire', '5 136 MAD']],
      approve: 'Approuver', statement: 'Voir le relevé', doneText: 'Approuvé · virement bancaire à émettre',
    },
    promise: ['Des propriétaires informés.', 'Pas inquiets.'],
    cta: 'Rejoignez le pré-lancement',
    facts: [['Relevés', 'mensuels, sans ressaisie'], ['N−1', 'comparaison automatique'], ['AR · FR · EN', '']],
    subtitles: [
      { from: 0.35, to: 3.16, text: "Pour une conciergerie, ", em: "il y a un appel qu'on redoute :" },
      { from: 3.18, to: 5.7, text: "le propriétaire qui voit ses revenus baisser.", em: "" },
      { from: 5.9, to: 9.21, text: "Baitly le repère avant lui, ", em: "et prépare une note factuelle :" },
      { from: 9.23, to: 11.76, text: "les revenus du mois, ", em: "comparés à l'an dernier." },
      { from: 11.78, to: 13.73, text: "Vous la relisez, ", em: "vous l'envoyez." },
      { from: 13.93, to: 17.57, text: "Le propriétaire reçoit l'explication avant même de poser la question,", em: "" },
      { from: 17.59, to: 19.01, text: "avec son relevé du mois.", em: "" },
      { from: 19.21, to: 21.36, text: "Et son reversement, ", em: "calculé à partir des séjours," },
      { from: 21.38, to: 23.44, text: "s'approuve en un clic. ", em: "Sans rien ressaisir." },
    ],
  },
  en: {
    dir: 'ltr', illustrative: 'Illustrative scene',
    kpi: { title: 'Diriyah Villa · October', tiles: [['Income', 'SAR 4,280', '−18%'], ['Occupancy', '61%', '−9 pts'], ['Average rate', 'SAR 520', '−4%']] },
    owner: { name: 'Faisal Al-Otaibi', role: 'Owner · Diriyah Villa', call: 'Incoming call…' },
    note: {
      agent: 'Owner agent', tag: 'Owner relations', wait: 'Pending', done: 'Done',
      title: 'Income dip · Diriyah Villa',
      copy: 'Factual note, recalculated when sent, with the detailed statement linked.',
      grid: [['October 2025', 'SAR 5,220'], ['October 2026', 'SAR 4,280'], ['Change', '−18%']],
      preview: 'Hello Faisal, here is where October stands: SAR 4,280 in income, versus SAR 5,220 last year. The details are in your monthly statement.',
      send: 'Send the note', edit: 'Edit', dismiss: 'Ignore', doneText: 'Note sent to Faisal · 09:05',
    },
    portal: {
      head: 'Owner portal', prop: 'Diriyah Villa', sumLabel: 'Net to pay out · October', section: 'Monthly statements',
      months: ['July 2026', 'August 2026', 'September 2026', 'October 2026'], net: ['SAR 4,608', 'SAR 4,896', 'SAR 3,927', 'SAR 3,424'],
      reply: 'Thanks for being so transparent, that’s very clear.', sent: 'Downloaded',
    },
    payout: {
      agent: 'Owner agent', tag: 'Payout', wait: 'Pending', done: 'Done',
      title: 'Faisal’s payout · October',
      rows: [['Stay income', 'SAR 4,280'], ['Commission · 20%', '−SAR 856'], ['Owner net', 'SAR 3,424']],
      approve: 'Approve', statement: 'See statement', doneText: 'Approved · bank transfer to issue',
    },
    promise: ['Owners informed.', 'Not worried.'],
    cta: 'Join the pre-launch',
    facts: [['Statements', 'monthly, no re-typing'], ['Year on year', 'automatic comparison'], ['AR · FR · EN', '']],
    subtitles: [
      { from: 0.35, to: 1.85, text: "For a property manager,", em: "" },
      { from: 1.87, to: 6.33, text: "there's one call you dread: the owner who sees their income drop.", em: "" },
      { from: 6.35, to: 8.22, text: "Baitly spots it before he does,", em: "" },
      { from: 8.24, to: 11.21, text: "and prepares a factual note: this month's income,", em: "" },
      { from: 11.23, to: 12.68, text: "compared with last year.", em: "" },
      { from: 12.7, to: 14.35, text: "You read it, ", em: "you send it." },
      { from: 14.37, to: 17.04, text: "The owner gets the explanation before he even asks,", em: "" },
      { from: 17.06, to: 18.95, text: "along with his monthly statement.", em: "" },
      { from: 19.15, to: 21.81, text: "And his payout, ", em: "calculated from the stays," },
      { from: 21.83, to: 24.84, text: "is approved in one click. ", em: "Nothing to re-type." },
    ],
  },
};
