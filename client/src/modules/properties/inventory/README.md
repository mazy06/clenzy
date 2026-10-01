# Bibliothèque visuelle de l’inventaire Baitly

L’inventaire du logement utilise 457 références : 432 équipements avec des visuels distincts, plus les 25 références de linge partagées avec la bibliothèque de consommables. Les 28 familles incluent mobilier, électroménager, sanitaires, vaisselle détaillée, sécurité, bébé, extérieur, accessibilité et animaux. Les objets absents du catalogue restent ajoutables avec un nom libre et une photo personnelle.

## Visuels et maintenance

Les 27 planches de 16 photos génériques ont été générées avec l’outil Imagegen le 1er octobre 2026. Elles ne représentent pas une marque ou le modèle exact d’un logement. Les prompts sont archivés dans `artwork-prompts.json`, les noms des fichiers source dans `artwork-sources.json`. Les PNG originaux sont conservés dans le dossier `generated_images` de la tâche Codex ; seuls les WebP optimisés sont livrés dans `client/public/images/inventory/` (environ 2,1 Mo au total).

Chaque planche est une grille 4 × 4. Le torchon de cuisine possède une photo individuelle partagée avec les consommables (`grid: 1`) ; son prompt figure dans `public/images/stock/README.md`. `inventoryCatalogData.ts` fixe l’ordre des cellules : **ne jamais réordonner une planche sans changer ses correspondances**. Une nouvelle variante physique utilise une nouvelle cellule ; seules les tailles du linge partagent une photo. Les clés sont stables et enregistrées en base. Le catalogue comporte les noms français, anglais et arabes, des synonymes de recherche et une pièce proposée, modifiable avant l’ajout.

La priorité d’affichage est : photo personnelle raster, référence explicite valide, nom reconnu, puis image générique. L’inventaire et les réassorts consultent les deux bibliothèques pour utiliser le même visuel. La reconnaissance accepte les pluriels, les séparateurs de dimensions, les espaces entre nombres et unités et les synonymes documentés (ex. « Drap house »). Les mots distinctifs et les formats sont conservés ; un nom ambigu ne choisit jamais le premier résultat. Une référence `custom` ou inconnue n’empêche pas de retrouver un visuel existant. Les objets existants ne sont pas renommés ni associés automatiquement en base.

Pour l’image uniquement, un format non répertorié (ex. « Draps housse 140x190 ») utilise le visuel du type reconnu (« Drap-housse »). Les suffixes explicites de dimensions, volume, poids ou conditionnement sont retirés progressivement, après avoir cherché la référence exacte. Le nom, la taille et les quantités saisis restent intacts. Ce repli n’est pas une association à une référence d’une autre taille et ne supprime pas les mots distinctifs, les modèles ni les nombres de places. L’audit `CatalogVisualAudit.test.tsx` vérifie les 656 références distinctes dans les trois langues, les variantes de format et les cas qui doivent rester sans correspondance.

## Enregistrement

La migration Liquibase `0483__inventory_item_visuals.sql` ajoute `catalog_key` et `photo_url` à `property_inventory_items`, vérifiée contre l’entité et le changeset 0098. Les photos sont réencodées côté client en JPEG sans métadonnées, au plus 640 px et 256 Ko. Le serveur refuse URL distantes, SVG, signatures raster invalides, clés mal formées et dépassements de taille.

`POST /api/properties/{propertyId}/inventory/items/batch` accepte de 1 à 100 objets, valide l’ensemble avant toute écriture et conserve la transaction unique du service. Il utilise les mêmes contrôles d’organisation et de propriété que les autres opérations d’inventaire. Le logement et l’organisation viennent du chemin et du contexte serveur, jamais des identifiants transmis dans les objets.

Les mises à jour partielles historiques conservent les visuels. `clearPhoto: true` retire explicitement la photo personnelle sans perdre la référence de bibliothèque. Toute erreur de sauvegarde conserve la sélection ou le formulaire affiché.

## Vérifications

Tests ciblés : `InventoryLibrary.test.tsx`, `StockCatalog.test.tsx`, `PropertyInventoryVisualTest`, `PropertyInventoryServiceTest`, `PropertyInventoryControllerTest`, `PropertyStockVisualTest`. Le test de migration exécute le schéma 0098 puis 0483 sur H2 en mode PostgreSQL et vérifie les données historiques et les nouveaux champs. Les vérifications visuelles utilisent le serveur Vite déjà actif et des données de test locales, sans modification des logements existants.
