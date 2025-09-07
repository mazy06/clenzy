package com.clenzy.config;

import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.KeycloakBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Configuration
public class KeycloakConfig {

    private static final Logger logger = LoggerFactory.getLogger(KeycloakConfig.class);

    @Value("${KEYCLOAK_AUTH_SERVER_URL:http://localhost:8080}")
    private String keycloakUrl;

    @Value("${keycloak.realm:clenzy}")
    private String realm;

    @Value("${KEYCLOAK_MASTER_REALM:master}")
    private String masterRealm;

    @Value("${keycloak.admin-realm:clenzy}")
    private String adminRealm;

    @Value("${KEYCLOAK_ADMIN_USERNAME:admin}")
    private String adminUsername;

    @Value("${KEYCLOAK_ADMIN_PASSWORD:admin}")
    private String adminPassword;

    @Value("${KEYCLOAK_ADMIN_CLIENT_ID:admin-cli}")
    private String adminClientId;

    @Bean
    @Primary
    public Keycloak keycloak() {
        logger.info("🔧 Configuration Keycloak - Création du bean Keycloak");
        logger.info("🔧 URL: {}", keycloakUrl);
        logger.info("🔧 Master Realm (Auth): {}", masterRealm);
        logger.info("🔧 Target Realm (Users): {}", realm);
        logger.info("🔧 Username: {}", adminUsername);
        logger.info("🔧 Client ID: {}", adminClientId);
        
        try {
            Keycloak keycloak = KeycloakBuilder.builder()
                    .serverUrl(keycloakUrl)
                    .realm(masterRealm)
                    .username(adminUsername)
                    .password(adminPassword)
                    .clientId(adminClientId)
                    .build();
            
            logger.info("✅ Bean Keycloak créé avec succès");
            return keycloak;
        } catch (Exception e) {
            logger.error("❌ Erreur lors de la création du bean Keycloak: {}", e.getMessage(), e);
            throw new RuntimeException("Impossible de créer le bean Keycloak", e);
        }
    }
}
