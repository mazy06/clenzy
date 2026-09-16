package com.clenzy.marketplace.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import java.sql.Timestamp;
import java.time.LocalDateTime;

/** Consomme le lien durablement avant tout appel au fournisseur d'identité. */
@Component
public class MarketplaceActivationTokenConsumer {
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;

    public MarketplaceActivationTokenConsumer(JdbcTemplate jdbc, PlatformTransactionManager manager) {
        this.jdbc = jdbc;
        this.transaction = new TransactionTemplate(manager);
        this.transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public boolean consume(Long providerId, Long userId, String hash, LocalDateTime now) {
        return Boolean.TRUE.equals(transaction.execute(status -> jdbc.update("""
                UPDATE marketplace_providers
                SET activation_token_hash = NULL, activation_token_expires_at = NULL
                WHERE id = ? AND user_id = ? AND activation_token_hash = ?
                  AND activation_token_expires_at > ?
                """, providerId, userId, hash, Timestamp.valueOf(now)) == 1));
    }
}
