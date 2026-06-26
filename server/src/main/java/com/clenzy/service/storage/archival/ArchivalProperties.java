package com.clenzy.service.storage.archival;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;
import java.util.Optional;

/**
 * Contrat de configuration de l'archivage froid ({@code clenzy.archival.*}).
 *
 * <p><b>DESACTIVE PAR DEFAUT</b> ({@link #enabled()} = {@code false}). Tant que le flag est
 * a {@code false}, le moteur {@link ArchivalService} est totalement inerte : aucune donnee
 * n'est lue, exportee ou supprimee. C'est un INVARIANT de cette phase — le mecanisme ne
 * s'active QUE par une decision explicite de l'exploitant.</p>
 *
 * <h2>Ce moteur ne decide RIEN a votre place</h2>
 * Aucune duree de retention legale, aucune table, aucune politique de purge n'est codee en
 * dur. L'exploitant decrit ses cibles d'archivage via {@link #targets()} et fournit, en code,
 * une {@link ArchivalSource} portant le meme {@code name} (voir la doc de {@link ArchivalService}).
 * Avant activation, l'exploitant DOIT decider :
 * <ul>
 *   <li><b>quelles donnees archiver</b> (ex : reservations cloturees anciennes, factures NF
 *       hors periode courante…) — materialisees par une {@link ArchivalSource} ;</li>
 *   <li><b>les durees de retention legales applicables</b> (ex : factures FR ~10 ans,
 *       art. L123-22 C. com. / L102 B LPF — a confirmer avec un conseil) ;</li>
 *   <li><b>l'immuabilite cote OVH</b> : bucket en classe « Cold Archive » + Object Lock/WORM.</li>
 * </ul>
 *
 * <h2>Exemple ({@code application-archival.yml}, non actif tant que enabled=false)</h2>
 * <pre>
 * clenzy:
 *   archival:
 *     enabled: false            # ne JAMAIS passer a true sans avoir tranche les points ci-dessus
 *     batch-size: 500
 *     targets:
 *       - name: reservations-cold
 *         description: "Reservations cloturees au-dela de la retention courante"
 *       - name: invoices-nf-archive
 *         description: "Factures NF anciennes (retention legale a definir)"
 * </pre>
 */
@ConfigurationProperties(prefix = "clenzy.archival")
public record ArchivalProperties(
        boolean enabled,
        Integer batchSize,
        List<Target> targets) {

    /** Taille de batch par defaut si non configuree (borne l'usage memoire / la taille des objets). */
    public static final int DEFAULT_BATCH_SIZE = 500;

    public ArchivalProperties {
        // enabled : defaut Java false (volontaire — desactive par defaut).
        targets = targets != null ? List.copyOf(targets) : List.of();
    }

    /** Taille de batch effective, clampee a une valeur saine ({@value #DEFAULT_BATCH_SIZE} si absente). */
    public int effectiveBatchSize() {
        if (batchSize == null || batchSize <= 0) {
            return DEFAULT_BATCH_SIZE;
        }
        return Math.min(batchSize, 5_000);
    }

    /** Recherche une cible configuree par son nom (insensible a la casse des espaces superflus). */
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
     * Une cible d'archivage. Volontairement MINIMALE et extensible : juste un identifiant
     * stable ({@code name}, qui doit matcher une {@link ArchivalSource}) et une description
     * libre. On n'y met PAS de duree/table : ces choix appartiennent a la {@link ArchivalSource}
     * et a la decision de l'exploitant, pas a un champ de config fige.
     */
    public record Target(String name, String description) {
        public Target {
            name = name != null ? name.trim() : "";
            description = description != null ? description : "";
        }
    }
}
