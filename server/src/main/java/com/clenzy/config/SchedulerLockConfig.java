package com.clenzy.config;

import javax.sql.DataSource;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.jdbctemplate.JdbcTemplateLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;

/**
 * Verrouillage multi-instance des jobs {@code @Scheduled} via ShedLock
 * (constat P2-7 de l'audit perf 2026-07-21 : sans verrou, un scale-out du
 * serveur doublerait les effets externes des schedulers — emails, paiements,
 * pushes OTA, rotations de codes d'acces).
 *
 * <p>Provider JDBC (table {@code shedlock}, changeset Liquibase 0359) et non
 * Redis : Postgres est la source de verite et le verrou survit aux flush /
 * redemarrages Redis. {@code usingDbTime()} s'appuie sur l'horloge de la base,
 * ce qui rend le verrou insensible aux derives d'horloge entre instances.</p>
 *
 * <p>Seuls les jobs a effets externes portent {@code @SchedulerLock} — les jobs
 * read-only / metriques locales et l'OutboxRelay (at-least-once par design,
 * idempotent cote consumers) restent volontairement sans verrou.</p>
 */
@Configuration
@EnableSchedulerLock(defaultLockAtMostFor = "PT10M")
public class SchedulerLockConfig {

    @Bean
    public LockProvider lockProvider(DataSource dataSource) {
        return new JdbcTemplateLockProvider(
                JdbcTemplateLockProvider.Configuration.builder()
                        .withJdbcTemplate(new JdbcTemplate(dataSource))
                        .withTableName("shedlock")
                        .usingDbTime()
                        .build());
    }
}
