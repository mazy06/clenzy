-- Audit perf 2026-07-21 (P2-7) : table de verrous ShedLock pour empecher
-- l'execution concurrente des jobs @Scheduled a effets externes (emails,
-- paiements, pushes OTA, rotation de codes d'acces) quand le serveur
-- tourne en plusieurs instances (scale-out).
--
-- Schema standard ShedLock (provider shedlock-provider-jdbc-template) :
-- une ligne par verrou nomme, l'acquisition = INSERT/UPDATE conditionnel
-- atomique sur lock_until, en heure base (usingDbTime()).
CREATE TABLE shedlock (
    name       VARCHAR(64)  NOT NULL,
    lock_until TIMESTAMP    NOT NULL,
    locked_at  TIMESTAMP    NOT NULL,
    locked_by  VARCHAR(255) NOT NULL,
    CONSTRAINT pk_shedlock PRIMARY KEY (name)
);
