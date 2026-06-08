-- Backfill : les réservations OTA importées via iCal recevaient le statut "pending" par
-- défaut (les OTA ne fournissent pas de propriété STATUS dans leur flux iCal). Les blocages
-- ("Not available", "Blocked") étant déjà filtrés à l'import, toute réservation rattachée à
-- un feed iCal est une vraie réservation confirmée. Le statut "pending" les excluait à tort
-- des traitements filtrés sur "confirmed" (livret d'accueil, envoi auto des instructions de
-- check-in, revenus). On aligne les données existantes sur la sémantique corrigée à l'import.
-- Idempotent : ne touche que les lignes encore en "pending" issues d'un feed iCal.
UPDATE reservations
SET status = 'confirmed'
WHERE status = 'pending'
  AND ical_feed_id IS NOT NULL;
