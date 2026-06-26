package com.clenzy.service.retention;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;
import java.util.Optional;

/**
 * Contrat de configuration de la <b>purge de retention</b> ({@code clenzy.retention.purge.*}).
 *
 * <p><b>TRIPLE VERROU D'INERTIE — TOUT DESACTIVE PAR DEFAUT.</b> A la difference de l'archivage
 * (qui exporte en lecture seule), la purge <b>SUPPRIME</b> des donnees : l'operation est
 * <b>irreversible</b>. Le mecanisme est donc protege par trois flags qui valent {@code false}/
 * {@code true} de la maniere la plus sure possible :</p>
 * <ol>
 *   <li>{@link #enabled()} = {@code false} (defaut) ⇒ le moteur {@link RetentionPurgeService} est
 *       totalement inerte : aucun comptage, aucune suppression.</li>
 *   <li>{@link #schedulerEnabled()} = {@code false} (defaut) ⇒ le {@link RetentionPurgeScheduler}
 *       ne declenche jamais de purge automatique. La purge planifiee exige
 *       {@code enabled && schedulerEnabled}.</li>
 *   <li>{@link #dryRunDefault()} = {@code true} (defaut) ⇒ un appel sans surcharge explicite
 *       <b>ne supprime RIEN</b> : il compte seulement les candidats. Pour supprimer pour de vrai,
 *       il faut <b>explicitement</b> passer {@code dryRun=false}.</li>
 * </ol>
 *
 * <h2>Le moteur ne decide RIEN a votre place</h2>
 * Aucune duree de retention legale, aucune table, aucune politique n'est codee en dur. L'exploitant
 * decrit ses cibles via {@link #targets()} et fournit, en code, une {@link PurgeSource} portant le
 * meme {@code name} (voir {@link RetentionPurgeService}). Les durees viennent de
 * {@code server/docs/RETENTION-POLICY.md} et sont portees par {@link Target#retentionDays()} —
 * <b>jamais en dur</b>.
 *
 * <h2>Exemple ({@code application-retention.yml}, NON actif tant que enabled=false)</h2>
 * <pre>
 * clenzy:
 *   retention:
 *     purge:
 *       enabled: false           # ne JAMAIS passer a true sans avoir tranche la politique
 *       scheduler-enabled: false # la purge automatique exige enabled ET scheduler-enabled
 *       dry-run-default: true    # un appel sans dryRun explicite ne supprime RIEN
 *       batch-size: 500          # borne par batch (max 5000)
 *       targets:                 # vide par defaut ; politique : RETENTION-POLICY.md
 *         - name: police-records
 *           description: "Fiche de police voyageurs etrangers"
 *           retention-days: 180        # 6 mois (CESEDA R814-3) — PAS d'entite a ce jour
 *           legal-basis: "FR CESEDA R814-1/R814-3 (purge obligatoire a 6 mois)"
 *         - name: payment-dispute-proof
 *           description: "Preuve de contestation de paiement (chargeback)"
 *           retention-days: 450        # 13-15 mois (CNIL 2018-303) — non stocke (delegue Stripe)
 *           legal-basis: "CNIL delib. 2018-303 + CMF L133-24"
 * </pre>
 */
@ConfigurationProperties(prefix = "clenzy.retention.purge")
public record RetentionPurgeProperties(
        boolean enabled,
        boolean schedulerEnabled,
        Boolean dryRunDefault,
        Integer batchSize,
        List<Target> targets) {

    /** Taille de batch par defaut si non configuree (borne la taille de chaque transaction de delete). */
    public static final int DEFAULT_BATCH_SIZE = 500;

    /** Plafond dur de la taille de batch (anti-grosse-transaction). */
    public static final int MAX_BATCH_SIZE = 5_000;

    public RetentionPurgeProperties {
        // enabled / schedulerEnabled : defaut Java false (volontaire — desactives par defaut).
        targets = targets != null ? List.copyOf(targets) : List.of();
    }

    /**
     * Mode dry-run par defaut : {@code true} si non configure (le plus sur).
     * Un appel sans surcharge explicite ne supprime alors RIEN.
     */
    public boolean effectiveDryRunDefault() {
        return dryRunDefault == null || dryRunDefault;
    }

    /** Taille de batch effective, clampee ({@value #DEFAULT_BATCH_SIZE} si absente, max {@value #MAX_BATCH_SIZE}). */
    public int effectiveBatchSize() {
        if (batchSize == null || batchSize <= 0) {
            return DEFAULT_BATCH_SIZE;
        }
        return Math.min(batchSize, MAX_BATCH_SIZE);
    }

    /** Recherche une cible configuree par son nom (espaces superflus ignores). */
    public Optional<Target> findTarget(String name) {
        if (name == null) {
            return Optional.empty();
        }
        final String wanted = name.trim();
        return targets.stream()
                .filter(t -> t.name() != null && t.name().trim().equals(wanted))
                .findFirst();
    }

    /**
     * Une cible de purge. {@code name} = identifiant stable (doit matcher une {@link PurgeSource}) ;
     * {@code description} = libre.
     *
     * <p>{@code retentionDays} = duree de <b>conservation</b> (en jours) decidee par l'exploitant
     * (cf. {@code server/docs/RETENTION-POLICY.md}) : au-dela de cette duree, un enregistrement
     * devient <b>purgeable</b>. Le moteur calcule {@code cutoff = now - retentionDays} et supprime
     * ce qui est plus vieux. {@code legalBasis} = base legale (auditable). Une cible dont
     * {@code retentionDays} est {@code null} ou ≤ 0 est <b>volontairement non purgeable</b>
     * (no-op {@code retention-not-configured} cote moteur) — c'est un garde-fou de plus.</p>
     */
    public record Target(String name, String description, Integer retentionDays, String legalBasis) {
        public Target {
            name = name != null ? name.trim() : "";
            description = description != null ? description : "";
            legalBasis = legalBasis != null ? legalBasis.trim() : "";
        }
    }
}
