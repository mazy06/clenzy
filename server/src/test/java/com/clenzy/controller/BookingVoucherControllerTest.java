package com.clenzy.controller;

import com.clenzy.dto.voucher.BookingVoucherCreateRequestDto;
import com.clenzy.dto.voucher.BookingVoucherDto;
import com.clenzy.dto.voucher.BookingVoucherUpdateRequestDto;
import com.clenzy.dto.voucher.VoucherAnalyticsDto;
import com.clenzy.dto.voucher.VoucherStatsDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.BookingVoucher;
import com.clenzy.model.User;
import com.clenzy.model.voucher.VoucherChannelScope;
import com.clenzy.model.voucher.VoucherCreatorOrgType;
import com.clenzy.model.voucher.VoucherDiscountType;
import com.clenzy.model.voucher.VoucherStatus;
import com.clenzy.model.voucher.VoucherType;
import com.clenzy.service.UserService;
import com.clenzy.service.voucher.BookingVoucherService;
import com.clenzy.service.voucher.VoucherAnalyticsService;
import com.clenzy.service.voucher.VoucherCreatePayload;
import com.clenzy.service.voucher.VoucherUpdatePayload;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingVoucherControllerTest {

    @Mock private BookingVoucherService voucherService;
    @Mock private VoucherAnalyticsService analyticsService;
    @Mock private UserService userService;
    @Mock private TenantContext tenantContext;

    private BookingVoucherController controller;
    private Jwt jwt;

    private static final Long ORG_ID = 1L;
    private static final String KEYCLOAK_ID = "kc-user-1";
    private static final Long USER_ID = 42L;

    @BeforeEach
    void setUp() {
        controller = new BookingVoucherController(
            voucherService, analyticsService, userService, tenantContext);
        jwt = Jwt.withTokenValue("token")
            .header("alg", "RS256")
            .claim("sub", KEYCLOAK_ID)
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(3600))
            .build();
    }

    private BookingVoucher buildVoucher(Long id, VoucherStatus status) {
        BookingVoucher v = new BookingVoucher();
        v.setId(id);
        v.setOrganizationId(ORG_ID);
        v.setName("Voucher " + id);
        v.setCode("CODE" + id);
        v.setType(VoucherType.MANUAL_CODE);
        v.setDiscountType(VoucherDiscountType.PERCENTAGE);
        v.setDiscountValue(BigDecimal.TEN);
        v.setStatus(status);
        v.setUsageCount(0);
        v.setCreatedByOrgType(VoucherCreatorOrgType.HOST);
        v.setCreatedByUserId(USER_ID);
        v.setCreatedAt(Instant.now());
        v.setUpdatedAt(Instant.now());
        return v;
    }

    private User buildUser() {
        User u = new User();
        u.setId(USER_ID);
        u.setKeycloakId(KEYCLOAK_ID);
        return u;
    }

    @Nested
    @DisplayName("list")
    class List_ {
        @Test
        void returnsListWithScopes() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingVoucher v = buildVoucher(1L, VoucherStatus.ACTIVE);
            when(voucherService.listByOrg(ORG_ID, null)).thenReturn(List.of(v));
            when(voucherService.getScopedPropertyIdsBatch(List.of(1L)))
                .thenReturn(Map.of(1L, Set.of(10L, 20L)));

            List<BookingVoucherDto> result = controller.list(null);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).propertyIds()).containsExactlyInAnyOrder(10L, 20L);
        }

        @Test
        void emptyList_returnsEmpty() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(voucherService.listByOrg(ORG_ID, null)).thenReturn(List.of());

            List<BookingVoucherDto> result = controller.list(null);

            assertThat(result).isEmpty();
        }

        @Test
        void withStatusFilter_callsServiceWithStatus() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingVoucher v = buildVoucher(1L, VoucherStatus.PAUSED);
            when(voucherService.listByOrg(ORG_ID, VoucherStatus.PAUSED)).thenReturn(List.of(v));
            when(voucherService.getScopedPropertyIdsBatch(anyList()))
                .thenReturn(Map.of(1L, Set.of()));

            List<BookingVoucherDto> result = controller.list(VoucherStatus.PAUSED);

            assertThat(result).hasSize(1);
            verify(voucherService).listByOrg(ORG_ID, VoucherStatus.PAUSED);
        }
    }

    @Nested
    @DisplayName("getOne")
    class GetOne {
        @Test
        void returnsVoucher() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingVoucher v = buildVoucher(1L, VoucherStatus.ACTIVE);
            when(voucherService.findOrThrow(1L, ORG_ID)).thenReturn(v);
            when(voucherService.getScopedPropertyIds(1L)).thenReturn(Set.of(10L));

            BookingVoucherDto result = controller.getOne(1L);

            assertThat(result.id()).isEqualTo(1L);
            assertThat(result.propertyIds()).containsExactly(10L);
        }
    }

    @Nested
    @DisplayName("create")
    class Create {
        @Test
        void returnsCreatedVoucher() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(userService.findByKeycloakId(KEYCLOAK_ID)).thenReturn(buildUser());

            BookingVoucherCreateRequestDto req = new BookingVoucherCreateRequestDto(
                "My voucher", "desc", "CODE1", VoucherType.MANUAL_CODE,
                VoucherDiscountType.PERCENTAGE, BigDecimal.TEN,
                null, null, null, null, null, null, null,
                VoucherChannelScope.ALL, VoucherStatus.DRAFT, List.of(10L));

            BookingVoucher created = buildVoucher(99L, VoucherStatus.DRAFT);
            when(voucherService.detectCreatorOrgType(USER_ID, List.of(10L)))
                .thenReturn(VoucherCreatorOrgType.HOST);
            when(voucherService.create(eq(ORG_ID), eq(USER_ID),
                eq(VoucherCreatorOrgType.HOST), any(VoucherCreatePayload.class)))
                .thenReturn(created);
            when(voucherService.getScopedPropertyIds(99L)).thenReturn(Set.of(10L));

            BookingVoucherDto result = controller.create(req, jwt);

            assertThat(result.id()).isEqualTo(99L);
        }

        @Test
        void userNotFound_throws() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(userService.findByKeycloakId(KEYCLOAK_ID)).thenReturn(null);

            BookingVoucherCreateRequestDto req = new BookingVoucherCreateRequestDto(
                "V", null, null, VoucherType.MANUAL_CODE,
                VoucherDiscountType.PERCENTAGE, BigDecimal.TEN,
                null, null, null, null, null, null, null,
                null, null, null);

            assertThatThrownBy(() -> controller.create(req, jwt))
                .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("update")
    class Update {
        @Test
        void updateWithScope_usesDetectFromScope() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(userService.findByKeycloakId(KEYCLOAK_ID)).thenReturn(buildUser());

            BookingVoucherUpdateRequestDto req = new BookingVoucherUpdateRequestDto(
                "New name", null, null, null, null, null, null,
                null, null, null, null, null, null, null, List.of(20L));

            BookingVoucher updated = buildVoucher(5L, VoucherStatus.ACTIVE);
            when(voucherService.detectCreatorOrgType(USER_ID, List.of(20L)))
                .thenReturn(VoucherCreatorOrgType.HOST);
            when(voucherService.update(eq(5L), eq(ORG_ID), eq(USER_ID),
                eq(VoucherCreatorOrgType.HOST), any(VoucherUpdatePayload.class)))
                .thenReturn(updated);
            when(voucherService.getScopedPropertyIds(5L)).thenReturn(Set.of(20L));

            BookingVoucherDto result = controller.update(5L, req, jwt);

            assertThat(result.id()).isEqualTo(5L);
            verify(voucherService).detectCreatorOrgType(USER_ID, List.of(20L));
        }

        @Test
        void updateWithoutScope_usesDetectFromExistingScope() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(userService.findByKeycloakId(KEYCLOAK_ID)).thenReturn(buildUser());

            BookingVoucherUpdateRequestDto req = new BookingVoucherUpdateRequestDto(
                "New name", null, null, null, null, null, null,
                null, null, null, null, null, null, null, null);

            BookingVoucher updated = buildVoucher(5L, VoucherStatus.ACTIVE);
            when(voucherService.detectCreatorOrgTypeFromExistingScope(5L, USER_ID))
                .thenReturn(VoucherCreatorOrgType.MANAGEMENT_ORG);
            when(voucherService.update(eq(5L), eq(ORG_ID), eq(USER_ID),
                eq(VoucherCreatorOrgType.MANAGEMENT_ORG), any(VoucherUpdatePayload.class)))
                .thenReturn(updated);
            when(voucherService.getScopedPropertyIds(5L)).thenReturn(Set.of());

            BookingVoucherDto result = controller.update(5L, req, jwt);

            assertThat(result.id()).isEqualTo(5L);
            verify(voucherService).detectCreatorOrgTypeFromExistingScope(5L, USER_ID);
        }
    }

    @Nested
    @DisplayName("delete")
    class Delete {
        @Test
        void deletes() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            doNothing().when(voucherService).delete(5L, ORG_ID);

            controller.delete(5L);

            verify(voucherService).delete(5L, ORG_ID);
        }
    }

    @Nested
    @DisplayName("pause")
    class Pause {
        @Test
        void pausesVoucher() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingVoucher paused = buildVoucher(5L, VoucherStatus.PAUSED);
            when(voucherService.setStatus(5L, ORG_ID, VoucherStatus.PAUSED)).thenReturn(paused);
            when(voucherService.getScopedPropertyIds(5L)).thenReturn(Set.of());

            BookingVoucherDto result = controller.pause(5L);

            assertThat(result.status()).isEqualTo(VoucherStatus.PAUSED);
        }
    }

    @Nested
    @DisplayName("resume")
    class Resume {
        @Test
        void resumesVoucher() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingVoucher active = buildVoucher(5L, VoucherStatus.ACTIVE);
            when(voucherService.setStatus(5L, ORG_ID, VoucherStatus.ACTIVE)).thenReturn(active);
            when(voucherService.getScopedPropertyIds(5L)).thenReturn(Set.of());

            BookingVoucherDto result = controller.resume(5L);

            assertThat(result.status()).isEqualTo(VoucherStatus.ACTIVE);
        }
    }

    @Nested
    @DisplayName("getOrgAnalytics")
    class GetOrgAnalytics {
        @Test
        void returnsAnalytics() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            Instant from = Instant.now().minusSeconds(86400);
            Instant to = Instant.now();
            VoucherAnalyticsDto dto = new VoucherAnalyticsDto(
                from, to, 10L, BigDecimal.TEN, BigDecimal.ONE, BigDecimal.TEN, 1L, List.of());
            when(analyticsService.getOrgAnalytics(ORG_ID, from, to)).thenReturn(dto);

            VoucherAnalyticsDto result = controller.getOrgAnalytics(from, to);

            assertThat(result.totalUsages()).isEqualTo(10);
        }

        @Test
        void withNullDates_passesNull() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            VoucherAnalyticsDto dto = new VoucherAnalyticsDto(
                null, null, 0L, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 0L, List.of());
            when(analyticsService.getOrgAnalytics(ORG_ID, null, null)).thenReturn(dto);

            VoucherAnalyticsDto result = controller.getOrgAnalytics(null, null);

            assertThat(result.totalUsages()).isEqualTo(0);
        }
    }

    @Nested
    @DisplayName("getVoucherAnalytics")
    class GetVoucherAnalytics {
        @Test
        void returnsStats() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            VoucherStatsDto stats = new VoucherStatsDto(
                1L, "V1", "CODE1", 5L, BigDecimal.TEN, BigDecimal.ONE, BigDecimal.TEN, BigDecimal.ZERO);
            when(analyticsService.getVoucherStats(1L, ORG_ID)).thenReturn(stats);

            VoucherStatsDto result = controller.getVoucherAnalytics(1L);

            assertThat(result.voucherId()).isEqualTo(1L);
            assertThat(result.usageCount()).isEqualTo(5);
        }
    }
}
