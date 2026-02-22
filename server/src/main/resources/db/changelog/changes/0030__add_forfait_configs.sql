-- V34: Add forfait_configs JSON column to pricing_configs
-- Stores the 3 cleaning forfait configurations (Standard, Express, En profondeur)
-- Each forfait contains: coefficients, service types, prestations, eligible teams, surcharges, surface-based prices

ALTER TABLE pricing_configs ADD COLUMN forfait_configs TEXT;
