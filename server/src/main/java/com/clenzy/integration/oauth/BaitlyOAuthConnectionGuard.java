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

    public BaitlyOAuthConnectionGuard(JdbcTemplate db, PlatformTransactionManager manager) {
        this.db = db;
        transaction = new TransactionTemplate(manager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        transaction.setTimeout(30);
    }

    public <T> T execute(String provider, Long organizationId, Supplier<T> operation) {
        return execute(provider, organizationId, operation, false);
    }

    /** Le refresh existant persiste ERROR avant de signaler un échec opérationnel. */
    public <T> T executeRefresh(String provider, Long organizationId, Supplier<T> operation) {
        return execute(provider, organizationId, operation, true);
    }

    private <T> T execute(String provider, Long organizationId, Supplier<T> operation, boolean preserveError) {
        if (provider == null || !provider.matches("[a-z0-9_-]{1,48}")
                || organizationId == null || organizationId <= 0) {
            throw new IllegalArgumentException("Périmètre OAuth invalide");
        }
        Outcome<T> outcome = transaction.execute(status -> {
            // La clé ne contient aucun jeton, identifiant utilisateur ou URL fournisseur.
            Boolean locked = db.queryForObject(
                    "SELECT pg_try_advisory_xact_lock(hashtextextended(?, 0))", Boolean.class,
                    "baitly:oauth:" + provider + ":" + organizationId);
            if (!Boolean.TRUE.equals(locked)) {
                throw new IllegalStateException("Opération OAuth déjà en cours ; réessayer ultérieurement");
            }
            try {
                T value = operation.get();
                if (status.isRollbackOnly()) throw new IllegalStateException("Transaction OAuth non confirmée");
                // PostgreSQL peut répondre ROLLBACK à COMMIT après une erreur SQL avalée.
                // Une sonde dans la même transaction doit réussir avant de retourner un succès.
                if (!Integer.valueOf(1).equals(db.queryForObject("SELECT 1", Integer.class))) {
                    throw new IllegalStateException("Transaction OAuth non confirmée");
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

    private static final class Outcome<T> {
        final T value;
        final RuntimeException failure;
        Outcome(T value, RuntimeException failure) {
            this.value = value;
            this.failure = failure;
        }
    }
}
