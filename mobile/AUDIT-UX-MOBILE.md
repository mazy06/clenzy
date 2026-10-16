# Audit UX — app mobile Baitly (2026-10-14)

Périmètre : la navigation Baitly (`src/navigation/BaitlyNavigator.tsx`), soit les écrans que voient
propriétaires, conciergeries et prestataires (≈ 35 écrans). Parcours vérifiés dans le simulateur
(iPhone 16e, données de démonstration) et par lecture du code. Les ~90 écrans hérités
(`src/screens/**`, `ManagerNavigator`) servent aux comptes administrateurs : hors périmètre de
cette passe, à traiter séparément.

Critère unique : **un nouvel utilisateur comprend chaque écran sans explication.**

## Constats

### A. Architecture d'information (le plus coûteux pour la compréhension)

| # | Écran | Problème | Gravité |
|---|---|---|---|
| A1 | Onglet « Logements » (propriétaire, conciergerie) | Affiche l'annuaire public (les biens **des autres**), alors que « Mes logements » est enfoui dans Compte. L'utilisateur qui touche « Logements » s'attend à voir les siens. | Bloquant |
| A2 | Accueil → « Suivi » | Ouvre les **demandes de devis**, alors que « Suivi » désigne aussi le suivi d'une intervention. Même mot, deux sens. | Élevée |
| A3 | Compte → « Mon activité » | 6 à 10 entrées de navigation mêlées (missions, devis, logements, réseau, mandats…) qui doublonnent les onglets et l'accueil. « Mes logements » et « Choisir sa conciergerie » ont la même icône. | Élevée |
| A4 | Accueil conciergerie | S'ouvre sur « Indicateurs » : la première chose vue n'est pas ce qu'il y a à faire aujourd'hui. | Moyenne |
| A5 | Accès aux messages | Icône `chatbubbles` rendue comme un histogramme (lue « statistiques »), compteur non lu en simple texte rouge ; le geste de balayage vers les messages est invisible. | Élevée |

### B. Formulaires

| # | Écran | Problème | Gravité |
|---|---|---|---|
| B1 | Demander un devis | Date à taper au format `AAAA-MM-JJ`, heure `HH:MM`, durée « en minutes (15 à 1440) ». Prestations et logements présentés comme une pile de gros boutons, sélection marquée par un « ✓ » dans le texte. | Bloquant |
| B2 | Devis | Mur de texte : statut dans un bandeau, montant, lignes, e-mail, téléphone, acompte empilés sans hiérarchie ; actions (accepter / refuser) au milieu du contenu, toutes au même niveau visuel. | Élevée |
| B3 | Devis (côté prestataire) | Devise à saisir à la main (« MAD »), date de validité au format texte, choix d'équipe en boutons empilés. | Élevée |

### C. Composants et cohérence visuelle

| # | Problème | Gravité |
|---|---|---|
| C1 | Boutons à rayon 8 alors que cartes et champs sont à 14-22 : deux familles de formes. Pas de bouton discret (texte) ni destructif : tout est plein ou gris. | Moyenne |
| C2 | `BaitlyNotice` sans icône ni ton (info / attention / succès) : une erreur et une information se ressemblent hors du rouge. | Moyenne |
| C3 | `BaitlyEmpty` : un titre aligné à gauche, sans illustration ni action utile — un écran vide ne dit pas quoi faire. | Moyenne |
| C4 | Préférences : les choix exclusifs (thème, langue, profil) affichent un chevron « ouvrir » sur les options non cochées ; l'icône de langue est une antenne radio. | Moyenne |
| C5 | Pastilles de statut redéfinies à la main dans 4 écrans (couleurs, rayons et tailles différents). | Faible |
| C6 | Cartes de l'annuaire : le chiffre « 2 » n'a pas d'unité ; « Contacter le propriétaire » passe sur deux lignes dans une carte de 170 pt. | Moyenne |
| C7 | Notifications : même icône cloche pour tout, date seule (« 14 oct. »), pas de distinction nette lu / non lu. | Faible |

### D. Points déjà satisfaisants (à conserver)

- Barre d'onglets à illustrations et découpe animée : lisible, identitaire.
- Exécution d'une mission (étapes, preuves photo, pause, signalement) : guidée pas à pas.
- Suivi d'intervention côté propriétaire (frise, avancement) : livré dans cette même session.

## Corrections

1. **Primitives** (`design-system/`) : bouton (rayon unifié, variantes texte et danger, icône),
   notice à tons et icône, état vide centré avec action, pastille de statut, puces de choix,
   contrôle segmenté, ligne « libellé / valeur ». Les écrans les réutilisent au lieu de styles locaux.
2. **Architecture** : onglet « Logements » = mes logements + accès à l'annuaire par un sélecteur
   en tête ; « Suivi » → « Mes devis » ; Compte allégé et icônes distinctes ; accueil conciergerie
   ouvert sur « Activité » ; icône et pastille des messages.
3. **Formulaires** : demande de devis par choix visuels (prestation, logement, jour, créneau,
   durée) puis récapitulatif ; écran devis structuré (statut, montant, détails, actions en pied
   d'écran avec une seule action principale).
4. **Finitions** : préférences en boutons radio, cartes de l'annuaire, notifications.

Aucune dépendance native ajoutée (le sélecteur de date est en JS) : pas de rebuild iOS/Android nécessaire.

## État au 2026-10-14

| Constat | Statut |
|---|---|
| A1 Logements | Fait : l'onglet s'ouvre sur « Mes logements », sélecteur « Annuaire » / « Biens à gérer » (`features/owner/PropertiesTab.tsx`). |
| A2 « Suivi » | Fait : « Mes devis » partout. |
| A3 Compte | Fait : liste réduite, icônes distinctes, « Interventions » côté propriétaire, « Demandes reçues » côté prestataire. |
| A4 Accueil conciergerie | Fait : ouvre sur « Activité ». |
| A5 Messages | Fait : icône bulle, pastille de non-lus. Le geste de balayage reste en raccourci secondaire. |
| B1 Demande de devis | Fait : choix visuels + récapitulatif. Non vérifié dans le simulateur (le catalogue de démo désactive la demande) ; couvert par les tests. |
| B2-B3 Devis | Fait : statut, montant, détails en cartes ; actions en pied d'écran ; devise, validité et équipe en choix. |
| C1-C3, C5 | Fait : `BaitlyButton` (variantes, icône, rayon 14), `BaitlyNotice` (tons), `BaitlyEmpty`, `design-system/primitives.tsx`. |
| C4 Préférences | Fait : boutons radio, icône de langue. |
| C6 Annuaire | Fait : « 2 logements », libellé « Contacter ». Photos des logements de démo corrigées. |
| C7 Notifications | Fait. |

Restent hors de cette passe : écrans administrateur hérités (`src/screens/**`), Réels, réseau privé,
mandats ; à auditer dans une passe dédiée. Le symbole du dirham (glyphe du PMS) est conservé tel quel.
