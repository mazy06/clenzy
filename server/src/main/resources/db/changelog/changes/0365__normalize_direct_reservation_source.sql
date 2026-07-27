-- Normalise la source des reservations du widget de reservation directe.
--
-- `DirectBookingService` ecrivait "DIRECT" en majuscules, alors que quatre
-- requetes JPQL comparent `r.source = 'direct'` — comparaison sensible a la
-- casse en PostgreSQL. Ces reservations etaient donc invisibles pour :
--   * l'eligibilite au credit fidelite      (findLoyaltyEligible)
--   * le re-booking en un clic              (findGuestDirectBookings)
--   * les conversions du booking engine     (countDirectCreatedBetween)
--   * le compteur « paiements en attente »  (countDirectPendingPaymentsForDashboard)
--
-- Le code est corrige ; ce changeset rattrape les lignes deja ecrites.
-- Idempotent : la clause WHERE ne trouve plus rien apres application.
--
-- Portee volontairement etroite : SEULE la valeur 'DIRECT' est normalisee.
-- Les autres sources sont deja ecrites en minuscules par leurs producteurs
-- (ICalImportService.detectSource, ChannexBookingService, ReservationController),
-- et un `LOWER(source)` global toucherait des lignes sans avoir constate de
-- probleme sur elles.
UPDATE reservations
   SET source = 'direct'
 WHERE source = 'DIRECT';
