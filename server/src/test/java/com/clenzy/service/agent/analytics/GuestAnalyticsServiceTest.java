package com.clenzy.service.agent.analytics;

import com.clenzy.dto.GuestListDto;
import com.clenzy.service.GuestService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("GuestAnalyticsService — segmentation NEW / REPEAT / VIP")
class GuestAnalyticsServiceTest {

    private static final Long ORG = 1L;

    @Mock private GuestService guestService;
    @Mock private TenantContext tenantContext;

    private GuestAnalyticsService service;

    @BeforeEach
    void setUp() {
        service = new GuestAnalyticsService(guestService, tenantContext);
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG);
    }

    @Test
    @DisplayName("Mix de profils → segments NEW/REPEAT/VIP corrects + recommandation VIP")
    void segments_computed() {
        // avgSpend = (100+500+2000)/3 = 866.67 → seuil VIP = 1733.33 → seul g3 (2000) est VIP.
        when(guestService.listGuests(eq(ORG), any(), any())).thenReturn(List.of(
                guest(1L, "Alice", 1, "100"),
                guest(2L, "Bob", 3, "500"),
                guest(3L, "Carla", 5, "2000")));

        GuestAnalyticsService.SegmentationResult result = service.segment();

        assertThat(result.totalGuests()).isEqualTo(3);
        assertThat(segment(result, "NEW").count()).isEqualTo(1);
        assertThat(segment(result, "REPEAT").count()).isEqualTo(2);
        assertThat(segment(result, "VIP").count()).isEqualTo(1);
        assertThat(segment(result, "VIP").samples().get(0).name()).isEqualTo("Carla");
        assertThat(result.recommendation()).contains("VIP");
    }

    @Test
    @DisplayName("Aucun voyageur → résultat vide")
    void noGuests_empty() {
        when(guestService.listGuests(eq(ORG), any(), any())).thenReturn(List.of());

        GuestAnalyticsService.SegmentationResult result = service.segment();

        assertThat(result.totalGuests()).isZero();
        assertThat(result.segments()).isEmpty();
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private static GuestAnalyticsService.Segment segment(
            GuestAnalyticsService.SegmentationResult result, String name) {
        return result.segments().stream()
                .filter(s -> s.segment().equals(name))
                .findFirst()
                .orElseThrow();
    }

    private static GuestListDto guest(Long id, String fullName, int stays, String spent) {
        return new GuestListDto(id, fullName, "L", null, null, fullName, "airbnb",
                stays, new BigDecimal(spent), "fr", null, ORG, null);
    }
}
