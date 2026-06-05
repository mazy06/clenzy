-- ============================================================================
-- 0191 : Metriques CO2 + bruit sur les capteurs d'environnement (station meteo Netatmo)
-- ============================================================================
-- La station meteo Netatmo (NAMain) reporte, en plus de temperature/humidite, le
-- CO2 (ppm) et le niveau sonore (dB). On etend environment_sensors pour porter ces
-- deux mesures (nullables : seuls les capteurs Netatmo station les remplissent).
-- ============================================================================

ALTER TABLE environment_sensors
    ADD COLUMN co2       INTEGER,
    ADD COLUMN noise_db  INTEGER;
