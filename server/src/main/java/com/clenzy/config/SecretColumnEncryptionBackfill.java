package com.clenzy.config;

import com.clenzy.integration.external.service.ApiKeyEncryptionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Map;

/**
 * Backfill applicatif one-shot : chiffre, au boot, les valeurs des colonnes
 * « secret » qui sont encore EN CLAIR en base, AVANT que le trafic et les
 * lectures JPA n'arrivent (M1-MODEL-02/03/04).
 *
 * <h2>Pourquoi un runner Java et pas un changeset SQL</h2>
 * Le chiffrement (Jasypt AES-256, même clé que {@link EncryptedFieldConverter}
 * et {@link ApiKeyEncryptionService}) se fait côté Java : un changeset SQL pur
 * ne peut pas produire le ciphertext. Le changeset 0233 ne fait que préparer le
 * schéma (élargir les colonnes en {@code TEXT}, retirer le type {@code jsonb}).
 *
 * <h2>Danger neutralisé (ddl-auto=validate + converter strict)</h2>
 * Ajouter {@code @Convert(EncryptedFieldConverter.class)} sur une colonne
 * contenant des valeurs en clair fait lever une {@code FieldDecryptionException}
 * à la PREMIÈRE lecture (mode strict). Ce runner ré-écrit les valeurs en clair
 * chiffrées AVANT toute lecture entité. Lecture/écriture en SQL natif via
 * {@link JdbcTemplate} : le converter JPA n'est jamais déclenché, le runner voit
 * et écrit les valeurs brutes.
 *
 * <h2>Détection clair vs. chiffré (idempotence)</h2>
 * Une valeur déjà chiffrée se déchiffre proprement ; une valeur en clair (PIN,
 * mot de passe WiFi, JSON {@code [...]}, clé API) lève à la tentative de
 * déchiffrement (le ciphertext Jasypt est du Base64 d'au moins ~30 octets, jamais
 * un code court ou un JSON). On chiffre donc UNIQUEMENT ce qui ne se déchiffre
 * pas. Relancer le runner est sans effet (les valeurs déjà chiffrées sont
 * détectées et sautées).
 *
 * <h2>Séquence de déploiement sûre</h2>
 * Voir la doc de mission. En résumé : ce runner DOIT s'exécuter avec le converter
 * en mode tolérant ({@code clenzy.security.field-encryption.fail-on-decrypt-error=false})
 * le temps d'un boot, puis on repasse en mode strict. Le runner est ordonné
 * {@link Ordered#HIGHEST_PRECEDENCE} pour passer avant les autres runners.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SecretColumnEncryptionBackfill implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SecretColumnEncryptionBackfill.class);

    /** (table, colonne) à backfiller. Toutes portent désormais @Convert ou un encrypt() service. */
    private record SecretColumn(String table, String column) {}

    private static final List<SecretColumn> COLUMNS = List.of(
            new SecretColumn("external_pricing_configs", "api_key"),
            new SecretColumn("check_in_instructions", "access_code"),
            new SecretColumn("check_in_instructions", "wifi_password"),
            new SecretColumn("check_in_instructions", "extra_access_codes"),
            new SecretColumn("integration_partners", "api_key_encrypted")
    );

    private final JdbcTemplate jdbcTemplate;
    private final ApiKeyEncryptionService encryption;
    private final TransactionTemplate transactionTemplate;

    @Value("${clenzy.security.secret-backfill.enabled:true}")
    private boolean enabled;

    public SecretColumnEncryptionBackfill(JdbcTemplate jdbcTemplate,
                                          ApiKeyEncryptionService encryption,
                                          PlatformTransactionManager transactionManager) {
        this.jdbcTemplate = jdbcTemplate;
        this.encryption = encryption;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            log.debug("Backfill de chiffrement des secrets désactivé (clenzy.security.secret-backfill.enabled=false).");
            return;
        }
        int totalEncrypted = 0;
        for (SecretColumn col : COLUMNS) {
            try {
                int encrypted = transactionTemplate.execute(status -> backfillColumn(col));
                totalEncrypted += encrypted;
            } catch (Exception e) {
                // Non bloquant : une table absente (env partiel) ou une colonne déjà
                // entièrement chiffrée ne doit pas empêcher le démarrage. L'échec reste
                // visible (ERROR) — on ne masque jamais un problème de chiffrement.
                log.error("Backfill de chiffrement échoué pour {}.{} (non bloquant) : {}",
                        col.table(), col.column(), e.getMessage(), e);
            }
        }
        if (totalEncrypted > 0) {
            log.info("Backfill de chiffrement des secrets terminé : {} valeur(s) en clair chiffrée(s).", totalEncrypted);
        } else {
            log.debug("Backfill de chiffrement des secrets : aucune valeur en clair détectée (déjà chiffrées).");
        }
    }

    /**
     * Chiffre les valeurs en clair de la colonne. Retourne le nombre de lignes
     * ré-écrites chiffrées. Idempotent (les valeurs déjà chiffrées sont sautées).
     */
    private int backfillColumn(SecretColumn col) {
        if (!tableHasColumn(col.table(), col.column())) {
            log.debug("Colonne {}.{} absente : backfill ignoré.", col.table(), col.column());
            return 0;
        }
        String selectSql = "SELECT id, " + col.column() + " AS val FROM " + col.table()
                + " WHERE " + col.column() + " IS NOT NULL AND " + col.column() + " <> ''";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(selectSql);

        String updateSql = "UPDATE " + col.table() + " SET " + col.column() + " = ? WHERE id = ?";
        int encrypted = 0;
        for (Map<String, Object> row : rows) {
            Object raw = row.get("val");
            if (raw == null) {
                continue;
            }
            String value = raw.toString();
            if (isAlreadyEncrypted(value)) {
                continue; // idempotence : valeur déjà chiffrée, on ne re-chiffre pas
            }
            String cipher = encryption.encrypt(value);
            jdbcTemplate.update(updateSql, cipher, row.get("id"));
            encrypted++;
        }
        if (encrypted > 0) {
            log.info("Backfill {}.{} : {} valeur(s) en clair chiffrée(s) (sur {} ligne(s)).",
                    col.table(), col.column(), encrypted, rows.size());
        }
        return encrypted;
    }

    /**
     * Une valeur déjà chiffrée (Jasypt AES-256) se déchiffre sans erreur. Une
     * valeur en clair (code, mot de passe, JSON, clé API) lève à la tentative de
     * déchiffrement. On ne re-chiffre que ce qui n'est pas déjà chiffré.
     */
    private boolean isAlreadyEncrypted(String value) {
        try {
            encryption.decrypt(value);
            return true;
        } catch (RuntimeException e) {
            return false;
        }
    }

    /** Vérifie l'existence de la colonne (defensive : tables Hibernate, env partiel). */
    private boolean tableHasColumn(String table, String column) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM information_schema.columns "
                        + "WHERE table_name = ? AND column_name = ?",
                Integer.class, table, column);
        return count != null && count > 0;
    }
}
