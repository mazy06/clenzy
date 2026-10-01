# Extension de la bibliothèque photo Baitly

128 nouvelles photos génériques créées avec l’outil Imagegen intégré, sans API externe ni marque. Huit planches de 16 cellules, encodées en WebP qualité 82. Les fichiers sont servis localement, et la même référence est utilisée dans le stock, les cartes HITL et leurs modales.

224 références au total, 191 visuels produit distincts utilisés (hors image générique de secours). Les formats d’un même produit peuvent partager leur photo ; les pastilles solides de lave-vaisselle, capsules gel de lave-vaisselle, capsules de lessive et tablettes de lessive ont quatre photos différentes.

Les 14 familles et les filtres Accueil / Vente en supplément servent à trouver des références dans la bibliothèque. Le choix d’un article ne crée pas d’offre commerciale, de tarif ou de liaison automatique avec le module Upsells. Les paniers sont suivis comme des articles, sans décrément automatique de leurs composants. Les photos sont illustratives et n’attestent pas la composition d’un produit réel.

## Correction du cadrage de laundry-dishes

La planche retenue est la version corrigée : `/Users/toufik/.codex/generated_images/01a0f2f2-9724-72c0-8880-2a3a6f07fe7a/exec-b452554f-ef40-488d-b861-dff8638c7834.png`. Les 16 produits et leurs emplacements sont inchangés. Le cadrage a été resserré dans chaque cellule pour éviter de montrer le produit voisin en vignette.

```text
Use case: precise-object-edit. Edit this production 4x4 sprite atlas, preserving every single product, its appearance and exact row/column assignment. Fix spacing ONLY: each product/group must be centered at the geometric center of its own 1/4 by 1/4 square cell, with ALL of it inside the central 60% of the cell width AND height. Shrink the groups slightly if needed. This is critical: the fourth-row floor-cleaner bottle cap currently intrudes into the third-row washing-machine-cleaner cell. Give every object at least 20% empty padding from EVERY cell edge. Uniform plain pale blue-grey background #f4f6f8. No text, no grid lines, no extra items. 16 unchanged products in an exact 4 by 4 evenly spaced grid, square canvas. Preserve photorealistic materials and lighting.
```

## Fichiers et prompts de génération

### laundry-dishes.webp

Fichier : `client/public/images/stock/laundry-dishes.webp`

Source PNG : `/Users/toufik/.codex/generated_images/01a0f2f2-9724-72c0-8880-2a3a6f07fe7a/exec-4fa7c3b5-d362-4761-b8f6-fc5cb56c7b8c.png`

```text
Use case: product-mockup. Asset type: ONE square production-ready sprite atlas for Baitly's stock thumbnails. Create an EXACT 4 by 4 contact sheet of 16 equal square cells, canvas 1536x1536. Uniform plain pale blue-grey #f4f6f8 background across all cells, NO grid lines, text, letters, logos, numbers, watermarks or labels with writing. Photorealistic unbranded ecommerce packshots, soft daylight from upper left, tiny soft ground shadows, three-quarter front view. Each product/group MUST be centered on the EXACT center of its equal-sized grid cell and remain fully within the central 68% of that cell, including packaging and related objects. All 4 rows and 4 columns aligned mathematically, large empty padding. No extra props or objects, no people, no illustrations, no icons. Reading left to right then top to bottom, the 16 subjects are:
1.1: three rectangular solid pressed dishwasher tablets, layered blue and white with a tiny red circular center, chalky texture.
1.2: three compact rectangular dishwasher gel capsules, clear film enclosing blue gel and white powder.
1.3: a plain blue carton beside coarse translucent white dishwasher salt crystals.
1.4: a slender clear bottle of blue rinse aid, narrow red pour spout, no text.
2.1: three large soft rounded laundry detergent pods with three visibly separate liquid chambers in green, blue and white.
2.2: two thick oval solid white pressed laundry detergent tablets, blue speckles, next to a plain pale green open carton.
2.3: an open plain kraft laundry powder carton with a blue scoop filled with white powder.
2.4: three thin ivory rectangular laundry detergent sheets partly pulled out of a flat kraft envelope.
3.1: a small rose pink stain remover spray bottle with blank cream label.
3.2: several soft white colour catcher sheets fanning out of a plain lavender carton.
3.3: a short wide grey bottle of washing machine cleaner with cobalt screw cap and blank pale blue label.
3.4: three round natural ivory wool dryer balls.
4.1: a clear one liter bottle of cleaning vinegar with plain mint green cap.
4.2: a plain kraft pouch of baking soda with small wooden scoop of white powder.
4.3: a tall sage green floor cleaner bottle with built in handle and ivory screw cap.
4.4: a small rectangular clear dishwasher cleaner bottle with two liquid layers blue and amber and sealed red cap.
```

### drinks.webp

Fichier : `client/public/images/stock/drinks.webp`

Source PNG : `/Users/toufik/.codex/generated_images/01a0f2f2-9724-72c0-8880-2a3a6f07fe7a/exec-26882df6-a475-459b-a6f7-ec4468032bf0.png`

```text
Use case: product-mockup. Asset type: ONE square production-ready sprite atlas for Baitly's stock thumbnails. Create an EXACT 4 by 4 contact sheet of 16 equal square cells, canvas 1536x1536. Uniform plain pale blue-grey #f4f6f8 background across all cells, NO grid lines, text, letters, logos, numbers, watermarks or labels with writing. Photorealistic unbranded ecommerce packshots, soft daylight from upper left, tiny soft ground shadows, three-quarter front view. Each product/group MUST be centered on the EXACT center of its equal-sized grid cell and remain fully within the central 68% of that cell, including packaging and related objects. All 4 rows and 4 columns aligned mathematically, large empty padding. No extra props or objects, no people, no illustrations, no icons. Reading left to right then top to bottom, the 16 subjects are:
1.1: six clear large water bottles in a transparent shrink wrapped multipack, blue caps.
1.2: six short small water bottles in clear shrink wrap with white caps.
1.3: one green glass mineral water bottle with small bubbles visible, silver cap.
1.4: six green sparkling water bottles in transparent shrink wrap with silver caps.
2.1: one plain red aluminum cola can with a silver pull tab.
2.2: a clear plastic bottle filled with dark cola, red cap and blank red band.
2.3: one plain charcoal grey soda can with a slim red band and silver top.
2.4: a clear glass lemonade bottle with pale yellow liquid, swing top cap and blank yellow band.
3.1: one bright orange unbranded aluminum can beside a small orange wedge.
3.2: one plain lime green aluminum can beside a tiny lime wedge.
3.3: a clear bottle of amber iced tea with peach colored cap and small peach wedge.
3.4: a clear glass bottle filled with orange juice next to a small half orange.
4.1: a clear glass bottle of golden apple juice with a red apple beside it.
4.2: a small coral colored juice carton with blank label beside pineapple and orange wedges.
4.3: a small clear glass tonic water bottle with silver cap and muted yellow blank label.
4.4: a small amber glass ginger beer bottle with beige cap beside a small ginger root.
```

### beverages.webp

Fichier : `client/public/images/stock/beverages.webp`

Source PNG : `/Users/toufik/.codex/generated_images/01a0f2f2-9724-72c0-8880-2a3a6f07fe7a/exec-413ea9e6-d300-44e4-9d35-6403ae5d3a8a.png`

```text
Use case: product-mockup. Asset type: ONE square production-ready sprite atlas for Baitly's stock thumbnails. Create an EXACT 4 by 4 contact sheet of 16 equal square cells, canvas 1536x1536. Uniform plain pale blue-grey #f4f6f8 background across all cells, NO grid lines, text, letters, logos, numbers, watermarks or labels with writing. Photorealistic unbranded ecommerce packshots, soft daylight from upper left, tiny soft ground shadows, three-quarter front view. Each product/group MUST be centered on the EXACT center of its equal-sized grid cell and remain fully within the central 68% of that cell, including packaging and related objects. All 4 rows and 4 columns aligned mathematically, large empty padding. No extra props or objects, no people, no illustrations, no icons. Reading left to right then top to bottom, the 16 subjects are:
1.1: an open plain kraft coffee pouch with many whole roasted coffee beans.
1.2: a clear glass jar of instant coffee granules with dark brown lid.
1.3: a plain cocoa brown canister beside a wooden spoon of dark cocoa powder.
1.4: three tiny white milk portion cups with metallic foil lids.
2.1: a pale beige milk alternative carton beside a few oat stalks, no writing.
2.2: a cream colored milk alternative carton with a muted tan panel beside a few almonds.
2.3: a pale green milk alternative carton beside a few soybeans.
2.4: a slim clear bottle of coconut water with white cap beside a coconut half.
3.1: a small clear bottle of thick strawberry pink smoothie with pale pink cap and two berries.
3.2: a tall clear sparkling fruit juice bottle filled with pale gold liquid, silver foil neck and blank cream label.
3.3: one amber beer bottle with cream blank paper label and gold crown cap.
3.4: one aluminum beer can with plain cream body, brass color top and thin green stripe.
4.1: one green glass bottle with pale blue blank label and blue cap.
4.2: a dark glass wine bottle with deep red foil neck and blank cream label.
4.3: a clear wine bottle with pale straw white wine and ivory capsule, blank cream label.
4.4: a dark green champagne bottle with gold foil neck, wide body and plain cream label.
```

### breakfast.webp

Fichier : `client/public/images/stock/breakfast.webp`

Source PNG : `/Users/toufik/.codex/generated_images/01a0f2f2-9724-72c0-8880-2a3a6f07fe7a/exec-8c6f9ffd-d91c-4c5d-8936-281b22b6ab9c.png`

```text
Use case: product-mockup. Asset type: ONE square production-ready sprite atlas for Baitly's stock thumbnails. Create an EXACT 4 by 4 contact sheet of 16 equal square cells, canvas 1536x1536. Uniform plain pale blue-grey #f4f6f8 background across all cells, NO grid lines, text, letters, logos, numbers, watermarks or labels with writing. Photorealistic unbranded ecommerce packshots, soft daylight from upper left, tiny soft ground shadows, three-quarter front view. Each product/group MUST be centered on the EXACT center of its equal-sized grid cell and remain fully within the central 68% of that cell, including packaging and related objects. All 4 rows and 4 columns aligned mathematically, large empty padding. No extra props or objects, no people, no illustrations, no icons. Reading left to right then top to bottom, the 16 subjects are:
1.1: two flaky golden butter croissants.
1.2: two rectangular golden pain au chocolat pastries with dark chocolate ends visible.
1.3: one short golden French baguette in an open plain kraft paper sleeve.
1.4: a small loaf of sliced white bread in a transparent bread bag.
2.1: a small braided golden brioche loaf with one cut slice.
2.2: a neat stack of four golden rectangular rusks beside a plain cream wrapper.
2.3: a clear glass jar of chunky toasted granola oats and nuts with a wooden lid.
2.4: a plain yellow cereal carton with a small mound of golden cornflakes in front.
3.1: an open kraft pouch filled with pale rolled oats and a small wooden scoop.
3.2: a small clear glass jar of red strawberry jam with gingham red lid, blank cream label.
3.3: a small clear glass jar of orange apricot jam with apricot colored lid and one apricot beside it.
3.4: three tiny round transparent jam portion cups with red, orange and purple foil lids.
4.1: a small glass jar of golden honey with a wooden honey dipper alongside.
4.2: a clear wide jar of brown chocolate hazelnut spread with white lid and hazelnuts beside it.
4.3: a clear jar of tan peanut butter with navy lid and a few peanuts.
4.4: a short stack of three small golden pancakes with no toppings.
```

### pantry.webp

Fichier : `client/public/images/stock/pantry.webp`

Source PNG : `/Users/toufik/.codex/generated_images/01a0f2f2-9724-72c0-8880-2a3a6f07fe7a/exec-e26ee5fd-d522-476d-a4b9-884afe0df0c9.png`

```text
Use case: product-mockup. Asset type: ONE square production-ready sprite atlas for Baitly's stock thumbnails. Create an EXACT 4 by 4 contact sheet of 16 equal square cells, canvas 1536x1536. Uniform plain pale blue-grey #f4f6f8 background across all cells, NO grid lines, text, letters, logos, numbers, watermarks or labels with writing. Photorealistic unbranded ecommerce packshots, soft daylight from upper left, tiny soft ground shadows, three-quarter front view. Each product/group MUST be centered on the EXACT center of its equal-sized grid cell and remain fully within the central 68% of that cell, including packaging and related objects. All 4 rows and 4 columns aligned mathematically, large empty padding. No extra props or objects, no people, no illustrations, no icons. Reading left to right then top to bottom, the 16 subjects are:
1.1: a transparent packet of dry golden penne pasta with a plain kraft top.
1.2: a clear packet of dry white rice with a blank cream paper band.
1.3: an open small kraft pouch of golden couscous grains.
1.4: a clear pouch of mixed white and red quinoa with blank kraft label.
2.1: a folded white paper flour bag with plain beige stripe and a small mound of flour.
2.2: a plain cream open carton containing neat white sugar cubes.
2.3: a dark green glass olive oil bottle with a blank cream label, a few olives beside it.
2.4: a clear plastic bottle filled with golden cooking oil, yellow cap and a small sunflower head beside it.
3.1: a short round dark glass balsamic vinegar bottle with cream label and wood colored cap.
3.2: a clear glass jar of red tomato sauce with a red lid and one ripe tomato.
3.3: a small clear jar of green pesto with gold lid and a basil leaf.
3.4: a short wide silver tuna tin with partly open pull tab revealing tuna.
4.1: a tall silver tin with open lid showing round beige chickpeas and a few beside it.
4.2: a small cream soup carton with muted orange panel beside a bowl of orange vegetable soup.
4.3: a small clear jar of yellow mustard with black lid.
4.4: an unbranded red upside down ketchup squeeze bottle with white cap.
```

### fresh-food.webp

Fichier : `client/public/images/stock/fresh-food.webp`

Source PNG : `/Users/toufik/.codex/generated_images/01a0f2f2-9724-72c0-8880-2a3a6f07fe7a/exec-bbdd6a0c-6333-4bb8-bf3d-ba10559aead7.png`

```text
Use case: product-mockup. Asset type: ONE square production-ready sprite atlas for Baitly's stock thumbnails. Create an EXACT 4 by 4 contact sheet of 16 equal square cells, canvas 1536x1536. Uniform plain pale blue-grey #f4f6f8 background across all cells, NO grid lines, text, letters, logos, numbers, watermarks or labels with writing. Photorealistic unbranded ecommerce packshots, soft daylight from upper left, tiny soft ground shadows, three-quarter front view. Each product/group MUST be centered on the EXACT center of its equal-sized grid cell and remain fully within the central 68% of that cell, including packaging and related objects. All 4 rows and 4 columns aligned mathematically, large empty padding. No extra props or objects, no people, no illustrations, no icons. Reading left to right then top to bottom, the 16 subjects are:
1.1: two fresh red and green apples.
1.2: a small bunch of three ripe yellow bananas.
1.3: two fresh oranges with one green leaf.
1.4: two ripe green and golden pears.
2.1: one compact bunch of green grapes.
2.2: a small transparent punnet of fresh strawberries.
2.3: two yellow lemons, one cut in half.
2.4: an open small cardboard carton with six brown eggs.
3.1: a rectangular block of golden butter partly unwrapped from cream paper.
3.2: three tiny rectangular individual butter portions with gold foil wrappers, one partly open.
3.3: two small plain white yogurt pots with pale blue foil lids.
3.4: two small yogurt cups with berry pink sleeves and pink foil lids beside a strawberry.
4.1: a small wedge of semi hard yellow cheese with natural rind.
4.2: a small oval tub of white cream cheese with a partly peeled foil seal.
4.3: a clear sealed flat tray containing folded pale pink ham slices.
4.4: a clear vacuum sealed pack of orange pink smoked salmon slices on a thin gold backing.
```

### snacks.webp

Fichier : `client/public/images/stock/snacks.webp`

Source PNG : `/Users/toufik/.codex/generated_images/01a0f2f2-9724-72c0-8880-2a3a6f07fe7a/exec-b67b55e8-ce92-4e2a-b3a4-a85880b89383.png`

```text
Use case: product-mockup. Asset type: ONE square production-ready sprite atlas for Baitly's stock thumbnails. Create an EXACT 4 by 4 contact sheet of 16 equal square cells, canvas 1536x1536. Uniform plain pale blue-grey #f4f6f8 background across all cells, NO grid lines, text, letters, logos, numbers, watermarks or labels with writing. Photorealistic unbranded ecommerce packshots, soft daylight from upper left, tiny soft ground shadows, three-quarter front view. Each product/group MUST be centered on the EXACT center of its equal-sized grid cell and remain fully within the central 68% of that cell, including packaging and related objects. All 4 rows and 4 columns aligned mathematically, large empty padding. No extra props or objects, no people, no illustrations, no icons. Reading left to right then top to bottom, the 16 subjects are:
1.1: a small plain golden potato crisp bag open with three crisps beside it.
1.2: a small stack of square salted crackers beside a plain kraft sleeve.
1.3: a small clear packet of tiny brown pretzels with a few beside it.
1.4: a clear small pouch of roasted peanuts with a plain kraft seal.
2.1: a clear small pouch of whole almonds and a few beside it.
2.2: a small clear jar of mixed nuts cashews hazelnuts walnuts with a dark lid.
2.3: a clear pouch of dried apricots raisins and apple rings with blank kraft band.
2.4: a small clear jar of green olives with gold lid.
3.1: a dark chocolate bar partly unwrapped from matte brown paper and silver foil.
3.2: a light brown milk chocolate bar partly unwrapped from beige paper and gold foil.
3.3: a small open square kraft box with four cocoa dusted round chocolate truffles.
3.4: two oat cereal bars, one half wrapped in plain cream packaging.
4.1: three round golden chocolate chip cookies beside a plain kraft packet.
4.2: three golden shell shaped madeleine cakes.
4.3: a small clear bag of colorful individually wrapped hard candies.
4.4: two small transparent apple compote cups with green foil lids.
```

### welcome-kits.webp

Fichier : `client/public/images/stock/welcome-kits.webp`

Source PNG : `/Users/toufik/.codex/generated_images/01a0f2f2-9724-72c0-8880-2a3a6f07fe7a/exec-b162d2d6-ceca-4299-bb42-5aab03e72405.png`

```text
Use case: product-mockup. Asset type: ONE square production-ready sprite atlas for Baitly's stock thumbnails. Create an EXACT 4 by 4 contact sheet of 16 equal square cells, canvas 1536x1536. Uniform plain pale blue-grey #f4f6f8 background across all cells, NO grid lines, text, letters, logos, numbers, watermarks or labels with writing. Photorealistic unbranded ecommerce packshots, soft daylight from upper left, tiny soft ground shadows, three-quarter front view. Each product/group MUST be centered on the EXACT center of its equal-sized grid cell and remain fully within the central 68% of that cell, including packaging and related objects. All 4 rows and 4 columns aligned mathematically, large empty padding. No extra props or objects, no people, no illustrations, no icons. Reading left to right then top to bottom, the 16 subjects are:
1.1: a small wicker breakfast basket containing croissants, a little jam jar and an orange juice bottle.
1.2: a compact wicker basket with apples oranges bananas and grapes.
1.3: an open kraft gift box holding a small honey jar, two biscuits and a little jam jar.
1.4: a shallow kraft gift box containing crackers, a small olive jar and a bag of mixed nuts, no drinks.
2.1: a compact kraft tray containing coffee capsules, tea sachets and small sugar sticks.
2.2: a compact cardboard drink carrier with a water bottle, orange juice bottle and red soda can.
2.3: a small open kraft snack box with a golden crisp bag, chocolate bar and small bag of nuts.
2.4: a small wicker picnic basket containing wrapped sandwich, apple and water bottle.
3.1: a small square wooden serving board with three assorted cheese wedges and a few grapes.
3.2: a small square wooden board with neatly arranged salami rounds and folded ham slices.
3.3: a shallow open navy gift box displaying nine assorted praline chocolates.
3.4: a small open kraft lunch box with an apple compote cup, juice carton and two cookies.
4.1: a compact kraft tray with a dry pasta pouch and a glass tomato sauce jar.
4.2: a compact kraft tray holding a small granola jar, a milk carton and a honey portion.
4.3: an open blush gift box holding a small champagne bottle and four chocolate truffles.
4.4: a small open kraft brunch box neatly arranged with croissant, two pancakes, strawberry punnet and small jam jar.
```
