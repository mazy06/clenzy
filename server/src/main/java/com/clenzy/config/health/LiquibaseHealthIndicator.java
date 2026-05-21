package com.clenzy.config.health;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * HealthIndicator custom pour Liquibase.
 *
 * <h2>Pourquoi</h2>
 * Phase 4 du plan de re-activation de {@code SPRING_LIQUIBASE_ENABLED=true} en
 * prod. Une fois Liquibase reactive au boot, on a besoin d'une visibilite
 * runtime immediate sur son etat — un crash silencieux du tracking
 * ({@code databasechangelog} corrompu, lock orphelin apres un OOM Kill, etc.)
 * doit etre detectable via {@code /actuator/health} et alertable par Grafana.
 *
 * <h2>Verifications</h2>
 * <ul>
 *   <li>La table {@code databasechangelog} existe (sinon : Liquibase non
 *       initialise → DOWN).</li>
 *   <li>La table {@code databasechangeloglock} contient bien la ligne {@code id=1}
 *       (sinon : structure invalide → DOWN).</li>
 *   <li>Si un lock est detenu, sa duree est sous le seuil configurable
 *       (defaut 300s = 5 min). Au-dela on considere le lock orphelin → DOWN
 *       avec instruction d'unlock manuel.</li>
 * </ul>
 *
 * <h2>Sortie OK</h2>
 * <pre>
 * {
 *   "status": "UP",
 *   "details": {
 *     "trackedChangesets": 118,
 *     "lastExecuted": "2026-05-21T15:30:27",
 *     "locked": false
 *   }
 * }
 * </pre>
 *
 * <h2>Threshold lock orphelin</h2>
 * Surchargeable via {@code clenzy.liquibase.stale-lock-threshold-seconds}.
 * 300s est conservateur : un boot Liquibase normal libere son lock en
 * quelques secondes ; au-dela d'une minute c'est suspect, au-dela de 5 min
 * c'est presque surement orphelin (Spring tue par OOM, kill -9, etc.).
 */
@Component("liquibaseCustomHealth")
public class LiquibaseHealthIndicator implements HealthIndicator {

    private static final Logger log = LoggerFactory.getLogger(LiquibaseHealthIndicator.class);

    private final JdbcTemplate jdbcTemplate;
    private final long staleLockThresholdSeconds;
    private final boolean liquibaseConfigured;

    public LiquibaseHealthIndicator(
            JdbcTemplate jdbcTemplate,
            @Value("${clenzy.liquibase.stale-lock-threshold-seconds:300}") long staleLockThresholdSeconds,
            @Value("${spring.liquibase.enabled:true}") boolean liquibaseConfigured
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.staleLockThresholdSeconds = staleLockThresholdSeconds;
        this.liquibaseConfigured = liquibaseConfigured;
    }

    @Override
    public Health health() {
        try {
            // 1. La table databasechangelog existe-t-elle ?
            Boolean dbLogExists = jdbcTemplate.queryForObject(
                    "SELECT EXISTS (SELECT 1 FROM information_schema.tables " +
                            "WHERE table_schema = 'public' AND table_name = 'databasechangelog')",
                    Boolean.class
            );
            if (Boolean.FALSE.equals(dbLogExists)) {
                // Si Liquibase est explicitement desactive (CI K6, dev avec Hibernate
                // create-drop, etc.) l'absence de la table est attendue et NE doit PAS
                // faire passer /actuator/health en DOWN. On reporte UP avec un
                // detail explicite pour la transparence.
                if (!liquibaseConfigured) {
                    return Health.up()
                            .withDetail("status", "not configured")
                            .withDetail("interpretation",
                                    "spring.liquibase.enabled=false on this environment — "
                                            + "schema managed by another mechanism (Hibernate ddl-auto, "
                                            + "or external Liquibase Bootstrap workflow).")
                            .build();
                }
                // Sinon : Liquibase est cense etre actif (prod Phase 5+) mais la
                // table manque → vraie anomalie.
                return Health.down()
                        .withDetail("reason", "databasechangelog table does not exist")
                        .withDetail("interpretation",
                                "Liquibase is enabled but has never been initialized on this database. "
                                        + "Run the Liquibase Bootstrap workflow if this is unexpected.")
                        .build();
            }

            // 2. Combien de changesets traces ?
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM databasechangelog", Integer.class
            );

            // 3. Date du dernier changeset applique
            Timestamp lastExecRaw = jdbcTemplate.queryForObject(
                    "SELECT MAX(dateexecuted) FROM databasechangelog", Timestamp.class
            );
            LocalDateTime lastExec = lastExecRaw != null ? lastExecRaw.toLocalDateTime() : null;

            // 4. Etat du lock
            List<Map<String, Object>> lockRows = jdbcTemplate.queryForList(
                    "SELECT locked, lockgranted FROM databasechangeloglock WHERE id = 1"
            );
            if (lockRows.isEmpty()) {
                return Health.down()
                        .withDetail("reason", "databasechangeloglock has no row for id=1")
                        .withDetail("interpretation",
                                "Lock table is corrupted. Manual fix required: "
                                        + "INSERT INTO databasechangeloglock (id, locked) VALUES (1, false).")
                        .build();
            }
            Boolean locked = (Boolean) lockRows.get(0).get("locked");
            Timestamp lockGrantedRaw = (Timestamp) lockRows.get(0).get("lockgranted");

            if (Boolean.TRUE.equals(locked) && lockGrantedRaw != null) {
                Duration heldFor = Duration.between(lockGrantedRaw.toLocalDateTime(), LocalDateTime.now());
                if (heldFor.getSeconds() > staleLockThresholdSeconds) {
                    return Health.down()
                            .withDetail("reason", "Stale Liquibase lock detected")
                            .withDetail("lockHeldForSeconds", heldFor.getSeconds())
                            .withDetail("thresholdSeconds", staleLockThresholdSeconds)
                            .withDetail("interpretation",
                                    "A previous Liquibase run likely crashed without releasing the lock. "
                                            + "Manual unlock required: "
                                            + "UPDATE databasechangeloglock SET locked=false WHERE id=1.")
                            .build();
                }
            }

            return Health.up()
                    .withDetail("trackedChangesets", count != null ? count : 0)
                    .withDetail("lastExecuted", lastExec != null ? lastExec.toString() : "n/a")
                    .withDetail("locked", Boolean.TRUE.equals(locked))
                    .build();

        } catch (Exception e) {
            log.warn("Liquibase health check failed: {}", e.getMessage());
            return Health.down()
                    .withDetail("error", e.getClass().getSimpleName())
                    .withDetail("message", e.getMessage())
                    .build();
        }
    }
}
