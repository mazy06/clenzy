package com.clenzy.controller;

import com.clenzy.dto.amenity.*;
import com.clenzy.integration.channex.dto.ChannexFacilityOptionDto;
import com.clenzy.service.AmenityManagementService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AmenityManagementControllerTest {

    @Mock private AmenityManagementService service;
    @Mock private TenantContext tenantContext;

    private AmenityManagementController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new AmenityManagementController(service, tenantContext);
        lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(3L);
        jwt = Jwt.withTokenValue("t")
                .header("alg", "RS256")
                .claim("sub", "user-abc")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @Test
    void listUnmapped_delegates() {
        UnmappedAmenityDto dto = new UnmappedAmenityDto("WiFi", 3, List.of(), List.of("AirBNB"));
        when(service.findUnmapped(3L)).thenReturn(List.of(dto));

        List<UnmappedAmenityDto> result = controller.listUnmapped();

        assertThat(result).hasSize(1);
        verify(service).findUnmapped(3L);
    }

    @Test
    void listCustom_delegates() {
        when(service.listCustomAmenities(3L)).thenReturn(List.of());
        assertThat(controller.listCustom()).isEmpty();
    }

    @Test
    void createCustom_withJwt_propagatesSubject() {
        CreateCustomAmenityRequest req = new CreateCustomAmenityRequest(
                "Piscine", "Pool", "outdoor", "pool", null, false);
        CustomAmenityDto dto = new CustomAmenityDto(1L, "pool", "Piscine", "Pool",
                "outdoor", null, null);
        when(service.createCustomAmenity(eq(3L), eq("user-abc"), any())).thenReturn(dto);

        CustomAmenityDto result = controller.createCustom(req, jwt);

        assertThat(result).isEqualTo(dto);
        verify(service).createCustomAmenity(3L, "user-abc", req);
    }

    @Test
    void createCustom_withoutJwt_passesNullSubject() {
        CreateCustomAmenityRequest req = new CreateCustomAmenityRequest(
                "X", null, null, null, null, false);
        when(service.createCustomAmenity(eq(3L), eq(null), any())).thenReturn(
                new CustomAmenityDto(1L, "x", "X", null, null, null, null));

        controller.createCustom(req, null);

        verify(service).createCustomAmenity(3L, null, req);
    }

    @Test
    void deleteCustom_delegates() {
        controller.deleteCustom(99L);
        verify(service).deleteCustomAmenity(3L, 99L);
    }

    @Test
    void listAliases_delegates() {
        when(service.listAliases(3L)).thenReturn(List.of());
        assertThat(controller.listAliases()).isEmpty();
    }

    @Test
    void createAlias_propagatesSubject() {
        CreateAliasRequest req = new CreateAliasRequest("Smoke alarm", "smoke_alarm", "AirBNB", false);
        AmenityAliasDto dto = new AmenityAliasDto(1L, "Smoke alarm", "smoke_alarm", "AirBNB", null, null);
        when(service.createAlias(eq(3L), eq("user-abc"), any())).thenReturn(dto);

        AmenityAliasDto result = controller.createAlias(req, jwt);

        assertThat(result).isEqualTo(dto);
    }

    @Test
    void bulkCreateAliases_delegates() {
        CreateAliasRequest.BulkRequest req = new CreateAliasRequest.BulkRequest(
                "wifi", List.of("Wifi", "WiFi"), "AirBNB", false);
        ReprocessResult result = new ReprocessResult(1, 1, 2, 2, 0, 0);
        when(service.bulkCreateAliases(eq(3L), eq("user-abc"), any())).thenReturn(result);

        ReprocessResult got = controller.bulkCreateAliases(req, jwt);
        assertThat(got).isEqualTo(result);
    }

    @Test
    void deleteAlias_delegates() {
        controller.deleteAlias(5L);
        verify(service).deleteAlias(3L, 5L);
    }

    @Test
    void listIgnored_delegates() {
        when(service.listIgnored(3L)).thenReturn(List.of());
        assertThat(controller.listIgnored()).isEmpty();
    }

    @Test
    void createIgnored_propagatesSubject() {
        CreateIgnoredRequest req = new CreateIgnoredRequest("Junk", "AirBNB", false);
        IgnoredAmenityDto dto = new IgnoredAmenityDto(1L, "Junk", "AirBNB", null);
        when(service.createIgnored(eq(3L), eq("user-abc"), any())).thenReturn(dto);

        IgnoredAmenityDto result = controller.createIgnored(req, jwt);
        assertThat(result).isEqualTo(dto);
    }

    @Test
    void deleteIgnored_delegates() {
        controller.deleteIgnored(7L);
        verify(service).deleteIgnored(3L, 7L);
    }

    @Test
    void reprocess_returnsResultOk() {
        ReprocessResult result = new ReprocessResult(5, 3, 30, 20, 5, 5);
        when(service.reprocess(3L)).thenReturn(result);

        ResponseEntity<ReprocessResult> resp = controller.reprocess();
        assertThat(resp.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(resp.getBody()).isEqualTo(result);
    }

    @Test
    void listChannexFacilityCatalog_delegates() {
        when(service.listChannexFacilityCatalog()).thenReturn(List.of());
        List<ChannexFacilityOptionDto> result = controller.listChannexFacilityCatalog();
        assertThat(result).isEmpty();
    }
}
