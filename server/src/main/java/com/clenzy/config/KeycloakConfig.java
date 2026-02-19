package com.clenzy.config;

import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.KeycloakBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Configuration
public class KeycloakConfig {

    private static final Logger logger = LoggerFactory.getLogger(KeycloakConfig.class);

    @Value("${KEYCLOAK_AUTH_SERVER_URL:${keycloak.auth-server-url:http://clenzy-keycloak:8080}}")
    private String keycloakUrl;

    @Value("${KEYCLOAK_MASTER_REALM:master}")
    private String masterRealm;

    @Value("${KEYCLOAK_ADMIN_USERNAME:${keycloak.admin.username:admin}}")
    private String adminUsername;

    @Value("${KEYCLOAK_ADMIN_PASSWORD:${keycloak.admin.password:admin}}")
    private String adminPassword;

    @Value("${KEYCLOAK_ADMIN_CLIENT_ID:${keycloak.admin.client-id:admin-cli}}")
    private String adminClientId;

    @Bean
    @Primary
    public Keycloak keycloak() {
        logger.info("🔧 Configuration Keycloak Admin Client");
        logger.info("🔧 URL: {}", keycloakUrl);
        logger.info("🔧 Master Realm: {}", masterRealm);
        logger.info("🔧 Username: {}", adminUsername);
        logger.info("🔧 Client ID: {}", adminClientId);

        // Construction lazy — pas de validation au démarrage.
        // Le token sera obtenu lors du premier appel API Keycloak.
        Keycloak keycloak = KeycloakBuilder.builder()
                .serverUrl(keycloakUrl)
                .realm(masterRealm)
                .username(adminUsername)
                .password(adminPassword)
                .clientId(adminClientId)
                .build();

        logger.info("✅ Bean Keycloak Admin Client créé (validation lazy au premier appel)");
        return keycloak;
    }
}
