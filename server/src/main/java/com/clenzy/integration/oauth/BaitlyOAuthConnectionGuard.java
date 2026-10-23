package com.clenzy.integration.oauth;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.function.Supplier;

/** Coordonne les mutations OAuth Baitly entre instances partageant PostgreSQL. */
@Service
public class BaitlyOAuthConnectionGuard {
    private final JdbcTemplate db;
    private final TransactionTemplate transaction;
    private final TransactionTemplate durable;

    public BaitlyOAuthConnectionGuard(JdbcTemplate db, PlatformTransactionManager manager) {
        this.db = db;
        transaction = new TransactionTemplate(manager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        // Clients historiques : connexion 10 s + lecture 30 s, puis marge de commit.
        transaction.setTimeout(60);
        durable = new TransactionTemplate(manager);
        durable.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        durable.setTimeout(10);
    }

    public <T> T execute(String provider, Long organizationId, Supplier<T> operation) {
        return execute(provider, organizationId, operation, false);
    }

    /** Le refresh existant persiste ERROR avant de signaler un échec opérationnel. */
    public <T> T executeRefresh(String provider, Long organizationId, Supplier<T> operation) {
        return execute(provider, organizationId, operation, true);
    }

    public <T> T executeForUser(String provider, String userId, Supplier<T> operation) {
        return executeKey(userScope(provider, userId), operation, false);
    }

    /** Nouvelle autorisation atomique : toute erreur annule les nouvelles informations. */
    public <T> T executeAuthorization(String provider, Long organizationId, Supplier<T> operation) {
        return executeKey(organizationScope(provider, organizationId), operation, false, false, true);
    }

    public <T> T executeUserAuthorization(String provider, String userId, Supplier<T> operation) {
        return executeKey(userScope(provider, userId), operation, false, false, true);
    }

    /** Compatibilité des connecteurs historiques qui enregistrent ERROR avant propagation. */
    public <T> T executeLegacyAuthorization(String provider, Long organizationId, Supplier<T> operation) {
        return executeKey(organizationScope(provider, organizationId), operation, true, false, true);
    }

    public <T> T executeUserLegacyAuthorization(String provider, String userId, Supplier<T> operation) {
        return executeKey(userScope(provider, userId), operation, true, false, true);
    }

    public <T> T executeUserRefresh(String provider, String userId, Supplier<T> operation) {
        return executeKey(userScope(provider, userId), operation, true);
    }

    /** Certains connecteurs retournent ERROR/EXPIRED sans exception : leur intention reste bloquée. */
    public <T> T executeUserRefresh(String provider, String userId, Supplier<T> operation,
                                    java.util.function.Predicate<T> confirmed) {
        return executeKey(userScope(provider, userId), operation, true, true, false, confirmed);
    }

    private String userScope(String provider, String userId) {
        if (provider == null || !provider.matches("[a-z0-9_-]{1,48}")
                || userId == null || userId.isBlank() || userId.length() > 512) {
            throw new IllegalArgumentException("Périmètre OAuth invalide");
        }
        try {
            // Identifiant pseudonymisé : jamais le subject utilisateur en paramètre SQL.
            byte[] digest = java.security.MessageDigest.getInstance("SHA-256")
                    .digest(userId.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return "baitly:oauth:user:" + provider + ":" + java.util.HexFormat.of().formatHex(digest);
        } catch (java.security.NoSuchAlgorithmException ignored) {
            throw new IllegalStateException("Coordination OAuth indisponible");
        }
    }

    private <T> T execute(String provider, Long organizationId, Supplier<T> operation, boolean preserveError) {
        return executeKey(organizationScope(provider, organizationId), operation, preserveError);
    }

    private String organizationScope(String provider, Long organizationId) {
        if (provider == null || !provider.matches("[a-z0-9_-]{1,48}")
                || organizationId == null || organizationId <= 0) {
            throw new IllegalArgumentException("Périmètre OAuth invalide");
        }
        return "baitly:oauth:" + provider + ":" + organizationId;
    }

    private <T> T executeKey(String scope, Supplier<T> operation, boolean preserveError) {
        return executeKey(scope, operation, preserveError, preserveError, false);
    }

    private <T> T executeKey(String scope, Supplier<T> operation, boolean preserveError, boolean refresh, boolean authorization) {
        return executeKey(scope, operation, preserveError, refresh, authorization, value -> true);
    }

    private <T> T executeKey(String scope, Supplier<T> operation, boolean preserveError, boolean refresh, boolean authorization,
                             java.util.function.Predicate<T> confirmed) {
        Outcome<T> outcome = transaction.execute(status -> {
            // La clé ne contient aucun jeton, identifiant utilisateur en clair ou URL fournisseur.
            Boolean locked = db.queryForObject(
                    "SELECT pg_try_advisory_xact_lock(hashtextextended(?, 0))", Boolean.class,
                    scope);
            if (!Boolean.TRUE.equals(locked)) {
                throw new BaitlyOAuthBusyException();
            }
            String hash = digest(scope);
            java.util.UUID attempt = refresh ? beginRefresh(hash) : null;
            try {
                T value = operation.get();
                if (status.isRollbackOnly()) throw new IllegalStateException("Transaction OAuth non confirmée");
                // PostgreSQL peut répondre ROLLBACK à COMMIT après une erreur SQL avalée.
                // Une sonde dans la même transaction doit réussir avant de retourner un succès.
                if (!Integer.valueOf(1).equals(db.queryForObject("SELECT 1", Integer.class))) {
                    throw new IllegalStateException("Transaction OAuth non confirmée");
                }
                // Même transaction que les nouveaux jetons : rollback => intention encore présente.
                if (refresh) {
                    if (!confirmed.test(value)) return new Outcome<>(value, null);
                    int removed = db.update("DELETE FROM baitly_oauth_refresh_attempts WHERE scope_hash=? AND attempt=?", hash, attempt);
                    if (removed != 1) throw recoveryRequired();
                } else if (authorization) {
                    db.update("DELETE FROM baitly_oauth_refresh_attempts WHERE scope_hash=?", hash);
                }
                return new Outcome<>(value, null);
            } catch (RuntimeException failure) {
                // Un échec métier peut déjà avoir enregistré ERROR. Le propager après commit,
                // sous le verrou. Une transaction condamnée ne doit jamais être acquittée.
                if (!preserveError || status.isRollbackOnly()) throw failure;
                return new Outcome<T>(null, failure);
            }
        });
        if (outcome == null) throw new IllegalStateException("Opération OAuth non confirmée");
        if (outcome.failure != null) throw outcome.failure;
        return outcome.value;
    }

    private java.util.UUID beginRefresh(String hash) {
        java.util.UUID attempt = java.util.UUID.randomUUID();
        try {
            Integer inserted = durable.execute(status -> db.update("INSERT INTO baitly_oauth_refresh_attempts(scope_hash,attempt) VALUES (?,?) ON CONFLICT DO NOTHING", hash, attempt));
            if (!Integer.valueOf(1).equals(inserted)) throw recoveryRequired();
            return attempt;
        } catch (RuntimeException ignored) { throw recoveryRequired(); }
    }

    public void requireSettled(String provider, Long organizationId) { requireSettledKey(organizationScope(provider, organizationId)); }
    public void requireUserSettled(String provider, String userId) { requireSettledKey(userScope(provider, userId)); }

    private void requireSettledKey(String scope) {
        try {
            Long count = db.queryForObject("SELECT count(*) FROM baitly_oauth_refresh_attempts WHERE scope_hash=?", Long.class, digest(scope));
            if (count == null || count != 0) throw recoveryRequired();
        } catch (RuntimeException ignored) { throw recoveryRequired(); }
    }

    private String digest(String scope) {
        try {
            return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                    .digest(scope.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException ignored) { throw recoveryRequired(); }
    }

    private IllegalStateException recoveryRequired() { return new IllegalStateException("Rotation OAuth non confirmée ; reconnexion requise"); }

    private static final class Outcome<T> {
        final T value;
        final RuntimeException failure;
        Outcome(T value, RuntimeException failure) {
            this.value = value;
            this.failure = failure;
        }
    }
}
