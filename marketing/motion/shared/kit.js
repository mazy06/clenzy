/*
  Baitly · Motion design · kit partagé des Reels (à partir du Reel 02).

  À quoi sert ce fichier : les briques communes à toutes les vidéos, pour que chaque
  Reel ne contienne que sa mise en scène.
    - langue (FR / EN / AR, arabe de droite à gauche) et points de synchro voix/image ;
    - temps et courbes (ease-out-quint du brand book), fondus, titres mot à mot ;
    - icônes Lucide, construction du DOM SANS innerHTML (contenu statique) ;
    - planning selon les règles « 05 bis » (briques par statut, interventions, repli) ;
    - téléphone et écran verrouillé, carte d'agent compacte ;
    - sous-titres, tap, curseur, écran de fin (logo animé, CTA, faits) ;
    - aperçu temps réel dans le navigateur (le rendu MP4 appelle renderAt(t) lui-même).
  Utilisation : dans index.html, charger timeline.js, i18n.js, puis ce fichier, puis
  `const K = BaitlyKit.init({ strings: STRINGS, timeline: TIMELINE })`.
*/
(function () {
  const ICONS = {
    chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    check: { d: '<path d="M20 6 9 17l-5-5"/>', sw: 3 },
    x: { d: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', sw: 2.6 },
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    broom: { d: '<path d="m16 22-1-4"/><path d="M19 14a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2h-3a1 1 0 0 1-1-1V4a2 2 0 0 0-4 0v5a1 1 0 0 1-1 1H6a2 2 0 0 0-2 2v1a1 1 0 0 0 1 1"/><path d="M5 14h14l1.97 6.77A1 1 0 0 1 20 22H4a1 1 0 0 1-.97-1.23z" fill="currentColor"/><path d="m8 22 1-4"/>', sw: 2.2 },
    wrench: { d: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" fill="currentColor" stroke="none"/>' },
    trend: '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
    bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
    star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    bank: '<path d="M10 18v-7"/><path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/>',
    megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    owner: '<path d="m16 11 2 2 4-4"/><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
    concierge: '<path d="M3 20a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1Z"/><path d="M20 16a8 8 0 1 0-16 0"/><path d="M12 4v4"/><path d="M10 4h4"/>',
    sync: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    wifioff: '<path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    idcard: '<path d="M16 10h2"/><path d="M16 14h2"/><path d="M6.17 15a3 3 0 0 1 5.66 0"/><circle cx="9" cy="11" r="2"/><rect x="2" y="5" width="20" height="14" rx="2"/>',
    zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    card: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
    cal: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    phone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
    door: '<path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14"/><path d="M2 20h20"/><path d="M14 12v.01"/>',
    user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    sheet: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>',
    key: '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
    call: '<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
    // Série 08-15 : icônes Lucide exactes (extraites de lucide-react v1.14, client/node_modules).
    volume: '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
    thermo: '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>',
    drops: '<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>',
    bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
    pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    sliders: '<path d="M10 5H3"/><path d="M12 19H3"/><path d="M14 3v4"/><path d="M16 17v4"/><path d="M21 12h-9"/><path d="M21 19h-5"/><path d="M21 5h-7"/><path d="M8 10v4"/><path d="M8 12H3"/>',
    banknote: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    snowflake: '<path d="m10 20-1.25-2.5L6 18"/><path d="M10 4 8.75 6.5 6 6"/><path d="m14 20 1.25-2.5L18 18"/><path d="m14 4 1.25 2.5L18 6"/><path d="m17 21-3-6h-4"/><path d="m17 3-3 6 1.5 3"/><path d="M2 12h6.5L10 9"/><path d="m20 10-1.5 2 1.5 2"/><path d="M22 12h-6.5L14 15"/><path d="m4 10 1.5 2L4 14"/><path d="m7 21 3-6-1.5-3"/><path d="m7 3 3 6h4"/>',
    percent: '<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    package: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/>',
    bed: '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/>',
    camera: '<path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"/><circle cx="12" cy="13" r="3"/>',
    gavel: '<path d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3l8.384-8.381"/><path d="m16 16 6-6"/><path d="m21.5 10.5-8-8"/><path d="m8 8 6-6"/><path d="m8.5 7.5 8 8"/>',
    layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
    badge: '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
    hourglass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
    filecheck: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="m9 15 2 2 4-4"/>',
    shieldalert: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    calx: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m14 14-4 4"/><path d="m10 14 4 4"/>',
    sparkles: '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    ccard: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
    trenddown: '<path d="M16 17h6v-6"/><path d="m22 17-8.5-8.5-5 5L2 7"/>',
    filetext: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    coins: '<path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17"/><path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/><path d="m2 16 6 6"/><circle cx="16" cy="9" r="2.9"/><circle cx="6" cy="5" r="3"/>',
    ccheck: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    talert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    msg: '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>',
    landmark: '<path d="M10 18v-7"/><path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/>',
    stamp: '<path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13"/><path d="M20 15.5a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1z"/><path d="M5 22h14"/>',
    minus: '<path d="M5 12h14"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    thermosun: '<path d="M12 2v2"/><path d="M12 8a4 4 0 0 0-1.645 7.647"/><path d="M2 12h2"/><path d="M20 14.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z"/><path d="m4.93 4.93 1.41 1.41"/><path d="m6.34 17.66-1.41 1.41"/>',
    shirt: '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
    clipcheck: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    receipttext: '<path d="M13 16H8"/><path d="M14 8H8"/><path d="M16 12H8"/><path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z"/>',
    mailcheck: '<path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><path d="m16 19 2 2 4-4"/>',
    userx: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" x2="22" y1="8" y2="13"/><line x1="22" x2="17" y1="8" y2="13"/>',
    idcard2: '<path d="M16 10h2"/><path d="M16 14h2"/><path d="M6.17 15a3 3 0 0 1 5.66 0"/><circle cx="9" cy="11" r="2"/><rect x="2" y="5" width="20" height="14" rx="2"/>',
    building: '<path d="M10 12h4"/><path d="M10 8h4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/>',
    calcheck: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="M4.929 4.929 19.07 19.071"/>',
    reply: '<path d="M20 18v-2a4 4 0 0 0-4-4H4"/><path d="m9 17-5-5 5-5"/>',
    bellring: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M22 8c0-2.3-.8-4.3-2-6"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/><path d="M4 2C2.8 3.7 2 5.7 2 8"/>',
    moonstar: '<path d="M18 5h4"/><path d="M20 3v4"/><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>',
    calplus: '<path d="M16 19h6"/><path d="M16 2v4"/><path d="M19 16v6"/><path d="M21 12.598V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8.5"/><path d="M3 10h18"/><path d="M8 2v4"/>',
    scale: '<path d="M12 3v18"/><path d="m19 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"/><path d="m5 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M7 21h10"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    // Académie 13-14 (Lucide, licence ISC) : ménage de rotation, questions des voyageurs.
    wifi: '<path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    coffee: '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
    arrowdown: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    logout: '<path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>',
    wind: '<path d="M12.8 19.6A2 2 0 1 0 14 16H2"/><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/><path d="M9.8 4.4A2 2 0 1 1 11 8H2"/>',
    sofa: '<path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M4 18v2"/><path d="M20 18v2"/><path d="M12 4v9"/>',
    glass: '<path d="M5.116 4.104A1 1 0 0 1 6.11 3h11.78a1 1 0 0 1 .994 1.105L17.19 20.21A2 2 0 0 1 15.2 22H8.8a2 2 0 0 1-2-1.79z"/><path d="M6 12a5 5 0 0 1 6 0 5 5 0 0 0 6 0"/>',
    route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
    bookopen: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    flashlight: '<path d="M18 6c0 2-2 2-2 4v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V10c0-2-2-2-2-4V2h12z"/><path d="M6 6h12"/><path d="M12 12h.01"/>',
    firstaid: '<path d="M12 11v4"/><path d="M14 13h-4"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M18 6v14"/><path d="M6 6v14"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
    house: { d: '<path d="M463 590.25 A30.25 30.25 0 0 1 463 529.75 A30.25 30.25 0 0 1 463 590.25 V710 A30 30 0 0 1 433 740 H368 A65 65 0 0 1 303 675 V441.8 A28 28 0 0 1 313.9 419.6 L478.2 294.1 A54 54 0 0 1 543.8 294.1 L708.1 419.6 A28 28 0 0 1 719 441.8 V675 A65 65 0 0 1 654 740 H589 A30 30 0 0 1 559 710 V590.25 A30.25 30.25 0 0 1 559 529.75 A30.25 30.25 0 0 1 559 590.25"/>', vb: '251 251 522 522', sw: 40 },
  };
  const HOUSE_D = 'M463 590.25 A30.25 30.25 0 0 1 463 529.75 A30.25 30.25 0 0 1 463 590.25 V710 A30 30 0 0 1 433 740 H368 A65 65 0 0 1 303 675 V441.8 A28 28 0 0 1 313.9 419.6 L478.2 294.1 A54 54 0 0 1 543.8 294.1 L708.1 419.6 A28 28 0 0 1 719 441.8 V675 A65 65 0 0 1 654 740 H589 A30 30 0 0 1 559 710 V590.25 A30.25 30.25 0 0 1 559 529.75 A30.25 30.25 0 0 1 559 590.25';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const parser = new DOMParser();

  function init({ strings, timeline }) {
    const TL = timeline;
    const LANG = window.__LANG__ || new URLSearchParams(location.search).get('lang') || 'fr';
    const T = strings[LANG] || strings.fr;
    const RTL = T.dir === 'rtl';
    const DIR = RTL ? -1 : 1;
    const SYNC = Object.assign({}, TL.sync || {}, ((TL.lang || {})[LANG] || {}));
    if (SYNC.duration) TL.duration = SYNC.duration;   // durée propre à la langue (scènes calées sur la voix)
    // Déformation du temps (align-vo, WARP) : temps réel de la voix → temps de l'animation, par
    // morceaux linéaires. Les moments synchronisés de la langue, calculés en temps réel sur les
    // mots, sont ramenés dans le temps de l'animation ; les sous-titres restent en temps réel.
    const WARPK = SYNC.warp || null;
    const toDesign = (t) => {
      if (!WARPK) return t;
      for (let k = 1; k < WARPK.length; k++) {
        const [r0, d0] = WARPK[k - 1], [r1, d1] = WARPK[k];
        if (t <= r1 || k === WARPK.length - 1) return d0 + (d1 - d0) * (t - r0) / (r1 - r0);
      }
      return t;
    };
    if (WARPK) {
      const L = (TL.lang || {})[LANG] || {};
      const map = (v) => (Array.isArray(v) ? v.map(map) : typeof v === 'number' ? toDesign(v) : v);
      for (const k in L) if (!['starts', 'warp', 'duration', 'slots'].includes(k)) SYNC[k] = map(L[k]);
    }
    const $ = (id) => document.getElementById(id);
    const stage = $('stage');
    document.documentElement.lang = LANG;
    stage.dir = T.dir;
    if (RTL) stage.classList.add('rtl');

    /* ---------- temps & courbes ---------- */
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 5);                 // ≈ cubic-bezier(0.22, 1, 0.36, 1)
    const easeIn = (x) => Math.pow(clamp(x), 3);
    const easeInOut = (x) => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
    const prog = (t, start, dur) => clamp((t - start) / dur);
    const lerp = (a, b, p) => a + (b - a) * p;
    const set = (el, css) => { for (const k in css) el.style[k] = css[k]; };
    /** Visibilité d'un plan : fondu d'entrée puis de sortie. */
    const vis = (t, a, b, fin = .35, fout = .35) => Math.min(easeOut(prog(t, a, fin)), 1 - easeIn(prog(t, b - fout, fout)));

    /* ---------- DOM ---------- */
    function h(tag, props = {}, ...kids) {
      const e = document.createElement(tag);
      for (const [k, v] of Object.entries(props)) {
        if (k === 'class') e.className = v;
        else if (k === 'style') e.style.cssText = v;
        else e.setAttribute(k, v);
      }
      for (const c of kids.flat()) if (c != null && c !== false && c !== '') e.append(c);
      return e;
    }
    function icon(name, size, cls) {
      const def = typeof ICONS[name] === 'string' ? { d: ICONS[name] } : ICONS[name];
      const sw = def.sw || 1.9;
      const doc = parser.parseFromString(
        `<svg xmlns="${SVGNS}" viewBox="${def.vb || '0 0 24 24'}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${def.d}</svg>`,
        'image/svg+xml');
      const svg = document.importNode(doc.documentElement, true);
      svg.setAttribute('width', size);
      svg.setAttribute('height', size);
      if (cls) svg.setAttribute('class', cls);
      return svg;
    }
    function words(el, text, em = []) {
      return text.split(' ').map((w, i, arr) => {
        const hit = em.some((e) => w.replace(/[.,،:…!?]/g, '').includes(e));
        const s = h('span', { class: 'w' + (hit ? ' accent' : '') }, w + (i < arr.length - 1 ? ' ' : ''));
        el.append(s);
        return s;
      });
    }
    function titleIn(ws, t, start, stagger = .06) {
      ws.forEach((w, i) => { const p = easeOut(prog(t, start + i * stagger, .45)); set(w, { opacity: p, transform: `translateY(${lerp(22, 0, p)}px)` }); });
    }
    /** Position d'un élément dans un ancêtre, hors transformations (offsets cumulés). */
    function posIn(el, root) {
      let x = 0, y = 0;
      for (let n = el; n && n !== root; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
      return { x, y };
    }
    const abs = (id, cls = '') => { const e = h('div', { id, class: ('abs ' + cls).trim() }); stage.append(e); return e; };

    /* ---------- sous-titres, tap, curseur ---------- */
    const subBox = h('div', { id: 'subBox' });
    const sub = h('div', { id: 'sub', class: 'abs' }, subBox);
    const tap = h('div', { id: 'tap', class: 'abs' });
    const cursor = document.createElementNS(SVGNS, 'svg');
    cursor.setAttribute('id', 'cursor'); cursor.setAttribute('class', 'abs'); cursor.setAttribute('viewBox', '0 0 24 24');
    const cp = document.createElementNS(SVGNS, 'path');
    cp.setAttribute('d', 'M4 2.5 19.5 12l-7 1.6-3.4 6.6z'); cp.setAttribute('fill', '#1B2A35'); cp.setAttribute('stroke', '#F7FBFC'); cp.setAttribute('stroke-width', '1.4'); cp.setAttribute('stroke-linejoin', 'round');
    cursor.append(cp);
    // Main de la landing (BaitlyDemoPointer) : gestes côté voyageur / visiteur (M09).
    const hand = h('div', { id: 'hand', class: 'abs' });
    hand.append(document.importNode(parser.parseFromString(
      `<svg xmlns="${SVGNS}" viewBox="0 0 24 24" width="72" height="72" fill="none" stroke="#263E48" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path fill="#F5F8F8" d="M6 14V4a2 2 0 0 1 4 0v5a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15Z"/><path d="M10 9v3M14 10v3M18 11v3"/></svg>`,
      'image/svg+xml').documentElement, true));
    const ripple = h('div', { id: 'ripple', class: 'abs' });
    let subKey = null;
    function subtitles(t) {
      const s = (T.subtitles || []).find((x) => t >= x.from && t < x.to);
      if (!s) { sub.style.opacity = 0; return; }
      if (subKey !== s) { subKey = s; subBox.replaceChildren(...[s.text, s.em ? h('em', {}, s.em) : null, s.after || null].filter(Boolean)); }
      sub.style.opacity = vis(t, s.from, s.to, .15, .15);
    }
    /** Onde de tap à l'instant t0 au point pt (repère de la scène). */
    let tapped = false;
    function tapAt(t, t0, pt) {
      const p = prog(t, t0, .5);
      if (p <= 0 || p >= 1) return;
      tapped = true;
      set(tap, { opacity: String(Math.sin(p * Math.PI) * .9), transform: `translate(${pt.x}px, ${pt.y}px) scale(${lerp(.45, 1.15, easeOut(p))})` });
    }
    /** Curseur : va de `from` à `to` entre t0 et t0+dur, visible de t0−.2 à tEnd. Hors de sa
     *  fenêtre, l'appel ne touche à rien : une scène appelée plus loin dans renderAt n'efface plus
     *  le curseur d'une scène précédente (il est masqué en fin d'image si aucun appel ne l'a posé). */
    let cursored = false;
    function cursorMove(t, t0, dur, from, to, tEnd) {
      const o = vis(t, t0 - .2, tEnd, .25, .3);
      if (o <= 0) return;
      cursored = true;
      const p = easeInOut(prog(t, t0, dur));
      set(cursor, { opacity: o, transform: `translate(${lerp(from.x, to.x, p)}px, ${lerp(from.y, to.y, p)}px)` });
    }

    /** Main de la landing : arrive en biais, appuie à t0 (0,84), onde qui s'élargit. pt = bout du doigt. */
    let handed = false;
    function handTap(t, t0, pt) {
      const p = prog(t, t0 - .9, 1.5);
      if (p <= 0 || p >= 1) return;
      handed = true;
      const travel = easeOut(prog(t, t0 - .9, .6));
      const press = t < t0 - .1 ? 1 : t < t0 + .08 ? .84 : lerp(.84, 1, easeOut(prog(t, t0 + .08, .25)));
      set(hand, { opacity: vis(t, t0 - .9, t0 + .6, .2, .25), left: pt.x - 24 + lerp(52 * DIR, 0, travel) + 'px', top: pt.y - 6 + lerp(52, 0, travel) + 'px', transform: `scale(${press})` });
      const r = prog(t, t0, .5);
      set(ripple, { left: pt.x + 'px', top: pt.y + 'px', opacity: r > 0 && r < 1 ? String(.9 * (1 - r)) : '0', transform: `scale(${lerp(.35, 1.35, easeOut(r))})` });
    }

    /* ---------- carte d'agent compacte ---------- */
    function agentCard([k, line, subl, chipText], ic, top, kind = 'ok') {
      return h('div', { class: 'agent card', style: `top:${top}px;opacity:0` },
        h('span', { class: 'ag-av' }, icon(ic, 32)),
        h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 'ag-k' }, k), h('div', { class: 'ag-line' }, line), h('div', { class: 'ag-sub' }, subl)),
        h('span', { class: 'chip ' + kind }, kind === 'ok' ? icon('check', 22) : null, chipText));
    }

    /* ---------- téléphone + écran verrouillé ---------- */
    function phone({ left = 290, top = 300 } = {}) {
      const scaler = h('div', { class: 'scaler' });
      const screen = h('div', { class: 'screen' }, scaler);
      const el = h('div', { class: 'abs phone', style: `left:${left}px;top:${top}px` }, screen, h('div', { class: 'island' }));
      stage.append(el);
      const SCALE = 1.2103, sx = left + 14, sy = top + 14;
      /** Point de l'écran (px du téléphone 390 de large) → scène. */
      const toStage = (x, y) => ({ x: sx + x * SCALE, y: sy + y * SCALE });
      return { el, scaler, screen, toStage };
    }
    function lockScreen({ photo, date, time, notifs = [], illustrative = true, dim = 0 }) {
      const layer = h('div', { class: 'layer ls', dir: T.dir },
        h('img', { src: '../../brand-book/assets/photos/' + photo, alt: '' }), h('div', { class: 'veil', style: dim ? `background:rgba(10,17,32,${dim})` : '' }),
        h('div', { class: 'date' }, date), h('div', { class: 'clock' }, time));
      const notifEls = notifs.map((n, i) => {
        const el = h('div', { class: 'notif', style: `top:${240 + i * 104}px;opacity:0` },
          h('span', { class: 'appic', style: `background:${n.bg || '#9A6C3A'}` }, n.img ? h('img', { src: n.img, alt: '' }) : icon(n.icon || 'chat', 22)),
          h('div', { style: 'flex:1;min-width:0' },
            h('div', { class: 'nhead' }, h('span', {}, n.app), h('span', {}, n.when)),
            h('div', { class: 'ntitle' }, n.title), h('div', { class: 'nbody' }, n.body)));
        layer.append(el);
        return el;
      });
      if (illustrative && T.illustrative) layer.append(h('div', { class: 'illus' }, T.illustrative));
      layer.append(h('div', { class: 'home' }));
      return { layer, notifEls };
    }

    /* ---------- planning (règles 05 bis ×2) ---------- */
    const STATUS = {
      pending: { bg: '#E0C89B', ink: '#2B211A', dark: true },
      confirmed: { bg: '#9A6C3A', ink: '#FFFFFF', dark: false },
      checked_in: { bg: '#5C3A21', ink: '#FFFFFF', dark: false },
      checked_out: { bg: '#A89684', ink: '#2B211A', dark: true },
    };
    const LOGOS = { airbnb: 'airbnb.svg', booking: 'bookingdotcom.svg' };
  // Photo du voyageur dans l'avatar de la brique (comme GuestAvatar dans le produit).
  // Portraits de client/site/assets/guests, attribués par prénom fictif.
  const GUEST_PHOTOS = { sara: 'g2.jpg', lea: 'g9.jpg', jad: 'g3.jpg', nadia: 'g8.jpg', omar: 'g5.jpg', ali: 'g12.jpg', karim: 'g1.jpg', salma: 'g11.jpg', youssef: 'g7.jpg', lina: 'g6.jpg' };
  const guestPhoto = (key) => GUEST_PHOTOS[key] ? '../../brand-book/assets/guests/' + GUEST_PHOTOS[key] : null;
    function planning(container, { P, dw, col = 226, days, today = -1, weekend = [], rows }) {
      const X = (d, hr = 0) => (d + hr / 24) * dw;
      const WE = new Set(weekend);
      container.classList.add('plan');
      container.style.setProperty('--dw', dw + 'px');
      container.append(h('div', { class: 'ph' },
        h('div', { class: 'pcol' }, h('small', {}, P.corner)),
        h('div', { style: 'display:flex' }, days.map(([d, n], i) =>
          h('div', { class: 'pday' + (WE.has(i) ? ' we' : '') + (i === today ? ' today' : '') }, h('span', {}, d), h('b', {}, String(n)))))));
      const bars = [], byKey = {};
      rows.forEach((items, ri) => {
        const track = h('div', { class: 'ptrack', style: `width:${dw * days.length}px` },
          h('div', { class: 'pcells' }, days.map((_, i) => h('i', { class: WE.has(i) ? 'we' : '' }))));
        items.forEach((b) => {
          let el;
          if (b.blocked) {
            el = h('div', { class: 'blocked', style: `inset-inline-start:${X(b.from)}px;width:${X(b.to - b.from)}px` }, icon('lock', 22), ' ' + P.blocked);
          } else if (b.orphan) {
            el = h('div', { class: 'bdg orphan', style: `inset-inline-start:${X(b.day) + 4}px;color:${b.orphan === 'broom' ? '#2F9E8D' : '#4F86C6'}` }, icon(b.orphan === 'broom' ? 'broom' : 'wrench', 26));
          } else {
            const st = STATUS[b.status];
            const [av, name] = P.guests[b.guest];
            const glass = st.dark ? 'background:rgba(255,255,255,.55);box-shadow:inset 0 0 0 2px rgba(43,33,26,.18)' : 'background:rgba(0,0,0,.20);color:#fff;box-shadow:inset 0 0 0 2px rgba(255,255,255,.22)';
            const avSt = st.dark ? 'border:3px solid rgba(43,33,26,.30);background:rgba(43,33,26,.12)' : 'border:3px solid rgba(255,255,255,.55);background:rgba(255,255,255,.22)';
            const badges = [];
            if (b.fee) badges.push(h('span', { class: 'bdg fee', style: 'color:#2F9E8D' }, icon('broom', 28), h('span', {}, P.prices.fee)));
            if (b.wrench) badges.push(h('span', { class: 'bdg', style: 'color:#4F86C6' }, icon('wrench', 26)));
            if (b.combo) badges.push(h('span', { class: 'bdg combo' }, '+' + b.combo));
            if (b.logo) badges.push(h('span', { class: 'bdg' }, h('img', { src: '../../brand-book/assets/brands/' + LOGOS[b.logo], alt: '' })));
            const l = X(...b.from), r = X(...b.to);
            el = h('div', { class: 'bar', style: `inset-inline-start:${l}px;width:${r - l}px;background:${st.bg};color:${st.ink}` },
              b.av ? h('span', { class: 'av', style: avSt }, guestPhoto(b.guest) ? h('img', { src: guestPhoto(b.guest), alt: '' }) : av) : null,
              h('span', { class: 'tx' }, h('small', {}, P.nights(b.nights)), h('b', {}, name)),
              b.price ? h('span', { class: 'pill', style: glass }, icon('check', 22), ' ' + P.prices[b.guest]) : null,
              badges.length ? h('span', { class: 'bdgs' }, badges) : null);
          }
          el.dataset.row = ri;
          if (b.key) byKey[b.key] = el;
          if (!b.hidden) bars.push(el);
          track.append(el);
        });
        const [rn, city] = P.rows[ri];
        container.append(h('div', { class: 'pr' }, h('div', { class: 'pcol' }, h('b', {}, rn), h('small', {}, city)), track));
      });
      const now = today >= 0 ? h('div', { class: 'now', style: `inset-inline-start:${col + X(today, 10)}px;opacity:0` }) : null;
      if (now) container.append(now);
      return { bars, byKey, now, X, col };
    }
    /** Entrée des briques : glissement depuis l'heure d'arrivée, rangée après rangée. */
    function planningEnter(t, t0, pl) {
      pl.bars.forEach((el) => {
        const p = easeOut(prog(t, t0 + (+el.dataset.row) * .18, .6));
        const cut = lerp(100, 0, p);
        set(el, { opacity: p, clipPath: RTL ? `inset(-10px -10px -10px ${cut}%)` : `inset(-10px ${cut}% -10px -10px)`, transform: `translateX(${lerp(-24 * DIR, 0, p)}px)` });
      });
      if (pl.now) pl.now.style.opacity = easeOut(prog(t, t0 + .7, .4));
    }

    /* ---------- composants repris de la landing (voir INVENTAIRE-COMPOSANTS.md) ---------- */
    const PHOTOS = '../../brand-book/assets/photos/';
    const BRANDS = '../../brand-book/assets/brands/';
    /** Fenêtre produit « baitly · titre » + onglets segmentés (L02, L08-L12). */
    function productWindow({ title, icon: ic, tabs = [], active = 0 }) {
      const tabEls = tabs.map((t, i) => h('span', { class: 'pw-tab' + (i === active ? ' on' : '') }, t));
      const body = h('div', { class: 'pw-b' }, tabs.length ? h('div', { class: 'pw-tabs' }, tabEls) : null);
      const el = h('div', { class: 'pw card' },
        h('div', { class: 'pw-h' }, icon('house', 30, 'pw-mark'), h('b', {}, 'baitly'), h('span', {}, title), ic ? icon(ic, 30) : null), body);
      let cur = active;
      const setTab = (i) => { if (i === cur) return; cur = i; tabEls.forEach((e, j) => e.classList.toggle('on', j === i)); };
      return { el, body, tabEls, setTab };
    }
    /** Photo de lieu à coin arrondi asymétrique ; on y pose des cartes flottantes (L06, L07, L11, L12). */
    function photoFrame(photo) {
      const img = h('img', { src: PHOTOS + photo, alt: '' });
      return { el: h('div', { class: 'pf' }, img), img };
    }
    /** Piste de progression segmentée (ménage, paiement) : set(p) remplit de 0 à 1. */
    function progressTrack(n = 5) {
      const segs = Array.from({ length: n }, () => h('i'));
      return { el: h('div', { class: 'ptk' }, segs), set: (p) => segs.forEach((s, i) => s.style.setProperty('--f', clamp(p * n - i))) };
    }
    /** Semaine de prix : barres qui poussent (M06), ligne de plancher, valeurs qui changent (L09). */
    function barWeek({ labels, values, hi = [], unit, floor }) {
      const vmin = Math.min(...values, floor ? floor.value : Infinity) * .88, vmax = Math.max(...values);
      const pct = (v) => 12 + 88 * (v - vmin) / (vmax - vmin);
      const cols = values.map((v, i) => {
        const val = h('b', {}, String(v));
        const bar = h('i', { class: hi.includes(i) ? 'hi' : '', style: `height:${pct(v)}%` });
        return { col: h('div', { class: 'bw-col' }, val, h('div', { class: 'bw-track' }, bar), h('span', {}, labels[i])), val, bar, v };
      });
      const chart = h('div', { class: 'bw' }, cols.map((c) => c.col));
      let floorEl = null;
      if (floor) { floorEl = h('div', { class: 'bw-floor', style: `bottom:${36 + 2.4 * pct(floor.value)}px` }, h('span', {}, floor.label)); chart.append(floorEl); }
      const el = h('div', {}, chart, unit ? h('div', { class: 'bw-unit' }, unit) : null);
      return {
        el, cols, floorEl,
        grow(t, t0) { cols.forEach((c, i) => { const p = easeOut(prog(t, t0 + i * .07, .6)); c.bar.style.transform = `scaleY(${p})`; c.val.style.opacity = p; }); },
        /** Valeur i : de `from` à `to` selon p (barre et chiffre). */
        morph(i, from, to, p) { const v = Math.round(lerp(from, to, p)); cols[i].bar.style.height = pct(v) + '%'; cols[i].val.textContent = String(v); },
      };
    }
    /** Pass d'accès : le code s'écrit chiffre par chiffre, puis « Accès actif » (L12). */
    function accessPass({ property, sub, code, label, status }) {
      const digits = code.split('').map((ch) => h('span', {}, ch));
      const st = h('div', { class: 'ap-st' }, h('i'), status);
      const el = h('div', { class: 'ap card' },
        h('div', { class: 'ap-p' }, h('b', {}, property), icon('key', 30)), h('small', {}, sub),
        h('div', { class: 'ap-code' }, digits), h('small', {}, label), st);
      const type = (t, t0, step = .11) => {
        digits.forEach((d, i) => { const p = easeOut(prog(t, t0 + i * step, .22)); set(d, { opacity: p, transform: `translateY(${lerp(16, 0, p)}px)` }); });
        st.style.opacity = easeOut(prog(t, t0 + digits.length * step + .2, .4));
      };
      return { el, type };
    }
    /** Ligne de messagerie unifiée : logo du canal, voyageur, message. */
    function inboxRow({ logo, ic, name, text }) {
      const lg = h('span', { class: 'lg' }, logo ? h('img', { src: BRANDS + logo, alt: '' }) : icon(ic || 'mail', 30));
      const state = h('span', { class: 'ib-s' });
      const el = h('div', { class: 'ib' }, lg, h('div', { class: 'ib-t' }, h('b', {}, name), h('span', { dir: 'auto' }, text)), state);
      return { el, state };
    }
    /** Bulle de message ; les segments impairs sont surlignés (texte repris du livret). */
    const bubble = (parts, me = true) => h('div', { class: 'bub' + (me ? ' me' : '') }, parts.map((p, i) => (i % 2 ? h('mark', {}, p) : p)));
    /** Urgence du planning (planningUrgency.css) : tremblement sur 4 s + anneau pulsé sur 2,4 s. */
    const WOBBLE = [[0, 0], [.02, -1.6], [.05, 1.6], [.08, -1], [.11, .7], [.14, 0], [1, 0]];
    function urgency(el, t, t0, base = '0 30px 60px -34px rgba(27,42,53,.35)', rgb = '180,87,51') {
      if (t < t0) { el.style.rotate = '0deg'; el.style.boxShadow = base; return; }
      const c = ((t - t0) % 4) / 4;
      let deg = 0;
      for (let k = 1; k < WOBBLE.length; k++) if (c <= WOBBLE[k][0]) { const [a0, d0] = WOBBLE[k - 1], [a1, d1] = WOBBLE[k]; deg = lerp(d0, d1, (c - a0) / (a1 - a0)); break; }
      const w = ((t - t0) % 2.4) / 2.4;
      const r = w < .7 ? 16 * w / .7 : 0, a = w < .7 ? .55 * (1 - w / .7) : 0;
      el.style.rotate = deg + 'deg';
      el.style.boxShadow = `0 0 0 ${r}px rgba(${rgb},${a}), ${base}`;
    }

    /* ---------- composants réels du produit (série 08-15) ---------- */
    /** Plan i quand les plans suivent la voix (align-vo, FOLLOW) : [début, fin] en secondes. */
    const slot = (i) => SYNC.slots[i];
    /** Visibilité du plan i (fondu d'entrée et de sortie). */
    const slotVis = (t, i, fin = .45, fout = .4) => vis(t, slot(i)[0], slot(i)[1], fin, fout);

    /**
     * Carte HITL : même anatomie que les cartes de la projection Constellation
     * (client/site/components/AnimatedHitlMockup.tsx › CardChrome) — badge agent, badge type,
     * statut « En attente » → « Fait », titre, contexte, corps libre, actions (primaire, contour,
     * refus discret). Bordure ambre tant qu'elle attend, verte une fois appliquée.
     */
    function hitlCard({ agent, tag, title, copy, wait, done, primary, secondary, dismiss, doneText, width = 920 }) {
      const stW = h('span', { class: 'hb w' }, h('i', { class: 'dot' }), wait);
      const stOk = h('span', { class: 'hb ok', style: 'display:none' }, icon('check', 20), done);
      const body = h('div', { class: 'hc-body' });
      const ping = h('i', { class: 'ping' });
      const pBtn = h('span', { class: 'hbtn p' }, icon(primary[0], 26), h('span', {}, primary[1]), ping);
      const acts = h('div', { class: 'hc-acts' }, pBtn,
        secondary ? h('span', { class: 'hbtn o' }, icon(secondary[0], 24), h('span', {}, secondary[1])) : null,
        dismiss ? h('span', { class: 'hbtn g' }, icon('x', 22), h('span', {}, dismiss)) : null);
      const doneEl = h('div', { class: 'hc-done' }, icon('ccheck', 30), h('span', {}, doneText));
      const titleEl = h('div', { class: 'hc-t' }, title);
      const el = h('div', { class: 'hc', style: `width:${width}px` },
        h('div', { class: 'hc-top' }, h('span', { class: 'hb s' }, agent), h('span', { class: 'hb o' }, tag), stW, stOk),
        titleEl, copy ? h('div', { class: 'hc-c' }, copy) : null, body,
        h('div', { class: 'hc-sep' }), h('div', { class: 'hc-act' }, acts, doneEl));
      /** Clic sur l'action primaire à tClick (enfoncement + onde), carte « faite » juste après. */
      function render(t, tClick) {
        const press = t < tClick - .04 ? 1 : t < tClick + .1 ? .94 : lerp(.94, 1, easeOut(prog(t, tClick + .1, .3)));
        pBtn.style.transform = `scale(${press})`;
        const pg = prog(t, tClick, .7);
        ping.style.boxShadow = pg > 0 && pg < 1 ? `0 0 0 ${lerp(0, 18, easeOut(pg))}px rgba(27,42,53,${.28 * (1 - pg)})` : 'none';
        const d = easeOut(prog(t, tClick + .22, .5));
        el.style.borderColor = `color-mix(in srgb, rgba(20,184,166,.6) ${Math.round(d * 100)}%, rgba(212,165,116,.7))`;
        stW.style.display = d > .5 ? 'none' : ''; stOk.style.display = d > .5 ? '' : 'none';
        set(acts, { opacity: 1 - d, transform: `translateY(${-12 * d}px)` });
        set(doneEl, { opacity: d, transform: `translateY(${12 * (1 - d)}px)` });
      }
      return { el, body, pBtn, titleEl, render };
    }
    /** Point d'un élément dans la scène (centre, décalage éventuel) pour le curseur ou la main. */
    const center = (el, dx = 0, dy = 0) => { const p = posIn(el, stage); return { x: p.x + el.offsetWidth / 2 + dx, y: p.y + el.offsetHeight / 2 + dy }; };

    /**
     * Jauge de bruit (client/src/components/baitly/NoiseGauge.tsx) : échelle FIXE 30-100 dB,
     * repère de seuil qui coupe la piste, écart écrit, la barre respire quand elle dépasse.
     */
    function noiseGauge({ threshold, label, limit, floor = 30, ceil = 100 }) {
      const pos = (db) => clamp((db - floor) / (ceil - floor)) * 100;
      const num = h('b', {}, '0');
      const val = h('span', { class: 'ng-v' }, num, h('small', {}, 'dB'));
      const ex = h('span', { class: 'ng-ex' });
      const fill = h('i', { class: 'ng-fill' });
      const el = h('div', { class: 'ng' },
        h('div', { class: 'ng-h' }, val, ex, label ? h('span', { class: 'ng-l' }, label) : null),
        h('div', { class: 'ng-track' }, fill, h('i', { class: 'ng-tick', style: `inset-inline-start:${pos(threshold)}%` })),
        limit ? h('div', { class: 'ng-f' }, h('span', { style: `inset-inline-start:${pos(threshold)}%` }, limit)) : null);
      function setDb(db, t = 0, critical = false) {
        const over = db > threshold;
        const [flat, ink] = over ? (critical ? ['#C97A7A', '#93413F'] : ['#D4A574', '#7A5320']) : ['#14B8A6', '#0C7166'];
        num.textContent = String(Math.round(db));
        val.style.color = ink;
        ex.textContent = over ? '+' + Math.round(db - threshold) : '';
        set(ex, { color: ink, background: over ? (critical ? 'rgba(201,122,122,.14)' : 'rgba(212,165,116,.18)') : 'transparent' });
        const breathe = over ? .72 + .28 * (.5 + .5 * Math.sin(t * Math.PI * 2 / 1.4)) : 1;
        set(fill, { width: pos(db) + '%', background: flat, opacity: breathe });
      }
      return { el, set: setDb };
    }

    /** Note en étoiles (RatingStars) : calque plein rogné à la note, pas de 0,5. */
    function stars(value = 0, size = 34) {
      const row = () => Array.from({ length: 5 }, () => icon('star', size));
      const fillL = h('span', { class: 'stars-fill' }, row());
      const el = h('span', { class: 'stars' }, h('span', { class: 'stars-bg' }, row()), fillL);
      const setV = (v) => { fillL.style.width = (Math.round(v * 2) / 2 / 5 * 100) + '%'; };
      setV(value);
      return { el, set: setV };
    }

    /** Frappe au clavier : caractères visibles à l'instant t (cps par seconde), curseur texte. */
    function typeText(el, text, t, t0, cps = 30) {
      const n = Math.max(0, Math.min(text.length, Math.floor((t - t0) * cps)));
      if (el.dataset.n !== String(n)) { el.textContent = text.slice(0, n); el.dataset.n = String(n); }
      el.classList.toggle('typing', t >= t0 && n < text.length);
    }

    /** Fil de messages dans un téléphone (repère 390 px) : en-tête, bulles, indicateur de frappe. */
    function chatScreen({ name, sub, avatar, placeholder = '' }) {
      const list = h('div', { class: 'chat-list' });
      const layer = h('div', { class: 'layer chat', dir: T.dir },
        h('div', { class: 'chat-h' }, h('span', { class: 'chat-av' }, avatar ? h('img', { src: avatar, alt: '' }) : icon('user', 20)),
          h('div', { class: 'chat-id' }, h('b', {}, name), h('small', {}, sub))),
        list, h('div', { class: 'chat-in' }, h('span', {}, placeholder), h('i', {}, icon('send', 18))), h('div', { class: 'home' }));
      const add = (text, me, time) => {
        const e = h('div', { class: 'chat-b' + (me ? ' me' : ''), style: 'opacity:0' }, h('span', { dir: 'auto' }, text),
          h('small', {}, time, me ? h('i', { class: 'ticks' }, icon('check', 14), icon('check', 14)) : null));
        list.append(e); return e;
      };
      const typing = () => { const e = h('div', { class: 'chat-b dots', style: 'opacity:0' }, h('i'), h('i'), h('i')); list.append(e); return e; };
      return { layer, list, add, typing };
    }
    /** Bulle qui entre (montée + fondu) à t0. */
    const bubbleIn = (el, t, t0) => { const p = easeOut(prog(t, t0, .45)); set(el, { opacity: p, transform: `translateY(${lerp(18, 0, p)}px) scale(${lerp(.96, 1, p)})` }); };
    /** Points de frappe : visibles entre a et b, qui ondulent. */
    function dotsAt(el, t, a, b) {
      el.style.opacity = t >= a && t < b ? 1 : 0; el.style.display = t >= a && t < b ? '' : 'none';
      [...el.children].forEach((d, i) => { d.style.transform = `translateY(${-4 * Math.max(0, Math.sin((t - a) * 6 - i * .8))}px)`; });
    }

    /** Tampon « Déclaré » : arrive de haut, s'écrase et se pose légèrement de biais. */
    function stamp(text, color = '#0C7166') {
      return h('div', { class: 'stamp', style: `color:${color};border-color:${color}` }, icon('ccheck', 36), h('span', {}, text));
    }
    function stampIn(el, t, t0, angle = -7) {
      const p = prog(t, t0, .42);
      const s = p <= 0 ? 1.7 : p < .55 ? lerp(1.7, .94, easeIn(p / .55)) : lerp(.94, 1, easeOut((p - .55) / .45));
      set(el, { opacity: p > 0 ? Math.min(1, p * 3) : 0, transform: `rotate(${angle}deg) scale(${s})` });
    }

    /** Chiffre qui roule d'une valeur à l'autre (M07), formaté par fmt. */
    const roll = (el, from, to, p, fmt = (v) => String(Math.round(v))) => { el.textContent = fmt(lerp(from, to, easeInOut(p))); };

    /* ---------- écran de fin : logo animé, CTA, faits ---------- */
    let endEls = null;
    function endMount() {
      const glow = h('div', { id: 'glow', class: 'abs' });
      stage.prepend(glow);
      const svg = document.createElementNS(SVGNS, 'svg');
      for (const [k, v] of Object.entries({ width: 210, height: 210, viewBox: '251 251 522 522', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) svg.setAttribute(k, v);
      const mk = (stroke, w, dash) => { const p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', HOUSE_D); p.setAttribute('pathLength', '100'); p.setAttribute('stroke', stroke); p.setAttribute('stroke-width', w); if (dash) p.setAttribute('stroke-dasharray', dash); svg.append(p); return p; };
      const trait = mk('#25406E', 21), req = mk('#2563EB', 27, '6 94'), res = mk('#0D9488', 27, '6 94');
      const logo = h('div', { id: 'logo', class: 'abs' }, h('div', { class: 'row' }, svg, h('span', { class: 'wm' }, 'baitly')));
      const ctaBtn = h('div', { class: 'b' }, T.cta);
      // Adresse du CTA : baitly.fr par défaut, une page précise si le Reel la déclare (T.url).
      const cta = h('div', { id: 'cta', class: 'abs' }, ctaBtn, h('div', { class: 'u' }, T.url || 'baitly.fr'));
      const facts = h('div', { id: 'facts', class: 'abs' });
      const factEls = (T.facts || []).map(([b, l]) => { const el = h('span', { class: 'fact' }, h('b', {}, b), l || null); facts.append(el); return el; });
      stage.append(logo, cta, facts);
      endEls = { glow, logo, trait, req, res, cta, ctaBtn, factEls };
    }
    function endRender(t, t0) {
      const e = endEls;
      e.glow.style.opacity = easeOut(prog(t, t0 - .2, .8));
      const lIn = easeOut(prog(t, t0, .6));
      set(e.logo, { opacity: lIn, transform: `translateY(${lerp(24, 0, lIn)}px)` });
      set(e.trait, { strokeDasharray: '100 100', strokeDashoffset: String(100 - 100 * easeInOut(prog(t, t0, 1.0))) });
      // Packets : cycle 5 s linéaire, requête sur la 1re moitié, réponse sur la 2de.
      const cyc = (((t - t0 - 1) % 5) + 5) % 5 / 5, pk = t >= t0 + 1;
      set(e.req, { opacity: pk && cyc < .5 ? 1 : 0, strokeDashoffset: String(-lerp(0, 94, cyc / .5)) });
      set(e.res, { opacity: pk && cyc >= .5 ? 1 : 0, strokeDashoffset: String(-lerp(94, 0, (cyc - .5) / .5)) });
      const cIn = easeOut(prog(t, t0 + .8, .6));
      set(e.cta, { opacity: cIn, transform: `translateY(${lerp(24, 0, cIn)}px)` });
      const hover = easeOut(prog(t, t0 + 3, .2)) * (1 - easeOut(prog(t, t0 + 3.2, .3)));
      e.ctaBtn.style.background = `color-mix(in srgb, #1B2A35 ${Math.round(hover * 100)}%, #25406E)`;
      e.factEls.forEach((el, i) => { const p = easeOut(prog(t, t0 + 1.6 + i * .15, .5)); set(el, { opacity: p, transform: `translateY(${lerp(18, 0, p)}px)` }); });
    }

    /* ---------- montage final + aperçu ---------- */
    function finalize(renderAt, onFontsReady) {
      stage.append(sub, tap, cursor, ripple, hand);
      const wrapped = (t) => {
        tapped = false; handed = false; cursored = false; renderAt(toDesign(t));
        if (!tapped) tap.style.opacity = 0;
        if (!cursored) cursor.style.opacity = 0;
        if (!handed) { hand.style.opacity = 0; ripple.style.opacity = 0; }
        subtitles(t);
      };
      window.renderAt = wrapped;
      document.fonts.ready.then(() => { if (onFontsReady) onFontsReady(); });
      wrapped(0);
      if (window.__RENDER__) return;
      const hud = h('div', { id: 'hud' });
      document.body.append(hud);
      const fit = () => { stage.style.transform = `scale(${Math.min(innerWidth / stage.offsetWidth, innerHeight / stage.offsetHeight)})`; };
      addEventListener('resize', fit); fit();
      let t0 = performance.now(), offset = 0, paused = false, cur = 0;
      addEventListener('keydown', (ev) => {
        if (ev.code === 'Space') paused = !paused;
        if (ev.code === 'ArrowRight') cur = Math.min(TL.duration, cur + 1);
        if (ev.code === 'ArrowLeft') cur = Math.max(0, cur - 1);
        offset = cur; t0 = performance.now();
      });
      const loop = () => {
        cur = paused ? offset : (offset + (performance.now() - t0) / 1000) % TL.duration;
        wrapped(cur);
        hud.textContent = `${LANG} · ${cur.toFixed(2)} s${paused ? ' (pause)' : ''}`;
        requestAnimationFrame(loop);
      };
      loop();
    }

    return {
      TL, LANG, T, RTL, DIR, SYNC, $, stage,
      clamp, easeOut, easeIn, easeInOut, prog, lerp, set, vis,
      h, icon, words, titleIn, posIn, abs,
      tapAt, cursorMove, handTap, agentCard, phone, lockScreen, planning, planningEnter,
      productWindow, photoFrame, progressTrack, barWeek, accessPass, inboxRow, bubble, urgency,
      slot, slotVis, hitlCard, center, noiseGauge, stars, typeText, chatScreen, bubbleIn, dotsAt, stamp, stampIn, roll,
      endMount, endRender, finalize, guestPhoto,
    };
  }
  window.BaitlyKit = { init };
})();
