package com.clenzy.service.retention;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Enregistre le contrat de configuration {@link RetentionPurgeProperties}
 * ({@code clenzy.retention.purge.*}) comme bean de proprietes (constructor binding).
 *
 * <p>N'active rien par lui-meme : le moteur {@link RetentionPurgeService} reste inerte tant que
 * {@code clenzy.retention.purge.enabled=false} (defaut), et le {@link RetentionPurgeScheduler}
 * ne tourne que si {@code enabled && scheduler-enabled} (les deux false par defaut).</p>
 *
 * <p>{@code @EnableScheduling} n'est PAS redeclare ici : il est deja active globalement sur
 * {@code com.clenzy.ClenzyApplication}. Le {@code @Scheduled} du scheduler est donc pris en
 * compte sans configuration locale.</p>
 */
@Configuration
@EnableConfigurationProperties(RetentionPurgeProperties.class)
public class RetentionPurgeConfig {
}
