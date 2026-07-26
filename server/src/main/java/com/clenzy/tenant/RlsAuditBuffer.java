package com.clenzy.tenant;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Tampon mémoire des constats de l'audit RLS — audit sécurité 2026-07-26, plan REM-T-01.
 *
 * <p><b>Pourquoi un tampon plutôt qu'une écriture directe.</b> Les constats naissent dans
 * {@link RlsMissingGucInspector}, un {@code StatementInspector} Hibernate appelé pour
 * <i>chaque</i> requête. Y écrire en base déclencherait un {@code INSERT}, donc un nouvel
 * appel à l'inspecteur — et une écriture par requête sur un chemin très emprunté
 * coûterait bien plus cher que la mesure qu'elle sert.
 *
 * <p>Les constats sont donc agrégés ici, en mémoire et sans verrou, puis vidés
 * périodiquement en base par {@link com.clenzy.scheduler.RlsAuditFlushScheduler}.
 *
 * <p>Volontairement statique : l'inspecteur est instancié par Hibernate, hors du contexte
 * Spring, et ne peut donc pas recevoir d'injection.
 */
public final class RlsAuditBuffer {

    /** Clé : origine applicative + table. C'est l'unité de correction. */
    private static final Map<String, Constat> CONSTATS = new ConcurrentHashMap<>();

    /**
     * Borne de sécurité. Atteindre ce plafond signale une diversité de chemins bien
     * supérieure à l'attendu — information en soi, et non un simple garde-fou mémoire.
     */
    private static final int MAX_CONSTATS = 500;

    private RlsAuditBuffer() {
    }

    /** Un chemin observé : où, sur quelle table, combien de fois. */
    public static final class Constat {
        private final String origin;
        private final String tableName;
        private final String sqlExcerpt;
        private final AtomicLong occurrences = new AtomicLong();
        private volatile LocalDateTime lastSeenAt;

        Constat(String origin, String tableName, String sqlExcerpt) {
            this.origin = origin;
            this.tableName = tableName;
            this.sqlExcerpt = sqlExcerpt;
            this.lastSeenAt = LocalDateTime.now();
        }

        public String origin() { return origin; }
        public String tableName() { return tableName; }
        public String sqlExcerpt() { return sqlExcerpt; }
        public long occurrences() { return occurrences.get(); }
        public LocalDateTime lastSeenAt() { return lastSeenAt; }
    }

    /**
     * Enregistre une occurrence.
     *
     * @return {@code true} si ce chemin est vu pour la première fois — l'appelant peut
     *         alors le journaliser sans risquer d'inonder les logs.
     */
    public static boolean enregistrer(String origin, String tableName, String sqlExcerpt) {
        String cle = origin + '|' + tableName;
        boolean nouveau = !CONSTATS.containsKey(cle);
        if (nouveau && CONSTATS.size() >= MAX_CONSTATS) {
            return false;
        }
        Constat constat = CONSTATS.computeIfAbsent(cle, k -> new Constat(origin, tableName, sqlExcerpt));
        constat.occurrences.incrementAndGet();
        constat.lastSeenAt = LocalDateTime.now();
        return nouveau;
    }

    /**
     * Retire et retourne les constats accumulés.
     *
     * <p>Le tampon est vidé au passage : un constat déjà persisté ne doit pas être compté
     * deux fois. Le compteur en base cumule les vidages successifs.
     */
    public static Map<String, Constat> viderEtRecuperer() {
        Map<String, Constat> copie = Map.copyOf(CONSTATS);
        CONSTATS.clear();
        return copie;
    }

    /** Nombre de chemins distincts en attente de persistance. */
    public static int enAttente() {
        return CONSTATS.size();
    }

    public static boolean plafondAtteint() {
        return CONSTATS.size() >= MAX_CONSTATS;
    }
}
