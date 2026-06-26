package com.clenzy.service.storage;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Enregistre le contrat de configuration {@link ObjectStorageClient.Properties}
 * ({@code clenzy.storage.object.*}) comme bean de proprietes (constructor binding).
 *
 * <p>Le client MinIO ({@link ObjectStorageClient}) reste construit paresseusement :
 * cette config ne lie que les proprietes, elle n'ouvre aucune connexion.</p>
 */
@Configuration
@EnableConfigurationProperties(ObjectStorageClient.Properties.class)
public class ObjectStorageConfig {
}
