-- 0318 : Devis structure (maintenance) sur les demandes de service.
-- Colonne nullable TEXT stockant les lignes de devis en JSON
-- ([{label, quantity, unitPrice}, ...]). NULL = pas de devis (ex. menage,
-- dont le cout vient du forfait). Le total est recalcule cote serveur et
-- persiste dans estimated_cost.
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS quote_lines TEXT;
