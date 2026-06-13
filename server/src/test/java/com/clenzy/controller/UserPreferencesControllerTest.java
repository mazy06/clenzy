package com.clenzy.controller;

import com.clenzy.dto.UserPreferencesDto;
import com.clenzy.model.UserPreferences;
import com.clenzy.repository.UserPreferencesRepository;
import com.clenzy.service.UserPreferencesService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Tests pour {@link UserPreferencesController}.
 *
 * <p>Focalises sur :</p>
 * <ul>
 *   <li>get/update preferences avec lazy-create entity</li>
 *   <li>Round-trip themeMode (R3 + Q3 backend integrity)</li>
 *   <li>Partial updates : seuls les champs non-null sont mis a jour</li>
 *   <li>Tenant context : organizationId resolu via TenantContext au create</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class UserPreferencesControllerTest {

    @Mock private UserPreferencesRepository repository;
    @Mock private TenantContext tenantContext;

    private UserPreferencesController controller;

    @BeforeEach
    void setUp() {
        // Service REEL construit au-dessus du repository mocke (pattern Vague A)
        controller = new UserPreferencesController(new UserPreferencesService(repository, tenantContext));
    }

    private Jwt jwtFor(String keycloakId) {
        return Jwt.withTokenValue("test-token")
                .header("alg", "RS256")
                .claim("sub", keycloakId)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @Nested
    @DisplayName("GET /me")
    class GetMyPreferences {

        @Test
        void whenPrefsExist_thenReturnsThem() {
            UserPreferences existing = new UserPreferences("kc-1", 42L);
            existing.setTimezone("Europe/Paris");
            existing.setCurrency("MAD");
            existing.setLanguage("ar");
            existing.setThemeMode("dark");
            when(repository.findByKeycloakId("kc-1")).thenReturn(Optional.of(existing));

            ResponseEntity<UserPreferencesDto> response = controller.getMyPreferences(jwtFor("kc-1"));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            UserPreferencesDto dto = response.getBody();
            assertThat(dto).isNotNull();
            assertThat(dto.getCurrency()).isEqualTo("MAD");
            assertThat(dto.getLanguage()).isEqualTo("ar");
            assertThat(dto.getThemeMode()).isEqualTo("dark");
            verify(repository, never()).save(any());
        }

        @Test
        void whenPrefsMissing_thenLazyCreatesWithTenantOrgAndDefaults() {
            when(repository.findByKeycloakId("kc-new")).thenReturn(Optional.empty());
            when(tenantContext.getOrganizationId()).thenReturn(99L);
            when(repository.save(any(UserPreferences.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            ResponseEntity<UserPreferencesDto> response = controller.getMyPreferences(jwtFor("kc-new"));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            UserPreferencesDto dto = response.getBody();
            assertThat(dto).isNotNull();
            // Defaults
            assertThat(dto.getCurrency()).isEqualTo("EUR");
            assertThat(dto.getLanguage()).isEqualTo("fr");
            assertThat(dto.getThemeMode()).isEqualTo("auto");
            assertThat(dto.getNotifyEmail()).isTrue();
            assertThat(dto.getNotifyPush()).isFalse();
            verify(repository).save(any(UserPreferences.class));
        }
    }

    @Nested
    @DisplayName("PUT /me")
    class UpdateMyPreferences {

        @Test
        void whenAllFieldsSet_thenAllPersisted() {
            UserPreferences existing = new UserPreferences("kc-1", 42L);
            when(repository.findByKeycloakId("kc-1")).thenReturn(Optional.of(existing));
            when(repository.save(any(UserPreferences.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            UserPreferencesDto request = new UserPreferencesDto(
                    "America/New_York", "MAD", "ar", "dark", "violet",
                    false, true, true);

            ResponseEntity<UserPreferencesDto> response = controller.updateMyPreferences(
                    jwtFor("kc-1"), request);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            UserPreferencesDto dto = response.getBody();
            assertThat(dto).isNotNull();
            assertThat(dto.getTimezone()).isEqualTo("America/New_York");
            assertThat(dto.getCurrency()).isEqualTo("MAD");
            assertThat(dto.getLanguage()).isEqualTo("ar");
            assertThat(dto.getThemeMode()).isEqualTo("dark");
            assertThat(dto.getNotifyEmail()).isFalse();
            assertThat(dto.getNotifyPush()).isTrue();
            assertThat(dto.getNotifySms()).isTrue();
        }

        @Test
        void whenThemeModeNull_thenPreservesExistingValue() {
            // BUG-2 server-side : partial update ne doit pas ecraser un champ
            // non-fourni avec null. Le DTO entrant a themeMode=null, le DB doit
            // garder l'ancienne valeur.
            UserPreferences existing = new UserPreferences("kc-1", 42L);
            existing.setThemeMode("dark");
            existing.setCurrency("EUR");
            when(repository.findByKeycloakId("kc-1")).thenReturn(Optional.of(existing));
            when(repository.save(any(UserPreferences.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            UserPreferencesDto request = new UserPreferencesDto();
            request.setCurrency("MAD");
            request.setThemeMode(null); // pas de changement souhaite

            ResponseEntity<UserPreferencesDto> response = controller.updateMyPreferences(
                    jwtFor("kc-1"), request);

            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getCurrency()).isEqualTo("MAD");
            assertThat(response.getBody().getThemeMode()).isEqualTo("dark"); // preserve
        }

        @Test
        void whenCurrencyNull_thenPreservesExistingValue() {
            UserPreferences existing = new UserPreferences("kc-1", 42L);
            existing.setCurrency("MAD");
            existing.setThemeMode("auto");
            when(repository.findByKeycloakId("kc-1")).thenReturn(Optional.of(existing));
            when(repository.save(any(UserPreferences.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            UserPreferencesDto request = new UserPreferencesDto();
            request.setCurrency(null);
            request.setThemeMode("light");

            ResponseEntity<UserPreferencesDto> response = controller.updateMyPreferences(
                    jwtFor("kc-1"), request);

            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getCurrency()).isEqualTo("MAD"); // preserve
            assertThat(response.getBody().getThemeMode()).isEqualTo("light");
        }

        @Test
        void whenLazyCreate_thenAppliesUpdateAfterCreate() {
            // Edge case : PUT avant le 1er GET — l'entity doit etre cree
            // puis updated dans la meme transaction.
            when(repository.findByKeycloakId("kc-new")).thenReturn(Optional.empty());
            when(tenantContext.getOrganizationId()).thenReturn(99L);
            when(repository.save(any(UserPreferences.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            UserPreferencesDto request = new UserPreferencesDto();
            request.setThemeMode("dark");
            request.setCurrency("MAD");

            ResponseEntity<UserPreferencesDto> response = controller.updateMyPreferences(
                    jwtFor("kc-new"), request);

            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getThemeMode()).isEqualTo("dark");
            assertThat(response.getBody().getCurrency()).isEqualTo("MAD");
            // 1 save pour le create + 1 save pour l'update final = 2 invocations
            verify(repository, times(2)).save(any(UserPreferences.class));
        }
    }
}
