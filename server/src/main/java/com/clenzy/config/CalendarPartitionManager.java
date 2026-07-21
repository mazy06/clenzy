package com.clenzy.config;

import com.clenzy.model.Incident.IncidentType;
import com.clenzy.service.IncidentService;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Cree automatiquement les partitions mensuelles de calendar_days
 * 6 mois a l'avance. Execute chaque 1er du mois a 03h00 + un rattrapage au boot.
 *
 * <p><b>Echec non silencieux (Z1-BUGS-10)</b> : un echec de creation est
 * logge en ERROR, comptabilise (Micrometer) et — s'il n'a pas pu etre
 * auto-repare — remonte aux SUPER_ADMIN / SUPER_MANAGER via un incident
 * dedupliqué ({@link IncidentService}). Sans cela, la panne ne se manifestait
 * que ~18 mois plus tard quand les INSERT dans calendar_days echouaient faute
 * de partition. Le job ne propage jamais l'exception : un mois en echec
 * n'empeche pas les suivants et le scheduler continue de tourner.</p>
 *
 * <h2>Auto-reparation du recouvrement DEFAULT (durcissement 2026-07)</h2>
 * <p>calendar_days possede une partition {@code DEFAULT} (attrape-tout). Des
 * qu'une ecriture porte une date au-dela de la couverture des partitions
 * (booking a horizon lointain, event iCal futur, push de dispo OTA...), la
 * ligne tombe dans la DEFAULT. Or PostgreSQL <b>refuse</b> alors de creer la
 * partition de ce mois ({@code CREATE TABLE ... PARTITION OF} → "updated
 * partition constraint for default partition would be violated by some row").
 * Le probleme s'auto-entretient et ouvrait un incident P1 recurrent
 * (cf. changeset 0292, correctif one-shot au boot).</p>
 *
 * <p>Ce manager rend le job <b>auto-reparant</b> : quand la creation rapide
 * echoue, il tente une repartition (detache la DEFAULT, cree les partitions
 * manquantes, re-route les lignes, reattache une DEFAULT vide — meme logique
 * que 0292, serialisee entre instances par un verrou d'avis). Un incident
 * n'est ouvert que si, apres reparation, des partitions restent manquantes
 * (echec reellement non recuperable : droits, DB down...). Une jauge
 * {@code clenzy.calendar.partition.default.future_backlog} expose le nombre de
 * lignes futures accumulees dans la DEFAULT — signal precoce AVANT tout echec.</p>
 *
 * Niveau 8 — Scalabilite : gestion automatique des partitions.
 */
@Component
public class CalendarPartitionManager {

    private static final Logger log = LoggerFactory.getLogger(CalendarPartitionManager.class);
    private static final DateTimeFormatter PARTITION_FMT = DateTimeFormatter.ofPattern("yyyy_MM");

    /** Nom de service utilise pour la deduplication des incidents. */
    static final String INCIDENT_SERVICE_NAME = "calendar-partition-manager";

    /** Fenetre creee a chaque run : mois {@code +HORIZON_START} .. {@code +HORIZON_START+HORIZON_COUNT-1}. */
    private static final int HORIZON_START_MONTHS = 18;
    private static final int HORIZON_COUNT = 6;

    /**
     * Repartition idempotente serialisee (verrou d'avis transactionnel pour
     * eviter que deux instances detachent la DEFAULT en meme temps). Detache la
     * DEFAULT, cree les partitions manquantes (12 mois passes → 36 mois futurs),
     * re-injecte les lignes de l'ancienne DEFAULT (routage auto) puis reattache
     * une DEFAULT vide. Meme logique prouvee que le changeset 0292, mais
     * declenchable a chaud par le job (pas seulement au boot). No-op si la table
     * n'est pas partitionnee.
     */
    private static final String SELF_HEAL_SQL = """
            DO $$
            DECLARE
                is_partitioned BOOLEAN;
                has_default    BOOLEAN;
                m              DATE;
                start_month    DATE;
                end_month      DATE;
                part_name      TEXT;
            BEGIN
                PERFORM pg_advisory_xact_lock(742042);

                SELECT EXISTS (
                    SELECT 1 FROM pg_partitioned_table pt
                    JOIN pg_class c ON c.oid = pt.partrelid
                    WHERE c.relname = 'calendar_days'
                ) INTO is_partitioned;
                IF NOT is_partitioned THEN
                    RETURN;
                END IF;

                SELECT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'calendar_days_default')
                    INTO has_default;
                IF has_default THEN
                    ALTER TABLE calendar_days DETACH PARTITION calendar_days_default;
                    ALTER TABLE calendar_days_default RENAME TO calendar_days_default_heal;
                END IF;

                start_month := date_trunc('month', CURRENT_DATE - INTERVAL '12 months');
                end_month   := date_trunc('month', CURRENT_DATE + INTERVAL '36 months');
                m := start_month;
                WHILE m < end_month LOOP
                    part_name := 'calendar_days_' || to_char(m, 'YYYY_MM');
                    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = part_name) THEN
                        EXECUTE format(
                            'CREATE TABLE %I PARTITION OF calendar_days FOR VALUES FROM (%L) TO (%L)',
                            part_name, m, m + INTERVAL '1 month'
                        );
                    END IF;
                    m := m + INTERVAL '1 month';
                END LOOP;

                IF has_default THEN
                    CREATE TABLE calendar_days_default PARTITION OF calendar_days DEFAULT;
                    INSERT INTO calendar_days SELECT * FROM calendar_days_default_heal;
                    DROP TABLE calendar_days_default_heal;
                END IF;
            END $$;
            """;

    private final JdbcTemplate jdbcTemplate;
    private final IncidentService incidentService;
    private final Counter partitionFailureCounter;
    /** Valeur exposee par la jauge future_backlog, rafraichie a chaque run. */
    private final AtomicLong defaultFutureBacklog = new AtomicLong(0);

    public CalendarPartitionManager(JdbcTemplate jdbcTemplate,
                                    IncidentService incidentService,
                                    MeterRegistry meterRegistry) {
        this.jdbcTemplate = jdbcTemplate;
        this.incidentService = incidentService;
        this.partitionFailureCounter = Counter.builder("clenzy.calendar.partition.creation.failures")
                .description("Nombre d'echecs de creation de partition mensuelle calendar_days")
                .register(meterRegistry);
        Gauge.builder("clenzy.calendar.partition.default.future_backlog", defaultFutureBacklog, AtomicLong::get)
                .description("Lignes futures accumulees dans la partition DEFAULT de calendar_days "
                        + "(signal precoce avant echec de creation de partition)")
                .register(meterRegistry);
    }

    /**
     * Rattrapage au demarrage : si l'app etait down quand le cron mensuel aurait
     * du tourner (fenetre de deploiement, scale-to-zero...), la frontiere des
     * partitions a pu reculer. Idempotent et gate sur table partitionnee → no-op
     * en dev (table plate) et sans effet si tout est deja a jour.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void catchUpOnBoot() {
        ensurePartitions("boot");
    }

    /**
     * Cree 6 partitions futures (18 a 23 mois a l'avance).
     * La migration 0050 cree deja 24 mois a l'avance, donc ce job
     * s'assure que de nouvelles partitions sont toujours disponibles.
     */
    @Scheduled(cron = "0 0 3 1 * *") // 1er du mois a 03h00
    public void createFuturePartitions() {
        ensurePartitions("cron");
    }

    /**
     * Coeur du job (partage cron + boot). Fast-path : creation rapide des
     * partitions manquantes. En cas d'echec, tentative d'auto-reparation puis
     * alerte uniquement si des partitions restent manquantes.
     */
    private void ensurePartitions(String trigger) {
        // Selon l'environnement, calendar_days peut etre une table PLATE (dev, recreee
        // par Hibernate ddl-auto) et non partitionnee. Y creer une partition echouerait
        // systematiquement ("table is not partitioned") — erreur NON transitoire → on
        // skip proprement (log) au lieu de spammer un incident chaque mois.
        if (!isCalendarDaysPartitioned()) {
            log.info("calendar_days non partitionnee — creation de partitions ignoree ({}, table plate).", trigger);
            return;
        }

        LocalDate today = LocalDate.now();
        List<String> failedPartitions = new ArrayList<>();

        for (int i = 0; i < HORIZON_COUNT; i++) {
            LocalDate month = today.plusMonths(HORIZON_START_MONTHS + i);
            String partitionName = "calendar_days_" + month.format(PARTITION_FMT);
            String fromDate = month.withDayOfMonth(1).toString();
            String toDate = month.plusMonths(1).withDayOfMonth(1).toString();

            try {
                if (partitionExists(partitionName)) {
                    log.debug("Partition deja existante: {}", partitionName);
                    continue;
                }

                // IF NOT EXISTS : supprime la course check-then-act si plusieurs
                // instances executent le job simultanement (Z1-BUGS-10) — le
                // pre-check ci-dessus n'est qu'une optimisation de log.
                String sql = String.format(
                        "CREATE TABLE IF NOT EXISTS %s PARTITION OF calendar_days FOR VALUES FROM ('%s') TO ('%s')",
                        partitionName, fromDate, toDate
                );
                jdbcTemplate.execute(sql);
                log.info("Partition creee: {}", partitionName);
            } catch (Exception e) {
                log.error("Erreur creation partition {}", partitionName, e);
                partitionFailureCounter.increment();
                failedPartitions.add(partitionName);
            }
        }

        // Signal precoce : combien de lignes futures se sont accumulees dans la
        // DEFAULT (avant meme qu'une creation echoue). Best-effort.
        refreshDefaultBacklogGauge();

        if (failedPartitions.isEmpty()) {
            return;
        }

        // Auto-reparation : la cause la plus frequente d'echec est un
        // recouvrement DEFAULT (une ligne future deja presente dans la partition
        // par defaut). La repartition idempotente le resout. Best-effort.
        attemptSelfHeal();

        List<String> stillMissing = new ArrayList<>();
        for (String partitionName : failedPartitions) {
            boolean exists;
            try {
                exists = partitionExists(partitionName);
            } catch (Exception e) {
                exists = false; // impossible de confirmer → on considere toujours manquant
            }
            if (!exists) {
                stillMissing.add(partitionName);
            }
        }

        if (stillMissing.isEmpty()) {
            log.warn("Partitions calendar_days auto-reparees ({} mois) via repartition DEFAULT.",
                    failedPartitions.size());
        } else {
            alertPartitionCreationFailure(stillMissing);
        }
    }

    /**
     * Probe a la demande (bouton « Retest » d'un incident) : verifie que les
     * partitions cibles existent et, si besoin, tente une reparation. Retourne
     * {@code true} si tout est sain a l'issue. N'ouvre AUCUN incident (le retest
     * sert a resoudre l'incident existant, pas a en creer). No-op sain quand la
     * table n'est pas partitionnee (dev) : il n'y a alors rien a reparer, donc
     * aucune panne possible → le retest resout l'incident bloque.
     */
    public boolean probeAndHeal() {
        if (!isCalendarDaysPartitioned()) {
            return true;
        }
        if (allTargetPartitionsExist()) {
            return true;
        }
        attemptSelfHeal();
        return allTargetPartitionsExist();
    }

    /** True si les {@link #HORIZON_COUNT} partitions cibles (18..23 mois) existent toutes. */
    private boolean allTargetPartitionsExist() {
        LocalDate today = LocalDate.now();
        for (int i = 0; i < HORIZON_COUNT; i++) {
            LocalDate month = today.plusMonths(HORIZON_START_MONTHS + i);
            String partitionName = "calendar_days_" + month.format(PARTITION_FMT);
            try {
                if (!partitionExists(partitionName)) {
                    return false;
                }
            } catch (Exception e) {
                return false; // impossible de confirmer → considere non sain
            }
        }
        return true;
    }

    /**
     * Tente la repartition auto-reparante ({@link #SELF_HEAL_SQL}). Best-effort :
     * un echec (droits insuffisants, DB down...) est loggue sans propager — le
     * flux appelant re-verifiera l'etat et alertera si besoin.
     */
    private void attemptSelfHeal() {
        try {
            jdbcTemplate.execute(SELF_HEAL_SQL);
            log.warn("Auto-reparation des partitions calendar_days executee (repartition DEFAULT).");
        } catch (Exception e) {
            log.error("Auto-reparation des partitions calendar_days echouee", e);
        }
    }

    /**
     * Rafraichit la jauge {@code future_backlog} = lignes de la partition DEFAULT
     * portant une date >= aujourd'hui. Un backlog > 0 signale que des ecritures
     * depassent la couverture des partitions et finiront par bloquer la creation
     * — a surveiller (alerte Grafana) avant l'echec. Best-effort.
     */
    private void refreshDefaultBacklogGauge() {
        try {
            Long backlog = jdbcTemplate.queryForObject(
                    "SELECT count(*) FROM calendar_days_default WHERE date >= CURRENT_DATE",
                    Long.class);
            long value = backlog != null ? backlog : 0L;
            defaultFutureBacklog.set(value);
            if (value > 0) {
                log.warn("calendar_days_default contient {} ligne(s) future(s) — la couverture des "
                        + "partitions est en retard, l'auto-reparation les re-routera au prochain cycle.", value);
            }
        } catch (Exception e) {
            // Partition DEFAULT absente selon l'env, ou erreur transitoire : on
            // laisse la derniere valeur connue de la jauge, sans bruit d'erreur.
            log.debug("Impossible de mesurer le backlog de calendar_days_default", e);
        }
    }

    /** True si {@code calendar_days} est une table partitionnee (vs table plate en dev). */
    private boolean isCalendarDaysPartitioned() {
        try {
            Boolean partitioned = jdbcTemplate.queryForObject(
                    "SELECT EXISTS (SELECT 1 FROM pg_partitioned_table pt "
                            + "JOIN pg_class c ON c.oid = pt.partrelid WHERE c.relname = 'calendar_days')",
                    Boolean.class);
            return Boolean.TRUE.equals(partitioned);
        } catch (Exception e) {
            // Base non-PostgreSQL (H2 en test) ou catalogue indisponible : on
            // considere non partitionnee → no-op propre (protege le rattrapage boot).
            log.debug("Verification du partitionnement de calendar_days impossible — considere non partitionnee", e);
            return false;
        }
    }

    private boolean partitionExists(String partitionName) {
        Boolean exists = jdbcTemplate.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM pg_class WHERE relname = ?)",
                Boolean.class, partitionName);
        return Boolean.TRUE.equals(exists);
    }

    /**
     * Alerte plateforme : ouvre un incident dedupliqué (type + service) qui
     * notifie les SUPER_ADMIN/SUPER_MANAGER via INCIDENT_OPENED — meme
     * philosophie que notifyLedgerReconciliationRequired cote Stripe.
     * Best-effort : un echec d'alerte est loggue sans bloquer le job.
     */
    private void alertPartitionCreationFailure(List<String> failedPartitions) {
        try {
            incidentService.openIncident(
                    IncidentType.SERVICE_DOWN,
                    INCIDENT_SERVICE_NAME,
                    "Echec creation partitions calendar_days",
                    "La creation des partitions mensuelles a echoue (auto-reparation infructueuse) pour : "
                            + String.join(", ", failedPartitions)
                            + ". Sans correction, les INSERT dans calendar_days echoueront"
                            + " des que ces mois seront atteints (panne differee).");
        } catch (Exception alertEx) {
            log.error("Impossible d'ouvrir l'incident pour l'echec de creation des partitions {}",
                    failedPartitions, alertEx);
        }
    }
}
