-- Rend `payment_collection` obligatoire, et retire ainsi le dernier endroit du
-- code ou le regime d'encaissement etait REDERIVE du nom du canal.
--
-- 0366 avait cree la colonne nullable a dessein : tant que des lignes n'etaient
-- pas renseignees, `Reservation.isCollectedByChannel()` retombait sur
-- `OtaPaidSources` — le comportement restait donc strictement inchange, meme si
-- le changeset n'avait pas encore tourne. Ce filet a fait son office ; il coute
-- desormais plus qu'il ne protege : tant qu'il existe, une ligne mal renseignee
-- passe inapercue au lieu d'echouer bruyamment, et la deduction que ce chantier
-- supprime survit dans le code.
--
-- ── Ordre d'application ─────────────────────────────────────────────────────
--
-- Liquibase tourne au boot, AVANT que l'application serve la moindre requete
-- (SpringLiquibase). Le code qui suppose la colonne renseignee ne s'execute donc
-- jamais avant ce changeset.

-- 1. Rattrapage des lignes ecrites entre 0366 et maintenant.
--
--    En theorie il n'y en a aucune : toute ecriture passe par JPA, et
--    `Reservation.derivePaymentCollection` (@PrePersist) renseigne le champ a
--    l'insertion. Ce UPDATE est le prix a payer pour que le ALTER qui suit ne
--    puisse pas echouer au boot d'une prod — un cout nul quand il ne trouve rien.
--
--    La regle appliquee est celle d'AUJOURD'HUI (miroir de `OtaPaidSources`),
--    pas celle gelee dans 0366 : depuis, le vocabulaire des canaux s'est ouvert
--    (vrbo, expedia, puis la longue traine). Rejouer l'ancienne liste classerait
--    un sejour Vrbo en « le PMS encaisse » — un solde du sur de l'argent deja
--    percu, exactement le bug d'origine.
UPDATE reservations
   SET payment_collection = CASE
           WHEN LOWER(COALESCE(source, '')) IN (
                   'airbnb', 'booking', 'vrbo', 'expedia',
                   'agoda', 'hotels_com', 'hometogo', 'mabeet', 'rentelly', 'gathern',
                   'other', 'channex')
               THEN 'CHANNEL'
           ELSE 'PMS'
       END
 WHERE payment_collection IS NULL;

-- 2. La colonne devient obligatoire. C'est desormais la base qui garantit
--    l'invariant, plutot qu'un repli disperse dans le code applicatif.
ALTER TABLE reservations
    ALTER COLUMN payment_collection SET NOT NULL;
