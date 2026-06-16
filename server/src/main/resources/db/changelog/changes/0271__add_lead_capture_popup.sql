-- Popup exit-intent de capture de leads (org-level, booking engine) : affichage du popup dans le
-- widget. OPT-IN (off par défaut) — distinct de lead_capture_enabled qui gate l'endpoint /leads.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS lead_capture_popup_enabled BOOLEAN NOT NULL DEFAULT FALSE;
