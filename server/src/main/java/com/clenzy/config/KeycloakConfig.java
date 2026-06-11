package com.clenzy.config;

import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.KeycloakBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Client admin Keycloak (realm master).
 *
 * <p><b>Z1-SEC-06</b> : plus AUCUN credential par defaut ({@code admin/admin}
 * supprimes). Si KEYCLOAK_ADMIN_USERNAME / KEYCLOAK_ADMIN_PASSWORD ne sont pas
 * fournis, les champs restent vides : {@link EnvironmentValidator} bloque le
 * boot en profil prod, et en dev le premier appel admin echoue explicitement
 * au lieu de tenter silencieusement admin/admin.</p>
 */
@Configuration
public class KeycloakConfig {

    private static final Logger logger = LoggerFactory.getLogger(KeycloakConfig.class);

    @Value("${KEYCLOAK_AUTH_SERVER_URL:${keycloak.auth-server-url:http://clenzy-keycloak:8080}}")
    private String keycloakUrl;

    @Value("${KEYCLOAK_MASTER_REALM:master}")
    private String masterRealm;

    @Value("${KEYCLOAK_ADMIN_USERNAME:${keycloak.admin.username:}}")
    private String adminUsername;

    @Value("${KEYCLOAK_ADMIN_PASSWORD:${keycloak.admin.password:}}")
    private String adminPassword;

    @Value("${KEYCLOAK_ADMIN_CLIENT_ID:${keycloak.admin.client-id:admin-cli}}")
    private String adminClientId;

    @Bean
    @Primary
    public Keycloak keycloak() {
        logger.info("Configuration Keycloak Admin Client — URL: {}, master realm: {}, client ID: {}",
                keycloakUrl, masterRealm, adminClientId);

        if (adminUsername == null || adminUsername.isBlank()
                || adminPassword == null || adminPassword.isBlank()) {
            // Pas de repli admin/admin : en prod EnvironmentValidator a deja
            // bloque le boot ; en dev les appels admin echoueront explicitement.
            logger.warn("Credentials admin Keycloak absents (KEYCLOAK_ADMIN_USERNAME/PASSWORD) : "
                    + "l'administration Keycloak sera indisponible.");
        }

        // Construction lazy — pas de validation au démarrage.
        // Le token sera obtenu lors du premier appel API Keycloak.
        Keycloak keycloak = KeycloakBuilder.builder()
                .serverUrl(keycloakUrl)
                .realm(masterRealm)
                .username(adminUsername)
                .password(adminPassword)
                .clientId(adminClientId)
                .build();

        logger.info("Bean Keycloak Admin Client créé (validation lazy au premier appel)");
        return keycloak;
    }
}
