package com.clenzy.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import java.util.Arrays;
import java.util.Set;

/**
 * Validation au demarrage des variables d'environnement critiques.
 *
 * Empeche le demarrage de l'application si les secrets essentiels
 * ne sont pas definis, evitant ainsi :
 * - Une base de donnees inaccessible
 * - Des tokens OAuth non chiffrables
 * - Un Keycloak non administrable
 *
 * Valide egalement que le(s) profil(s) Spring actif(s) correspondent a une
 * chaine de securite connue (fail-fast Z1-SEC-03) : SecurityConfig est sur
 * liste positive de profils, un profil inconnu n'activerait AUCUNE
 * SecurityFilterChain Clenzy.
 *
 * @see <a href="../../.env.example">.env.example</a> pour la liste complete des variables.
 */
@Configuration
public class EnvironmentValidator {

    private static final Logger log = LoggerFactory.getLogger(EnvironmentValidator.class);

    /**
     * Profils servis par la chaine de securite dev permissive.
     * DOIT rester aligne avec l'annotation @Profile de {@link SecurityConfig}.
     */
    static final Set<String> DEV_SECURITY_PROFILES = Set.of("dev", "local", "test", "ci", "performance");

    /** Profil servi par la chaine de securite prod stricte (SecurityConfigProd). */
    static final String PROD_SECURITY_PROFILE = "prod";

    private final Environment environment;

    @Value("${spring.datasource.password:}")
    private String dbPassword;

    @Value("${jasypt.encryptor.password:}")
    private String jasyptPassword;

    // Meme chaine de resolution que KeycloakConfig (env var puis propriete) :
    // le validator doit voir exactement ce que le client admin Keycloak verra.
    @Value("${KEYCLOAK_ADMIN_USERNAME:${keycloak.admin.username:}}")
    private String keycloakAdminUsername;

    @Value("${KEYCLOAK_ADMIN_PASSWORD:${keycloak.admin.password:}}")
    private String keycloakAdminPassword;

    public EnvironmentValidator(Environment environment) {
        this.environment = environment;
    }

    @PostConstruct
    public void validateCriticalEnvironment() {
        validateSecurityProfile();

        boolean hasErrors = false;

        if (isBlank(dbPassword)) {
            log.error("SPRING_DATASOURCE_PASSWORD n'est pas defini ! L'application ne peut pas demarrer sans acces a la base de donnees.");
            hasErrors = true;
        }

        if (isBlank(jasyptPassword)) {
            log.error("JASYPT_ENCRYPTOR_PASSWORD n'est pas defini ! Les tokens OAuth ne peuvent pas etre chiffres/dechiffres.");
            hasErrors = true;
        }

        hasErrors |= validateKeycloakAdminCredentials();

        if (hasErrors) {
            throw new IllegalStateException(
                    "Variables d'environnement critiques manquantes. "
                    + "Consultez server/.env.example pour la liste des variables requises.");
        }

        log.info("Validation des variables d'environnement : OK");
    }

    /**
     * Fail-fast Keycloak (Z1-SEC-06) : KeycloakConfig n'a plus de repli
     * admin/admin — si les credentials admin sont absents, le client est
     * construit avec des champs vides. En profil prod cet etat est interdit
     * (administration Keycloak silencieusement cassee, ou pire : un defaut
     * implicite cote infra) : on bloque le boot, aligne sur dbPassword /
     * jasyptPassword. En dev/test on se contente d'un warn pour ne pas casser
     * les environnements locaux qui n'utilisent pas l'admin Keycloak.
     *
     * @return true si une erreur bloquante a ete detectee (profil prod)
     */
    private boolean validateKeycloakAdminCredentials() {
        boolean usernameMissing = isBlank(keycloakAdminUsername);
        boolean passwordMissing = isBlank(keycloakAdminPassword);
        if (!usernameMissing && !passwordMissing) {
            return false;
        }
        String missing = usernameMissing && passwordMissing
                ? "KEYCLOAK_ADMIN_USERNAME et KEYCLOAK_ADMIN_PASSWORD ne sont pas definis"
                : usernameMissing
                        ? "KEYCLOAK_ADMIN_USERNAME n'est pas defini"
                        : "KEYCLOAK_ADMIN_PASSWORD n'est pas defini";
        if (isProdProfileActive()) {
            log.error("{} ! L'administration Keycloak (creation users, roles) serait indisponible en production.", missing);
            return true;
        }
        log.warn("{}. L'administration Keycloak sera indisponible.", missing);
        return false;
    }

    private boolean isProdProfileActive() {
        String[] activeProfiles = environment.getActiveProfiles();
        String[] profiles = activeProfiles.length > 0 ? activeProfiles : environment.getDefaultProfiles();
        return Arrays.asList(profiles).contains(PROD_SECURITY_PROFILE);
    }

    /**
     * Fail-fast (Z1-SEC-03) : SecurityConfig n'est plus sur @Profile("!prod")
     * mais sur une liste positive. Un profil inconnu (faute de frappe
     * "production", environnement "staging" seul...) n'active donc ni la chaine
     * dev ni la chaine prod — on refuse de demarrer avec une securite
     * indeterminee plutot que de laisser Spring Boot auto-configurer un defaut.
     */
    private void validateSecurityProfile() {
        String[] activeProfiles = environment.getActiveProfiles();
        String[] profiles = activeProfiles.length > 0 ? activeProfiles : environment.getDefaultProfiles();
        boolean recognized = Arrays.stream(profiles)
                .anyMatch(profile -> PROD_SECURITY_PROFILE.equals(profile)
                        || DEV_SECURITY_PROFILES.contains(profile));
        if (recognized) {
            return;
        }
        throw new IllegalStateException(
                "Aucun profil de securite reconnu parmi les profils actifs " + Arrays.toString(profiles)
                + ". Profils attendus : '" + PROD_SECURITY_PROFILE + "' (SecurityConfigProd) ou l'un de "
                + DEV_SECURITY_PROFILES + " (SecurityConfig dev). Pour un environnement de type production"
                + " (ex: staging), activer aussi le profil 'prod' (ex: SPRING_PROFILES_ACTIVE=prod,staging).");
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
