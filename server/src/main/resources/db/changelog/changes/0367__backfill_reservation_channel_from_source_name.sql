-- Rattrape le canal des reservations anterieures a l'ouverture du vocabulaire.
--
-- Jusqu'a la version precedente, `ICalImportService.detectSource` repliait Vrbo,
-- Abritel et HomeAway sur « other », et `ChannexBookingService` rangeait TOUT le
-- trafic du channel manager sous « channex ». Ces sejours gardent donc une source
-- muette, alors que leur `source_name` porte le nom de l'OTA vendeuse.
--
-- On le leur rend, en appliquant exactement les memes mots-cles que
-- `ChannelSources.fromName` (meme ordre d'evaluation : le premier qui matche
-- gagne).
--
-- ── Perimetre volontairement etroit ─────────────────────────────────────────
--
-- 1. Seules les sources MUETTES sont touchees : 'other' et 'channex'. Une source
--    deja nommee est une donnee, pas une approximation — on n'y touche pas.
--
-- 2. Seules les cibles OTA sont produites : airbnb, booking, vrbo, expedia.
--    JAMAIS 'direct'. C'est la propriete qui rend ce changeset sans effet
--    financier : les deux sources de depart sont classees CHANNEL par 0366, les
--    quatre cibles le sont aussi (cf. OtaPaidSources). Le regime d'encaissement
--    ne bouge donc pour AUCUNE ligne, et `payment_collection` n'est pas modifie.
--    Reclasser vers 'direct' aurait au contraire fait basculer un sejour encaisse
--    par l'OTA en « le PMS encaisse » — un solde du sur de l'argent deja percu.
--
-- 3. Un nom de flux non reconnu (« Offline », « Calendrier perso »...) ne produit
--    rien : la ligne reste telle quelle. Mieux vaut une source muette qu'une
--    source inventee.
--
-- Idempotent : apres application, plus aucune ligne ne satisfait le WHERE.
UPDATE reservations
   SET source = CASE
           WHEN LOWER(COALESCE(source_name, '')) LIKE '%airbnb%'   THEN 'airbnb'
           WHEN LOWER(COALESCE(source_name, '')) LIKE '%booking%'  THEN 'booking'
           WHEN LOWER(COALESCE(source_name, '')) LIKE '%vrbo%'     THEN 'vrbo'
           WHEN LOWER(COALESCE(source_name, '')) LIKE '%abritel%'  THEN 'vrbo'
           WHEN LOWER(COALESCE(source_name, '')) LIKE '%homeaway%' THEN 'vrbo'
           WHEN LOWER(COALESCE(source_name, '')) LIKE '%expedia%'  THEN 'expedia'
       END
 WHERE source IN ('other', 'channex')
   AND LOWER(COALESCE(source_name, '')) SIMILAR TO
       '%(airbnb|booking|vrbo|abritel|homeaway|expedia)%';
