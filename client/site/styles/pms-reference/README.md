# Cartes HITL de la page Agents Baitly

Ces feuilles sont des copies de présentation du PMS, prises le 2 octobre 2026. Le chemin source figure dans chaque fichier. La landing possède ses propres styles et illustrations : elle ne charge ni le superviseur, ni ses requêtes, ni ses modales métier.

`BaitlyAgentsHeroDemo` reprend la hiérarchie des cartes Revenue, réassort et avis : métadonnées, vignette, description structurée et pied d’actions. Les contrôles de démonstration sont propres au site. Les plafonds d’autonomie et les pictogrammes utilisent les constantes pures du produit pour éviter de promettre des modes indisponibles.

Lors d’une évolution du PMS, comparer ces copies aux sources avant une mise à jour volontaire. Les styles d’intégration restent dans `baitly-agents-page.css`, chargé dans l’entrée CSS initiale pour conserver le rendu serveur sans flash.

L’illustration de capsules utilise la première case de la copie locale `site/assets/illustrations/actions/consumables.webp` (source : `client/public/images/stock/consumables.webp`). Les autres illustrations proviennent du catalogue autonome `site/data/actionArtwork.ts`.
