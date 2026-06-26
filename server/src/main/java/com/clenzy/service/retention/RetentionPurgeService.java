package com.clenzy.service.retention;

import com.clenzy.model.AuditAction;
import com.clenzy.model.AuditSource;
import com.clenzy.service.AuditLogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Moteur de <b>purge de retention</b> generique, configurable et <b>DESACTIVE PAR DEFAUT</b>.
 *
 * <p>Il <b>SUPPRIME</b> les enregistrements designes dont la duree de conservation legale est
 * expiree (plus vieux que {@code now - retentionDays}). C'est une operation <b>irreversible</b> :
 * le moteur est donc protege par un <b>triple verrou d'inertie</b> et journalise chaque suppression
 * (exigence de conformite). Miroir defensif du moteur d'archivage
 * ({@code com.clenzy.service.storage.archival.ArchivalService}), avec une securite renforcee.</p>
 *
 * <h2>Inerte par defaut (triple verrou)</h2>
 * <ol>
 *   <li>{@code clenzy.retention.purge.enabled=false} (defaut) ⇒ {@link #purge(String, Boolean)}
 *       est un no-op total (aucun comptage, aucune suppression).</li>
 *   <li>Aucune {@link PurgeSource} fournie pour la cible ⇒ rien a purger (no-op
 *       {@code no-source-registered}). Aucune {@code PurgeSource} n'est fournie par defaut.</li>
 *   <li>{@code dry-run-default=true} (defaut) ⇒ un appel sans surcharge {@code dryRun=false}
 *       explicite <b>ne supprime RIEN</b> : il compte seulement les candidats.</li>
 * </ol>
 *
 * <h2>Generique — aucune table/duree en dur</h2>
 * Le moteur ne connait ni table ni entite ni duree legale. Le « quoi purger » est porte par une
 * {@link PurgeSource} (SPI) fournie en code par l'exploitant ; la duree vient de la config
 * ({@code targets[].retentionDays}, cf. {@code server/docs/RETENTION-POLICY.md}).
 *
 * <h2>Securite de suppression</h2>
 * <ul>
 *   <li><b>Bornee par batch</b> : suppression par lots de {@code batchSize}, chacun dans une
 *       transaction propre (cote {@link PurgeSource}) — jamais une seule grosse transaction.</li>
 *   <li><b>Garde-fou anti-boucle</b> : le nombre total de batches est plafonne ({@value #MAX_BATCHES}).</li>
 *   <li><b>Audit obligatoire</b> : chaque run reel (suppression effective) est trace (qui/quand/
 *       quoi/combien) via {@link AuditLogService} si disponible, plus un log INFO explicite.</li>
 * </ul>
 */
@Service
public class RetentionPurgeService {

    private static final Logger log = LoggerFactory.getLogger(RetentionPurgeService.class);

    /** Garde-fou anti-boucle : borne le nombre de batches d'un run (source mal bornee / cutoff glissant). */
    static final int MAX_BATCHES = 100_000;

    private final RetentionPurgeProperties properties;
    private final Clock clock;
    /** Audit applicatif (optionnel) ; un log INFO explicite sert de repli si absent. */
    private final ObjectProvider<AuditLogService> auditLogService;
    /** Sources indexees par {@code targetName} (peut etre vide : aucune source fournie par defaut). */
    private final Map<String, PurgeSource> sourcesByTarget;

    public RetentionPurgeService(RetentionPurgeProperties properties,
                                 Clock clock,
                                 ObjectProvider<AuditLogService> auditLogService,
                                 List<PurgeSource> sources) {
        this.properties = properties;
        this.clock = clock;
        this.auditLogService = auditLogService;
        this.sourcesByTarget = indexByTarget(sources);
    }

    /**
     * Resultat agrege d'un run de purge (logging + reponse admin).
     *
     * @param target     nom de la cible demandee
     * @param executed   {@code true} si le run a reellement evalue/purge la cible ; {@code false}
     *                   si no-op (desactive, cible inconnue, pas de source, retention non configuree)
     * @param dryRun     mode effectif : {@code true} = aucune suppression (comptage seul)
     * @param reason     explication courte (surtout quand {@code executed=false})
     * @param candidates nombre d'enregistrements expires detectes (countExpired)
     * @param deleted    nombre d'enregistrements reellement supprimes ({@code 0} en dry-run)
     */
    public record PurgeResult(String target, boolean executed, boolean dryRun, String reason,
                              long candidates, long deleted) {

        static PurgeResult noop(String target, String reason) {
            return new PurgeResult(target, false, true, reason, 0L, 0L);
        }
    }

    /**
     * Purge la cible {@code targetName} : supprime ses enregistrements expires (plus vieux que
     * {@code now - retentionDays}). En dry-run (defaut), <b>ne supprime RIEN</b> et renvoie
     * seulement le nombre de candidats.
     *
     * <p>No-op ({@code executed=false}) si : la purge est desactivee ({@code purge-disabled}), la
     * cible n'est pas configuree ({@code unknown-target}), aucune {@link PurgeSource} n'est
     * enregistree pour la cible ({@code no-source-registered}), ou {@code retentionDays} est
     * {@code null}/≤ 0 ({@code retention-not-configured}).</p>
     *
     * @param targetName     nom de la cible ({@code clenzy.retention.purge.targets[].name})
     * @param dryRunOverride {@code null} = utilise {@code dry-run-default} (defaut true) ;
     *                       {@code true} = comptage seul ; {@code false} = suppression reelle
     * @return compteurs agreges + indicateurs d'execution
     */
    public PurgeResult purge(String targetName, Boolean dryRunOverride) {
        if (!properties.enabled()) {
            log.info("Purge de retention DESACTIVEE (clenzy.retention.purge.enabled=false) : no-op pour target='{}'.",
                    targetName);
            return PurgeResult.noop(targetName, "purge-disabled");
        }

        final Optional<RetentionPurgeProperties.Target> target = properties.findTarget(targetName);
        if (target.isEmpty()) {
            log.warn("Purge : cible '{}' inconnue (absente de clenzy.retention.purge.targets) : no-op.",
                    targetName);
            return PurgeResult.noop(targetName, "unknown-target");
        }

        final PurgeSource source = sourcesByTarget.get(target.get().name());
        if (source == null) {
            log.warn("Purge : aucune PurgeSource enregistree pour la cible '{}' : rien a purger "
                    + "(fournir une implementation de PurgeSource).", targetName);
            return PurgeResult.noop(targetName, "no-source-registered");
        }

        final Integer retentionDays = target.get().retentionDays();
        if (retentionDays == null || retentionDays <= 0) {
            log.warn("Purge : cible '{}' sans retentionDays valide ({}) : no-op "
                    + "(la duree de retention doit etre configuree, > 0).", targetName, retentionDays);
            return PurgeResult.noop(targetName, "retention-not-configured");
        }

        final boolean dryRun = dryRunOverride != null ? dryRunOverride : properties.effectiveDryRunDefault();
        final Instant cutoff = Instant.now(clock).minus(Duration.ofDays(retentionDays));

        return run(target.get().name(), source, retentionDays, cutoff, dryRun);
    }

    /**
     * Itere toutes les cibles configurees (utilise par le scheduler). Chaque cible est evaluee
     * independamment ; un no-op sur l'une n'empeche pas les autres.
     *
     * @param dryRun {@code true} = comptage seul sur toutes les cibles ; {@code false} = suppression
     * @return un {@link PurgeResult} par cible configuree
     */
    public List<PurgeResult> purgeAllConfigured(boolean dryRun) {
        if (!properties.enabled()) {
            log.info("Purge de retention DESACTIVEE : purgeAllConfigured no-op.");
            return List.of();
        }
        return properties.targets().stream()
                .map(t -> purge(t.name(), dryRun))
                .toList();
    }

    /**
     * Boucle de purge : compte les candidats, puis (mode reel uniquement) supprime par batchs
     * bornes jusqu'a epuisement, avec garde-fou anti-boucle. En dry-run : countExpired seul,
     * {@code deleteExpiredBatch} JAMAIS appele.
     */
    private PurgeResult run(String targetName, PurgeSource source, int retentionDays,
                            Instant cutoff, boolean dryRun) {
        final long candidates = source.countExpired(cutoff);
        log.info("Purge {} : target='{}', retentionDays={}, cutoff={}, candidats={}.",
                dryRun ? "DRY-RUN (aucune suppression)" : "REELLE", targetName, retentionDays,
                cutoff, candidates);

        if (dryRun) {
            return new PurgeResult(targetName, true, true, "dry-run", candidates, 0L);
        }

        final int batchSize = properties.effectiveBatchSize();
        long deleted = 0L;
        int batches = 0;

        while (batches < MAX_BATCHES) {
            final int removed = source.deleteExpiredBatch(cutoff, batchSize);
            if (removed <= 0) {
                break;
            }
            deleted += removed;
            batches++;
            log.info("Purge : target='{}' batch {} -> {} enregistrement(s) supprime(s) (cumul {}).",
                    targetName, batches, removed, deleted);
            if (removed < batchSize) {
                break; // dernier batch (partiel) -> plus rien a purger
            }
        }

        if (batches >= MAX_BATCHES) {
            log.warn("Purge : garde-fou anti-boucle atteint pour target='{}' ({} batches) : arret. "
                    + "Verifier que deleteExpiredBatch borne bien la suppression au cutoff.",
                    targetName, MAX_BATCHES);
        }

        audit(targetName, cutoff, candidates, deleted);
        log.info("Purge TERMINEE : target='{}', cutoff={}, candidats={}, supprimes={}.",
                targetName, cutoff, candidates, deleted);
        return new PurgeResult(targetName, true, false, "ok", candidates, deleted);
    }

    /**
     * Trace de conformite d'un run reel (qui/quand/quoi/combien). Defensive : l'audit ne doit
     * JAMAIS faire echouer la purge. Acteur enrichi depuis le SecurityContext par
     * {@link AuditLogService} quand l'appel vient d'un endpoint admin ; source {@code SYSTEM}
     * quand declenche par le scheduler.
     */
    private void audit(String targetName, Instant cutoff, long candidates, long deleted) {
        final AuditLogService service = auditLogService.getIfAvailable();
        if (service == null) {
            return; // le log INFO explicite ci-dessous (dans run) suffit comme trace minimale
        }
        try {
            final String details = String.format(
                    "Purge retention target='%s' cutoff=%s candidats=%d supprimes=%d",
                    targetName, cutoff, candidates, deleted);
            service.logAction(AuditAction.DELETE, "RetentionPurge", targetName,
                    null, String.valueOf(deleted), details, AuditSource.SYSTEM);
        } catch (Exception e) {
            // L'audit ne doit JAMAIS faire echouer la purge.
            log.warn("[RETENTION-PURGE] Echec de l'audit de la purge '{}' : {}", targetName, e.getMessage());
        }
    }

    private static Map<String, PurgeSource> indexByTarget(List<PurgeSource> sources) {
        final Map<String, PurgeSource> map = new java.util.HashMap<>();
        for (PurgeSource s : sources != null ? sources : List.<PurgeSource>of()) {
            final String name = s.targetName();
            if (name == null || name.isBlank()) {
                throw new IllegalStateException(
                        "PurgeSource " + s.getClass().getName() + " a un targetName vide.");
            }
            final PurgeSource previous = map.putIfAbsent(name.trim(), s);
            if (previous != null) {
                throw new IllegalStateException("Deux PurgeSource declarent la meme cible '" + name
                        + "' : " + previous.getClass().getName() + " et " + s.getClass().getName());
            }
        }
        return Map.copyOf(map);
    }
}
