package com.clenzy.config;

import javax.sql.DataSource;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
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
 *
 * <h2>Ordre de l'aspect (important quand le job est aussi {@code @Transactional})</h2>
 * <p>Par defaut, l'advisor ShedLock porte {@code LOWEST_PRECEDENCE} — le meme ordre que
 * l'advisor transactionnel de Spring. Leur imbrication est alors <b>indeterminee</b>, et si
 * la transaction s'ouvre en premier, le verrou est pose <b>a l'interieur</b> de celle-ci :
 * il n'est visible des autres instances qu'au commit, et disparait en cas de rollback. Sur un
 * job long, deux instances peuvent donc acquerir le meme verrou — exactement ce que ShedLock
 * doit empecher.</p>
 *
 * <p>{@code HIGHEST_PRECEDENCE} force le verrou a envelopper la transaction : il est acquis
 * avant le {@code BEGIN} et relache apres le {@code COMMIT}. Six jobs combinent aujourd'hui
 * les deux annotations, dont {@code EscrowReleaseScheduler} (liberation de sequestre) et
 * {@code DataRetentionService} (purge RGPD).</p>
 */
@Configuration
@EnableSchedulerLock(defaultLockAtMostFor = "PT10M", order = Ordered.HIGHEST_PRECEDENCE)
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
