-- V35: Add service category configs (travaux, exterieur, blanchisserie) + commission
ALTER TABLE pricing_configs ADD COLUMN travaux_config TEXT;
ALTER TABLE pricing_configs ADD COLUMN exterieur_config TEXT;
ALTER TABLE pricing_configs ADD COLUMN blanchisserie_config TEXT;
ALTER TABLE pricing_configs ADD COLUMN commission_configs TEXT;
