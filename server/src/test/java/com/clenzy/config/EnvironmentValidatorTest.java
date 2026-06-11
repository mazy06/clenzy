package com.clenzy.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests for {@link EnvironmentValidator}.
 *
 * <p>Couvre le fail-fast de profil de securite (Z1-SEC-03) : SecurityConfig est
 * desormais sur liste positive de profils, donc un profil inconnu ("production",
 * "staging" seul, faute de frappe...) n'active aucune SecurityFilterChain Clenzy
 * et DOIT bloquer le boot avec un message explicite.</p>
 */
@DisplayName("EnvironmentValidator")
class EnvironmentValidatorTest {

    private EnvironmentValidator validatorWithProfiles(String... profiles) {
        MockEnvironment environment = new MockEnvironment();
        if (profiles.length > 0) {
            environment.setActiveProfiles(profiles);
        }
        EnvironmentValidator validator = new EnvironmentValidator(environment);
        ReflectionTestUtils.setField(validator, "dbPassword", "db-secret");
        ReflectionTestUtils.setField(validator, "jasyptPassword", "jasypt-secret");
        ReflectionTestUtils.setField(validator, "keycloakAdminUsername", "kc-admin");
        ReflectionTestUtils.setField(validator, "keycloakAdminPassword", "kc-secret");
        return validator;
    }

    @Nested
    @DisplayName("Validation du profil de securite (Z1-SEC-03)")
    class SecurityProfileValidation {

        @Test
        void whenUnknownProfileActive_thenBootFails() {
            // Arrange : faute de frappe classique ("production" au lieu de "prod")
            EnvironmentValidator validator = validatorWithProfiles("production");

            // Act + Assert
            assertThatThrownBy(validator::validateCriticalEnvironment)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Aucun profil de securite reconnu")
                .hasMessageContaining("production");
        }

        @Test
        void whenStagingProfileAloneActive_thenBootFails() {
            // staging est un miroir de prod : il ne doit JAMAIS retomber sur la
            // chaine dev permissive ; il doit etre combine avec 'prod'.
            EnvironmentValidator validator = validatorWithProfiles("staging");

            assertThatThrownBy(validator::validateCriticalEnvironment)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("staging");
        }

        @Test
        void whenNoActiveProfile_thenDefaultProfileIsCheckedAndBootFails() {
            // Sans profil actif, Spring retombe sur le profil "default" (non reconnu).
            // Dans l'application reelle, application.yml force dev,local par defaut.
            EnvironmentValidator validator = validatorWithProfiles();

            assertThatThrownBy(validator::validateCriticalEnvironment)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Aucun profil de securite reconnu");
        }

        @Test
        void whenProdProfileActive_thenValidationPasses() {
            EnvironmentValidator validator = validatorWithProfiles("prod");

            assertThatCode(validator::validateCriticalEnvironment).doesNotThrowAnyException();
        }

        @Test
        void whenDefaultDevLocalProfilesActive_thenValidationPasses() {
            EnvironmentValidator validator = validatorWithProfiles("dev", "local");

            assertThatCode(validator::validateCriticalEnvironment).doesNotThrowAnyException();
        }

        @Test
        void whenTestProfileActive_thenValidationPasses() {
            // Les tests d'integration (@ActiveProfiles("test")) doivent conserver
            // leur chaine de securite SecurityConfig.
            EnvironmentValidator validator = validatorWithProfiles("test");

            assertThatCode(validator::validateCriticalEnvironment).doesNotThrowAnyException();
        }

        @Test
        void whenCiProfileActive_thenValidationPasses() {
            // Workflow perf-tests (K6) : SPRING_PROFILES_ACTIVE=ci
            EnvironmentValidator validator = validatorWithProfiles("ci");

            assertThatCode(validator::validateCriticalEnvironment).doesNotThrowAnyException();
        }

        @Test
        void whenPerformanceProfileActive_thenValidationPasses() {
            EnvironmentValidator validator = validatorWithProfiles("performance");

            assertThatCode(validator::validateCriticalEnvironment).doesNotThrowAnyException();
        }

        @Test
        void whenProdCombinedWithStaging_thenValidationPasses() {
            // Voie recommandee pour staging : chaine prod stricte + overrides staging
            EnvironmentValidator validator = validatorWithProfiles("prod", "staging");

            assertThatCode(validator::validateCriticalEnvironment).doesNotThrowAnyException();
        }

        @Test
        void devSecurityProfiles_stayAlignedWithSecurityConfigAnnotation() {
            // Garde-fou anti-derive : la liste blanche du validator doit refleter
            // exactement l'annotation @Profile de SecurityConfig.
            org.springframework.context.annotation.Profile profile =
                SecurityConfig.class.getAnnotation(org.springframework.context.annotation.Profile.class);

            org.assertj.core.api.Assertions.assertThat(profile).isNotNull();
            org.assertj.core.api.Assertions.assertThat(profile.value())
                .containsExactlyInAnyOrderElementsOf(EnvironmentValidator.DEV_SECURITY_PROFILES);
        }
    }

    @Nested
    @DisplayName("Validation des secrets critiques")
    class CriticalSecretsValidation {

        @Test
        void whenDbPasswordMissing_thenBootFails() {
            EnvironmentValidator validator = validatorWithProfiles("dev");
            ReflectionTestUtils.setField(validator, "dbPassword", "");

            assertThatThrownBy(validator::validateCriticalEnvironment)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Variables d'environnement critiques manquantes");
        }

        @Test
        void whenJasyptPasswordMissing_thenBootFails() {
            EnvironmentValidator validator = validatorWithProfiles("dev");
            ReflectionTestUtils.setField(validator, "jasyptPassword", "");

            assertThatThrownBy(validator::validateCriticalEnvironment)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Variables d'environnement critiques manquantes");
        }

        @Test
        void whenDevAndKeycloakAdminPasswordMissing_thenBootStillSucceeds() {
            // En dev, l'admin Keycloak absent n'est qu'un warn (environnements
            // locaux sans administration Keycloak).
            EnvironmentValidator validator = validatorWithProfiles("dev");
            ReflectionTestUtils.setField(validator, "keycloakAdminPassword", "");

            assertThatCode(validator::validateCriticalEnvironment).doesNotThrowAnyException();
        }
    }

    @Nested
    @DisplayName("Fail-fast credentials admin Keycloak en prod (Z1-SEC-06)")
    class KeycloakAdminCredentialsValidation {

        @Test
        void whenProdAndKeycloakAdminPasswordMissing_thenBootFails() {
            // KeycloakConfig n'a plus de repli admin/admin : en prod, l'absence
            // de KEYCLOAK_ADMIN_PASSWORD doit bloquer le boot (aligne sur
            // dbPassword/jasyptPassword).
            EnvironmentValidator validator = validatorWithProfiles("prod");
            ReflectionTestUtils.setField(validator, "keycloakAdminPassword", "");

            assertThatThrownBy(validator::validateCriticalEnvironment)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Variables d'environnement critiques manquantes");
        }

        @Test
        void whenProdAndKeycloakAdminUsernameMissing_thenBootFails() {
            EnvironmentValidator validator = validatorWithProfiles("prod");
            ReflectionTestUtils.setField(validator, "keycloakAdminUsername", "");

            assertThatThrownBy(validator::validateCriticalEnvironment)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Variables d'environnement critiques manquantes");
        }

        @Test
        void whenProdCombinedWithStagingAndKeycloakCredentialsMissing_thenBootFails() {
            // Le fail-fast s'applique des que le profil prod est actif, meme
            // combine (ex: SPRING_PROFILES_ACTIVE=prod,staging).
            EnvironmentValidator validator = validatorWithProfiles("prod", "staging");
            ReflectionTestUtils.setField(validator, "keycloakAdminUsername", "");
            ReflectionTestUtils.setField(validator, "keycloakAdminPassword", "");

            assertThatThrownBy(validator::validateCriticalEnvironment)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Variables d'environnement critiques manquantes");
        }

        @Test
        void whenProdAndKeycloakCredentialsPresent_thenValidationPasses() {
            EnvironmentValidator validator = validatorWithProfiles("prod");

            assertThatCode(validator::validateCriticalEnvironment).doesNotThrowAnyException();
        }
    }
}
