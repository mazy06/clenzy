package com.clenzy.controller;

import com.clenzy.dto.HousekeeperRatesDto;
import com.clenzy.dto.HousekeeperRatesDto.UpdateRequest;
import com.clenzy.model.User;
import com.clenzy.service.pricing.HousekeeperRateService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * Tests unitaires du HousekeeperRateController (Moteur Ménage 2A).
 * L'autorisation (isAuthenticated / SUPER_ADMIN-SUPER_MANAGER sur /user/*) est
 * portée par @PreAuthorize et couverte par les tests d'intégration Spring
 * Security. Ici : l'OWNERSHIP structurel de /me — le user modifié est TOUJOURS
 * celui du JWT (jamais un id fourni par le client) — et la délégation.
 */
@ExtendWith(MockitoExtension.class)
class HousekeeperRateControllerTest {

    @Mock private HousekeeperRateService housekeeperRateService;

    private HousekeeperRateController controller;

    @BeforeEach
    void setUp() {
        controller = new HousekeeperRateController(housekeeperRateService);
    }

    private Jwt jwtFor(String subject) {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", subject)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    private User user(long id, String keycloakId) {
        User u = new User();
        u.setId(id);
        u.setKeycloakId(keycloakId);
        return u;
    }

    @Test
    @DisplayName("PUT /me : le user modifié est résolu depuis le JWT — jamais un id client")
    void whenUpdateMyRates_thenTargetsJwtSubjectOnly() {
        UpdateRequest request = new UpdateRequest(BigDecimal.valueOf(35), List.of());
        HousekeeperRatesDto dto = new HousekeeperRatesDto(BigDecimal.valueOf(42), BigDecimal.valueOf(35), List.of());
        when(housekeeperRateService.requireCurrentUser("kc-me")).thenReturn(user(42L, "kc-me"));
        when(housekeeperRateService.updateRates(42L, request)).thenReturn(dto);

        var response = controller.updateMyRates(request, jwtFor("kc-me"));

        assertThat(response.getBody()).isEqualTo(dto);
        // Ownership : l'id vient de la résolution JWT (42), pas d'un paramètre.
        verify(housekeeperRateService).updateRates(42L, request);
        verify(housekeeperRateService, never()).updateRates(argThat(id -> id != 42L), any());
    }

    @Test
    @DisplayName("GET /me : délégation avec le user du JWT")
    void whenGetMyRates_thenDelegatesWithJwtUser() {
        HousekeeperRatesDto dto = new HousekeeperRatesDto(BigDecimal.valueOf(42), null, List.of());
        when(housekeeperRateService.requireCurrentUser("kc-me")).thenReturn(user(42L, "kc-me"));
        when(housekeeperRateService.getRates(42L)).thenReturn(dto);

        var response = controller.getMyRates(jwtFor("kc-me"));

        assertThat(response.getBody()).isEqualTo(dto);
        verify(housekeeperRateService).getRates(42L);
    }

    @Test
    @DisplayName("GET /user/{id} (staff) : délégation directe")
    void whenGetUserRates_thenDelegates() {
        HousekeeperRatesDto dto = new HousekeeperRatesDto(BigDecimal.valueOf(42), null, List.of());
        when(housekeeperRateService.getRates(9L)).thenReturn(dto);

        var response = controller.getUserRates(9L);

        assertThat(response.getBody()).isEqualTo(dto);
        verify(housekeeperRateService).getRates(9L);
    }
}
