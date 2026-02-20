package com.clenzy.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Validation au demarrage des variables d'environnement critiques.
 *
 * Empeche le demarrage de l'application si les secrets essentiels
 * ne sont pas definis, evitant ainsi :
 * - Une base de donnees inaccessible
 * - Des tokens OAuth non chiffrables
 * - Un Keycloak non administrable
 *
 * @see <a href="../../.env.example">.env.example</a> pour la liste complete des variables.
 */
@Configuration
public class EnvironmentValidator {

    private static final Logger log = LoggerFactory.getLogger(EnvironmentValidator.class);

    @Value("${spring.datasource.password:}")
    private String dbPassword;

    @Value("${jasypt.encryptor.password:}")
    private String jasyptPassword;

    @Value("${keycloak.admin.password:}")
    private String keycloakAdminPassword;

    @PostConstruct
    public void validateCriticalEnvironment() {
        boolean hasErrors = false;

        if (isBlank(dbPassword)) {
            log.error("SPRING_DATASOURCE_PASSWORD n'est pas defini ! L'application ne peut pas demarrer sans acces a la base de donnees.");
            hasErrors = true;
        }

        if (isBlank(jasyptPassword)) {
            log.error("JASYPT_ENCRYPTOR_PASSWORD n'est pas defini ! Les tokens OAuth ne peuvent pas etre chiffres/dechiffres.");
            hasErrors = true;
        }

        if (isBlank(keycloakAdminPassword)) {
            log.warn("KEYCLOAK_ADMIN_PASSWORD n'est pas defini. L'administration Keycloak sera indisponible.");
            // Warning seulement — pas critique pour le fonctionnement de base
        }

        if (hasErrors) {
            throw new IllegalStateException(
                    "Variables d'environnement critiques manquantes. "
                    + "Consultez server/.env.example pour la liste des variables requises.");
        }

        log.info("Validation des variables d'environnement : OK");
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
