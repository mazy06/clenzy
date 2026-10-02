# Baitly · Motion design (vidéos réseaux sociaux)

> **À quoi sert ce dossier.** Produire les vidéos motion design Baitly à partir des scripts de
> `marketing/scripts-video/`. Chaque vidéo est une page HTML animée, pilotée par le temps, rendue
> image par image en MP4 : couleurs, polices et planning sont exactement ceux du brand book.
> **À qui il s'adresse.** Marketing (aperçu, retouches de texte), motion designer / développeur (animation).

## Vidéos

| Dossier | Script | Format | Langues | État |
|---|---|---|---|---|
| `reel-01-manifeste/` | [script-01](../scripts-video/script-01-manifeste.md) | Reel 9:16, 33 s, mode Jour | FR · EN · AR | FR Lucie · EN Mark sonorisés (28/09) · AR ancienne voix · [brief voix](reel-01-manifeste/VOIX-OFF.md) |
| `reel-02-une-seule-verite/` | [script-02](../scripts-video/script-02-une-seule-verite.md) | Reel 9:16, 32 s | FR · EN · AR | FR Noé (pilote validé) · EN Mark · [brief](reel-02-une-seule-verite/VOIX-OFF.md) |
| `reel-03-avant-apres/` | [script-03](../scripts-video/script-03-avant-apres-journee.md) | Reel 9:16, écran scindé, plans calés sur la voix | FR · EN · AR | FR Lucie (pilote validé) · EN Mark · [brief](reel-03-avant-apres/VOIX-OFF.md) |
| `reel-04-agents-ia/` | [script-04](../scripts-video/script-04-agents-ia.md) | Reel 9:16, 46 s | FR · EN · AR | FR Noé · EN Mark · [brief](reel-04-agents-ia/VOIX-OFF.md) |
| `reel-05-depart-tardif/` | [script-05](../scripts-video/script-05-livret-upsells.md) | Reel 9:16, 34 s | FR · EN · AR | FR Lucie · EN Mark · [brief](reel-05-depart-tardif/VOIX-OFF.md) |
| `reel-06-arabie-saoudite/` | [script-06](../scripts-video/script-06-istiraha-arabie-saoudite.md) | Reel 9:16, 47 s | **AR uniquement** | voix après relecture des traductions · [brief](reel-06-arabie-saoudite/VOIX-OFF.md) |
| `reel-07-tour-produit/` | [script-07](../scripts-video/script-07-tour-produit-75s.md) | **16:9, 1920×1080**, 75 s, 8 chapitres | FR · EN · AR | FR Noé · EN Mark · [brief](reel-07-tour-produit/VOIX-OFF.md) |

**Série « Les aléas » (08-15, 28 septembre 2026)** — un aléa de la location courte durée, la carte
HITL qui y répond (composants réels du produit), plans calés sur la voix. Plan et vérité produit :
[BESOINS-ET-SERVICES.md](BESOINS-ET-SERVICES.md) §10. Toutes en 9:16, FR (Lucie / Noé) · EN (Mark),
arabe après relecture.

| Dossier | Histoire | Voix FR |
|---|---|---|
| `reel-08-23h40/` | Tapage nocturne : jauge de bruit, avertissement WhatsApp, blocage en cas de récidive | Lucie |
| `reel-09-clim-en-panne/` | Incident : mission, geste commercial avant l'avis, réponse d'avis rédigée par l'IA | Noé |
| `reel-10-apres-le-depart/` | Contrôle photo du ménage, dégât, caution retenue (plafonnée), paiement de l'équipe, linge | Lucie |
| `reel-11-fiches-de-police/` | Fiche remplie depuis le livret ; Maroc (DGSN), France (Chekin), Arabie saoudite (Shomoos) ; taxes, ZATCA, NTMP, RGPD | Noé |
| `reel-12-deux-nuits-de-plus/` | Prolongation chiffrée, acceptée par la voyageuse, planning / ménage / code qui suivent | Lucie |
| `reel-13-direct-sans-risque/` | Panier abandonné relancé, réservation suspecte bloquée, litige bancaire documenté | Noé |
| `reel-14-proprietaire-inquiet/` | Mois en baisse, note de revenus avant l'appel, relevé, reversement approuvé | Lucie |
| `reel-15-cartes-de-la-journee/` | Une journée carte après carte, thermostat réglé à distance, puis ce qu'on choisit d'automatiser (Suggère / Notifie / Auto) | Noé |

**Série « Réseau prestataires » (16-18, 29 septembre 2026)** — inviter les prestataires (ménage,
maintenance, linge, jardin, accueil, chef…) à préparer leur profil ; textes de la page Prestataires
de la landing, réseau « en préparation », CTA « Préparer mon profil » + baitly.fr/prestataires
(`T.url`, lu par l'écran de fin du kit). FR seulement pour l'instant. **Voix : Paul K · French Ad &
Trailer (`ecxPjiGTvAfpGEams6ec`), Eleven v4, Stabilité 0,3, direction « keynote »** (voix du film de
lancement, voir `../film-lancement/`) : balises en langage naturel empilées, `[pause]` en tête des
répliques 2 à 6.

| Dossier | Histoire | Durée |
|---|---|---|
| `reel-16-votre-savoir-faire/` | Les métiers → le réseau (hôtes, voyageurs) → la fiche profil qui se remplit → une mission lue avant de s'engager | 34,6 s |
| `reel-17-la-mission-cote-prestataire/` | Le téléphone du prestataire : mission reçue à 11 h, consignes, checklist, photos, validée ; à droite, ce que voit l'hôte | 30 s |
| `reel-18-six-familles-de-metiers/` | Les six familles de services en cartes photo, puis la mosaïque « pour les hôtes / pour leurs voyageurs » | 26,1 s |

**Teaser 15 s sans voix (29 septembre 2026)** — `teaser-15s-9x16/` et `teaser-15s-16x9/`, un seul
moteur commun dans `teaser-15s-shared/` (`teaser.js` s'adapte au format, 60 i/s). Monté sur une grille
de tempo : 128 BPM, 8 mesures = 15 s, une scène par mesure (accroche, logo, planning, canaux, ménage,
agents, paiement, fin), chapitres « 01 / Centraliser » à « 05 / Encaisser ». Version 2 (même jour) :
composants de niveau produit (notifications, fenêtre Baitly en 3D, tuiles et tuyaux de données, fiche
de mission, carte de décision complète, fiche de paiement et facture), plans de fond, ombres teintées
en couches, flou de mouvement à l'entrée, grain discret (`grain.png`). `grille.js` est la source
unique du tempo et des effets sonores, lue par l'animation ET par `musique.py`, qui compose la musique
par synthèse (ré majeur, −14 LUFS, −2 dBTP ; musique originale, libre de droits) : image et son ne
peuvent pas se décaler. Une piste générée ailleurs à 128 BPM, calée sur le premier temps, peut la
remplacer (`timeline.audio`). Rendu : `node render.mjs teaser-15s-9x16` (idem `16x9`) ; `render.mjs`
accepte désormais `timeline.audio` (pistes libres), `loudnorm: false` (piste déjà masterisée) et
`audioBitrate`.

**Avant chaque nouveau Reel : lire [INVENTAIRE-COMPOSANTS.md](INVENTAIRE-COMPOSANTS.md)** (composants
disponibles, ce qui est déjà saturé, règles de variété). Planche visuelle : `inventaire/planche.png`
(régénérer avec `node render-planche.mjs`).

## Prévisualiser

Ouvrir `reel-XX/index.html?lang=fr` (ou `en`, `ar`) dans Chrome : l'animation tourne en boucle.
Espace = pause, flèches gauche/droite = ±1 s.

## Rendre les MP4

```bash
cd marketing/motion && npm install              # une fois (playwright-core, pilote le Chrome installé)
node render.mjs reel-01-manifeste --lang=fr     # -> out/reel-01-manifeste-fr.mp4 (idem en, ar)
node render.mjs reel-01-manifeste --lang=ar --stills=2.8,15.2,30   # images de contrôle
```

Prérequis : Google Chrome, `ffmpeg` (`brew install ffmpeg`), accès internet pour la police Tajawal
(arabe). Le son est normalisé autour de −14 LUFS. `out/` est ignoré par git : les MP4 se régénèrent.
Sans fichiers de voix, la vidéo sort muette avec ses sous-titres.

## Structure d'une vidéo

- `index.html` : l'animation. `window.renderAt(t)` dessine l'instant t (secondes). Depuis le Reel 02,
  les briques communes viennent du kit partagé (`shared/kit.js`, `shared/base.css`) :
  `const K = BaitlyKit.init({ strings: STRINGS, timeline: TIMELINE })`.
- `i18n.js` : tous les textes à l'écran par langue (reprennent les formulations de la landing).
  FR : Marrakech, MAD. EN et AR : Riyad, SAR, Gathern.
- `timeline.js` : durée, cadence, départ de chaque réplique, points de synchro (`sync`), recalages
  par langue (`lang`). Format : 9:16 par défaut ; `width` / `height` pour un autre (Reel 07 en 16:9).
- `VOIX-OFF.md` : brief de production de la voix off (textes, fenêtres, intonation, prononciation).
- `vo/<langue>/` : dépôt des voix off, `b1.wav` … `b7.wav` (mp3, m4a, aiff acceptés).

### Ce que sait dessiner le kit

| Famille | Fonctions |
|---|---|
| Temps, texte | `prog`, `vis`, courbes `easeOut/In/InOut`, `words` + `titleIn` (titre mot à mot), sous-titres automatiques |
| Gestes | `tapAt` (onde ronde, téléphone), `cursorMove` (flèche, PMS), `handTap` (main de la landing, côté voyageur) |
| Appareils | `phone`, `lockScreen` |
| PMS | `planning` + `planningEnter` (règles 05 bis, photo du voyageur), `agentCard` (une par Reel au plus) |
| Landing | `productWindow` (fenêtre « baitly · titre » + onglets), `photoFrame` (photo à coin asymétrique), `progressTrack`, `barWeek` (semaine de prix + plancher), `accessPass` (code qui s'écrit), `inboxRow` + `bubble` (messagerie), `urgency` (anneau pulsé + tremblement) |
| Produit (série 08-15) | `hitlCard` (carte HITL réelle : badges, statut, actions, passage à « Fait »), `noiseGauge` (NoiseGauge), `stars` (RatingStars), `chatScreen` + `bubbleIn` + `dotsAt` (fil de messages), `typeText` (frappe), `stamp` + `stampIn` (tampon), `roll` (chiffre qui roule), `slot` / `slotVis` (plans calés sur la voix), `center` (point d'un élément pour le curseur) |
| Fin | `endMount` / `endRender` (logo animé, CTA, faits) |

Icônes : Lucide exactes (extraites de `lucide-react`, `client/node_modules`). Une icône absente du kit
fait échouer toute la page (et le rendu appelle `renderAt` quand même) : vérifier le nom dans
`ICONS` avant de l'utiliser. Noms de classe réservés : `.bar` (briques du planning) ; `.btn`, `.st`, `.ch`
sont pris par les Reels 01-07, d'où les noms préfixés du kit de la série (`hbtn`, `stars`, `chat-…`). Toute
nouvelle règle de `shared/base.css` doit être vérifiée contre les classes des reels existants.

## Intégrer la voix off

Fichier à utiliser avec ElevenLabs : `elevenlabs/baitly-voix-off-elevenlabs.txt` (indications en tête,
puis les scripts par vidéo et par langue, chacun entre des repères de début et de fin : seul ce qui
est entre les repères se colle). Français et anglais seulement pour l'instant : l'arabe attend la relecture
de sa traduction (ajouter `--langs=fr,en,ar` à la commande ci-dessous). Régénération après une retouche des textes :
`node relecture/extract-texts.mjs relecture/textes.json && python3 relecture/build_elevenlabs.py relecture/textes.json elevenlabs`.


Prononciation : « Bètly » (bèt-li), jamais « ba-ït-li ». Suivre `VOIX-OFF.md`, déposer les 7 fichiers
dans `vo/fr/`, `vo/en/`, `vo/ar/`, puis relancer le rendu de la langue. Si une réplique dépasse sa
fenêtre, ajuster son départ dans `timeline.js` (`lang.<langue>.starts`, ainsi que `click` et `promise2`
pour les deux synchronisations) ou raccourcir le texte, sans toucher à l'animation. Une prise complète
d'un seul fichier se découpe aux pauses (ffmpeg `silencedetect`) ; la prise d'origine est gardée dans
`vo/<langue>/_prise-complete-*.mp3`.

## Relecture des textes par les traducteurs

`relecture/textes-reels-a-relire.xlsx` rassemble tous les textes des 7 vidéos (voix off, sous-titres,
textes à l'écran) en FR · EN · AR, avec des colonnes à remplir (statut, proposition, commentaire).
`relecture/txt/` en donne la version texte : un fichier par vidéo (`reel-0X-….txt`, langues regroupées)
et `voix-off-tous-les-reels.txt` (les voix off seules des 7 vidéos, dans un fichier). Les deux se régénèrent depuis les sources après toute retouche :

```bash
cd marketing/motion && node relecture/extract-texts.mjs relecture/textes.json && python3 relecture/build_xlsx.py relecture/textes.json relecture/textes-reels-a-relire.xlsx && python3 relecture/build_txt.py relecture/textes.json relecture/txt
```

Les propositions validées se reportent ensuite à la main dans `i18n.js` (écran, sous-titres) et
`VOIX-OFF.md` (voix off) de chaque vidéo.

## Voix générées dans ElevenLabs : calage automatique

1. Générer la prise complète d'une vidéo et d'une langue (toutes les répliques d'un seul passage,
   séparées par des sauts de ligne), la déposer en `vo/<langue>/_prise-complete-<voix>.mp3`.
2. `python3 align-vo.py <dossier-du-reel> <langue>` : découpe b1… au silence (pauses internes
   resserrées à 0,5 s), cale chaque réplique au début de sa scène, recale les moments synchronisés
   sur les mots dits (`timeline.js`, `lang.<langue>`) et réécrit les sous-titres de la langue à
   partir du texte dit (`i18n.js`). En tête du script :
   - `SYNC` : mot déclencheur de chaque moment, **par langue** ; `MIN_AFTER` : écarts minimaux que
     l'animation exige (deux clics « +5 » avant Approuver, feuille de paiement, bascules de langue) ;
   - une réplique qui déborde sur la scène suivante est accélérée de 8 % au plus (`TEMPO_MAX`, sans
     changer la hauteur) ; si la voix finit après la durée prévue, l'écran de fin est tenu plus
     longtemps (`lang.<langue>.duration`, lue par `render.mjs` et le kit) ;
   - `FOLLOW` (Reel 03, série 08-15) : les plans suivent la voix, une réplique qui laisserait plus
     de 0,35 s de blanc est avancée et `sync.slots` est recalé pour la langue ;
   - `WARP` (Reels 04 et 07, minutages codés en dur) : les répliques s'enchaînent sans blanc et
     l'animation est déformée dans le temps (`lang.<langue>.warp`, table temps réel → temps de
     l'animation appliquée par le kit) ; le script affiche la vitesse de chaque scène (plage
     acceptable 0,7-1,45) ;
   - `SUB_UNTIL`, `SUB_MAX_REEL` : fin et longueur des sous-titres par reel.
   La découpe se trompe rarement ; le message « débit anormal » la signale, et `FORCE_BOUNDS` permet
   alors d'imposer les coupures d'une prise (relever les silences avec `ffmpeg … silencedetect`).
   `MIN_AFTER` accepte `slotN` (début du plan N) : un clic doit laisser ~2 s de lecture à la carte.
   Astuce de génération : commencer chaque paragraphe (sauf le premier) par `[pause]`, sinon Noé et
   Lucie enchaînent parfois deux répliques sans respirer et la prise devient inexploitable.
3. Relancer le rendu de la langue.

Voix : FR Lucie (Reels 01, 03, 05) et Noé (Reels 02, 04, 07), EN Mark. Textes réécrits pour remplir
chaque scène à 85-95 %. Débits réellement mesurés (caractères par seconde, pauses comprises) :
Noé 20 à 26, Lucie 16 à 20, Mark 13 à 18 (lent sur les heures et les « … »). Une même voix varie
d'une prise à l'autre : mesurer après génération, ne pas se fier à l'estimation.

## Musique

Aucune musique n'est intégrée : ajouter un son de la bibliothèque libre de droits de l'éditeur
Instagram, ou fournir une piste sous licence commerciale. Ne pas utiliser les pistes et effets du
skill `huashu-design` : leur licence est réservée à un usage personnel.

## Règles de fabrication

- Palette, typographies, logo : brand book (`../brand-book/`). Pas d'autre couleur hors maquette UI.
- Planning : règles de la section « 05 bis » (briques par statut, interventions dans ou hors des
  briques, repli « +N » où le nom prime). Voyageurs et logements fictifs ; la brique porte la photo
  du voyageur (portraits de démonstration de `brand-book/assets/guests/`).
- Variété : une scène signature par Reel, une carte d'agent compacte au plus, un seul téléphone,
  planning réservé aux sujets calendrier (INVENTAIRE-COMPOSANTS.md, § 5).
- Zones sûres Reels : rien d'important dans les 250 px du haut ni les 380 px du bas (exception
  voulue : les sous-titres, placés bas à la demande ; au milieu du filet dans l'écran scindé du Reel 03).
- `direction: ltr` sur un élément positionné retourne ses `inset-inline-*` : isoler le texte dans un
  enfant (`.ltr`) plutôt que d'orienter le bloc positionné.
- Noms de classes réservés par `shared/base.css` (planning) : `.bar`, `.plan`, `.pill`, `.bdg`, `.av`…
  Ne pas les réutiliser pour autre chose (une barre de navigateur nommée `.bar` devient une brique).
