package com.clenzy.controller;

import com.clenzy.model.PlatformPromoCode;
import com.clenzy.repository.PlatformPromoCodeRepository;
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

@ExtendWith(MockitoExtension.class)
class AdminPlatformPromoCodeControllerTest {

    @Mock private PlatformPromoCodeRepository repository;

    private AdminPlatformPromoCodeController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new AdminPlatformPromoCodeController(repository);
        jwt = Jwt.withTokenValue("t")
                .header("alg", "RS256")
                .claim("sub", "admin-1")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @Test
    void list_returnsRepositoryFindAll() {
        PlatformPromoCode p = new PlatformPromoCode();
        p.setCode("WELCOME10");
        when(repository.findAll()).thenReturn(List.of(p));

        ResponseEntity<List<PlatformPromoCode>> resp = controller.list();

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).hasSize(1);
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
        when(repository.save(any(PlatformPromoCode.class))).thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<?> resp = controller.create(body, jwt);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        PlatformPromoCode saved = (PlatformPromoCode) resp.getBody();
        assertThat(saved.getCode()).isEqualTo("SUMMER20");
        assertThat(saved.getDiscountValue()).isEqualTo(20);
        assertThat(saved.getMaxUses()).isEqualTo(100);
        assertThat(saved.getDescription()).isEqualTo("Été 2026");
    }

    @Test
    void create_defaultDiscountType_percentage() {
        Map<String, Object> body = new HashMap<>();
        body.put("code", "X");
        body.put("discountValue", 10);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<?> resp = controller.create(body, jwt);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        PlatformPromoCode saved = (PlatformPromoCode) resp.getBody();
        assertThat(saved.getDiscountType()).isEqualTo(PlatformPromoCode.DiscountType.PERCENTAGE);
    }

    @Test
    void create_missingCode_returns400() {
        ResponseEntity<?> resp = controller.create(Map.of("discountValue", 10), jwt);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        verify(repository, never()).save(any());
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
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<?> resp = controller.create(body, jwt);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        PlatformPromoCode saved = (PlatformPromoCode) resp.getBody();
        assertThat(saved.getValidFrom()).isNull();
        assertThat(saved.getValidUntil()).isNull();
    }

    @Test
    void create_setsCreatedByFromJwt() {
        Map<String, Object> body = Map.of("code", "X", "discountValue", 1);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<?> resp = controller.create(body, jwt);

        PlatformPromoCode saved = (PlatformPromoCode) resp.getBody();
        assertThat(saved.getCreatedBy()).isEqualTo("admin-1");
    }

    @Test
    void activate_existing_setsActiveTrueAndSaves() {
        PlatformPromoCode existing = new PlatformPromoCode();
        existing.setCode("X");
        existing.setActive(false);
        when(repository.findById(5L)).thenReturn(Optional.of(existing));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<?> resp = controller.activate(5L);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(existing.isActive()).isTrue();
        verify(repository).save(existing);
    }

    @Test
    void activate_notFound_returns404() {
        when(repository.findById(99L)).thenReturn(Optional.empty());

        ResponseEntity<?> resp = controller.activate(99L);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void deactivate_existing_setsActiveFalse() {
        PlatformPromoCode existing = new PlatformPromoCode();
        existing.setActive(true);
        when(repository.findById(10L)).thenReturn(Optional.of(existing));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<?> resp = controller.deactivate(10L);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(existing.isActive()).isFalse();
    }

    @Test
    void deactivate_notFound_returns404() {
        when(repository.findById(99L)).thenReturn(Optional.empty());

        ResponseEntity<?> resp = controller.deactivate(99L);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
