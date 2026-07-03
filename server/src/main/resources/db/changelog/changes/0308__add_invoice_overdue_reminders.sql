-- 0308 : F5a — relances factures impayees (campagne Baitly, fiche 08).
-- Trace des relances envoyees apres passage OVERDUE (J+3 puis J+7, maximum 2) :
--   * overdue_reminder_count : nombre de relances deja envoyees (0, 1 ou 2).
--   * overdue_last_reminder_at : horodatage de la derniere relance.
-- L'idempotence est portee par la base : le scheduler ne re-selectionne jamais une
-- facture dont le compteur a atteint 2.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS overdue_reminder_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS overdue_last_reminder_at TIMESTAMP;
