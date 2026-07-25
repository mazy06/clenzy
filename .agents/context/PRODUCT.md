# PRODUCT.md — Baitly

> Contexte produit consommé par le skill `impeccable` (et par toute tâche design).
> Emplacement : `.agents/context/` parce que la racine et `docs/` sont gitignorés
> (cf. `.gitignore`, `/*.md` et `/docs/`). Le loader Impeccable regarde la racine
> puis retombe ici.

## Register

**product**

Baitly est un outil de travail : la quasi-totalité des surfaces sont authentifiées
(PMS, back-office, réglages, tableaux, plannings). Le design SERT la tâche, il n'est
pas le produit. Le tool doit disparaître dans la tâche.

Exceptions en registre **brand**, à traiter séparément : le site marketing
(`client/site`), les pages publiques d'authentification (`AuthLayout`), et les sites
générés par le Booking Engine / Baitly Studio.

## Ce qu'est le produit

PMS (Property Management System) SaaS multi-tenant pour la location courte durée.
Il couvre le cycle complet d'un logement loué : logements, réservations, calendriers
multi-canaux, tarification dynamique, guests et messagerie, interventions terrain,
facturation, et une couche d'agents IA qui exécute ou propose des actions.

Marché prioritaire : **Maroc d'abord**, puis francophonie. Conséquences concrètes :
français par défaut, arabe supporté (donc **RTL de bout en bout**, propriétés
logiques obligatoires), dirham marocain, et des contraintes locales réelles
(fiche police DGSN, taxe de séjour, licence 80-14).

## Utilisateurs

| Persona | Contexte d'usage | Ce qu'il attend de l'interface |
|---|---|---|
| **Host / gestionnaire** | Bureau ou mobile, consulte plusieurs fois par jour entre deux appels. Gère 1 à 50 logements. | Scanner vite, décider, repartir. La densité est un service, pas un défaut. |
| **Super-admin / super-manager plateforme** | Écran large, sessions longues, vue cross-organisations. | Tableaux denses, filtres, tri, export. Tolère la complexité si elle est prévisible. |
| **Technicien / femme de ménage** | **Mobile, en déplacement, souvent une seule main, parfois mauvaise connexion.** | Grandes cibles tactiles, peu de texte, état de la tâche évident. Rien qui dépende du survol. |
| **Superviseur d'équipe** | Mobile et bureau. | Vue d'affectation, qui fait quoi, où ça bloque. |
| **Guest** (Booking Engine, livret d'accueil) | Mobile, une seule visite, aucun apprentissage possible. | Registre brand. Zéro jargon métier. |

## Principes stratégiques

1. **Signaler l'exception, pas la règle.** L'exécution nominale est le cas normal :
   elle reste grise. La couleur est réservée à ce qui appelle une action humaine.
2. **La surface signale l'action.** Un bloc ne reçoit un fond que si on agit dessus.
   Ce qui se lit seulement vit sur le fond de page, séparé par des filets d'1px.
3. **L'argent et les dates ne se décorent pas.** Tout montant affiché doit se
   recalculer depuis les données visibles. Un chiffre d'ambiance sur un écran de
   décision financière coûte la confiance dans tout l'écran.
4. **Le mouvement porte un état ou répond à un geste.** Jamais d'ambiance : ces
   écrans restent ouverts toute la journée.
5. **Ne jamais perdre une capacité en changeant de vue.** Deux vues des mêmes objets
   doivent offrir les mêmes actions, ou dire explicitement où l'action se trouve.
6. **Le survol n'est jamais le seul chemin.** Une part significative des utilisateurs
   est sur mobile ; toute affordance révélée au survol doit rester atteignable au
   doigt et au clavier.

## Ton

Direct, technique, sans esbroufe. Français métier de l'hébergement (« nuitée »,
« arrivée », « prestataire »), jamais de jargon marketing. Phrases courtes.
On dit ce qui s'est passé et ce qu'il reste à faire.

Interdits d'écriture : « Optimisez », « Boostez », « Simplifiez-vous la vie »,
les points d'exclamation dans les confirmations, « Oups » dans les erreurs, la voix
passive pour annoncer un échec (« nous n'avons pas pu enregistrer », pas « une
erreur est survenue »).

## Anti-références

- **Les dashboards SaaS à tuiles** : rangée de cartes identiques icône + titre +
  chiffre, dégradés violet-bleu, sparklines décoratives. C'est le premier réflexe et
  c'est exactement ce qu'on ne veut pas.
- **Les back-offices « entreprise »** gris-bleu sans hiérarchie, où tout a le même
  poids parce que rien n'a été priorisé.
- **Le radial partout** : un graphe ne se justifie que s'il existe des arêtes
  signifiantes. Quatre entités indépendantes sont une liste, pas une constellation.

## Références assumées

Linear (densité et calme), Notion (surfaces, filets, actions révélées au survol,
tags à fond pastel et encre foncée), Stripe (tableaux et argent).
