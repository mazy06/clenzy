package com.clenzy.service.storage.archival;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Enregistre le contrat de configuration {@link ArchivalProperties} ({@code clenzy.archival.*})
 * comme bean de proprietes (constructor binding).
 *
 * <p>N'active rien par lui-meme : le moteur {@link ArchivalService} reste inerte tant que
 * {@code clenzy.archival.enabled=false} (defaut). Aucun scheduler ni ApplicationRunner n'est
 * declare — l'archivage ne se declenche que par l'appel admin explicite.</p>
 */
@Configuration
@EnableConfigurationProperties(ArchivalProperties.class)
public class ArchivalConfig {
}
