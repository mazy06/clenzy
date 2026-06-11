package com.clenzy.controller;

import com.clenzy.dto.PlatformPromoCodeDto;
import com.clenzy.model.PlatformPromoCode;
import com.clenzy.service.PlatformPromoCodeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires de AdminPlatformPromoCodeController.
 *
 * NOTE : depuis le refactor T-ARCH-01/T-ARCH-07, le controller n'injecte plus
 * le repository (acces donnees dans PlatformPromoCodeService, teste dans
 * PlatformPromoCodeServiceTest) et expose des PlatformPromoCodeDto au lieu
 * de l'entite JPA (shape JSON identique champ a champ).
 */
@ExtendWith(MockitoExtension.class)
class AdminPlatformPromoCodeControllerTest {

    @Mock private PlatformPromoCodeService promoCodeService;

    private AdminPlatformPromoCodeController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new AdminPlatformPromoCodeController(promoCodeService);
        jwt = Jwt.withTokenValue("t")
                .header("alg", "RS256")
                .claim("sub", "admin-1")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @Test
    void list_returnsServiceFindAll() {
        PlatformPromoCode p = new PlatformPromoCode();
        p.setCode("WELCOME10");
        when(promoCodeService.findAll()).thenReturn(List.of(p));

        ResponseEntity<List<PlatformPromoCodeDto>> resp = controller.list();

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).hasSize(1);
        assertThat(resp.getBody().get(0).code()).isEqualTo("WELCOME10");
    }

    @Test
    void create_validBody_savesAndReturns201() {
        Map<String, Object> body = new HashMap<>();
        body.put("code", "SUMMER20");
        body.put("discountType", "PERCENTAGE");
        body.put("discountValue", 20);
        body.put("maxUses", 100);
        body.put("validFrom", LocalDateTime.now().toString());
        body.put("validUntil", LocalDateTime.now().plusDays(30).toString());
        body.put("description", "Été 2026");
        when(promoCodeService.create(any(PlatformPromoCode.class))).thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<?> resp = controller.create(body, jwt);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        PlatformPromoCodeDto saved = (PlatformPromoCodeDto) resp.getBody();
        assertThat(saved.code()).isEqualTo("SUMMER20");
        assertThat(saved.discountValue()).isEqualTo(20);
        assertThat(saved.maxUses()).isEqualTo(100);
        assertThat(saved.description()).isEqualTo("Été 2026");
    }

    @Test
    void create_defaultDiscountType_percentage() {
        Map<String, Object> body = new HashMap<>();
        body.put("code", "X");
        body.put("discountValue", 10);
        when(promoCodeService.create(any())).thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<?> resp = controller.create(body, jwt);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        PlatformPromoCodeDto saved = (PlatformPromoCodeDto) resp.getBody();
        assertThat(saved.discountType()).isEqualTo(PlatformPromoCode.DiscountType.PERCENTAGE);
    }

    @Test
    void create_missingCode_returns400() {
        ResponseEntity<?> resp = controller.create(Map.of("discountValue", 10), jwt);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        verify(promoCodeService, never()).create(any());
    }

    @Test
    void create_blankCode_returns400() {
        ResponseEntity<?> resp = controller.create(Map.of("code", "   ", "discountValue", 5), jwt);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void create_missingDiscountValue_returns400() {
        ResponseEntity<?> resp = controller.create(Map.of("code", "X"), jwt);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void create_discountValueNotNumber_returns400() {
        ResponseEntity<?> resp = controller.create(Map.of("code", "X", "discountValue", "abc"), jwt);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void create_invalidDiscountType_returns400() {
        Map<String, Object> body = Map.of("code", "X", "discountType", "WHATEVER", "discountValue", 5);

        ResponseEntity<?> resp = controller.create(body, jwt);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void create_blankValidFromString_skipped() {
        Map<String, Object> body = new HashMap<>();
        body.put("code", "X");
        body.put("discountValue", 5);
        body.put("validFrom", "");
        body.put("validUntil", "  ");
        when(promoCodeService.create(any())).thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<?> resp = controller.create(body, jwt);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        PlatformPromoCodeDto saved = (PlatformPromoCodeDto) resp.getBody();
        assertThat(saved.validFrom()).isNull();
        assertThat(saved.validUntil()).isNull();
    }

    @Test
    void create_setsCreatedByFromJwt() {
        Map<String, Object> body = Map.of("code", "X", "discountValue", 1);
        when(promoCodeService.create(any())).thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<?> resp = controller.create(body, jwt);

        PlatformPromoCodeDto saved = (PlatformPromoCodeDto) resp.getBody();
        assertThat(saved.createdBy()).isEqualTo("admin-1");
    }

    @Test
    void activate_existing_returns200WithActiveTrue() {
        PlatformPromoCode existing = new PlatformPromoCode();
        existing.setCode("X");
        existing.setActive(true);
        when(promoCodeService.setActive(5L, true)).thenReturn(Optional.of(existing));

        ResponseEntity<?> resp = controller.activate(5L);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        PlatformPromoCodeDto dto = (PlatformPromoCodeDto) resp.getBody();
        assertThat(dto.active()).isTrue();
    }

    @Test
    void activate_notFound_returns404() {
        when(promoCodeService.setActive(99L, true)).thenReturn(Optional.empty());

        ResponseEntity<?> resp = controller.activate(99L);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void deactivate_existing_returns200WithActiveFalse() {
        PlatformPromoCode existing = new PlatformPromoCode();
        existing.setActive(false);
        when(promoCodeService.setActive(10L, false)).thenReturn(Optional.of(existing));

        ResponseEntity<?> resp = controller.deactivate(10L);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        PlatformPromoCodeDto dto = (PlatformPromoCodeDto) resp.getBody();
        assertThat(dto.active()).isFalse();
    }

    @Test
    void deactivate_notFound_returns404() {
        when(promoCodeService.setActive(99L, false)).thenReturn(Optional.empty());

        ResponseEntity<?> resp = controller.deactivate(99L);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
