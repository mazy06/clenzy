package com.clenzy.service;

import com.clenzy.dto.ActivityCommissionDto;
import com.clenzy.dto.ActivityCommissionSummaryDto;
import com.clenzy.model.*;
import com.clenzy.repository.ActivityAffiliateConfigRepository;
import com.clenzy.repository.ActivityCommissionRepository;
import com.clenzy.repository.PropertyRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ActivityCommissionServiceTest {

    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 42L;
    private static final Long OWNER_ID = 7L;

    @Mock private ActivityCommissionRepository commissionRepository;
    @Mock private ActivityAffiliateConfigRepository affiliateConfigRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private WalletService walletService;
    @Mock private LedgerService ledgerService;

    private ActivityCommissionService service() {
        return new ActivityCommissionService(
            commissionRepository, affiliateConfigRepository, propertyRepository,
            walletService, ledgerService);
    }

    @Test
    void recordAffiliateEarning_retainsPlatformShare_andCreditsTheRestToOwner() {
        givenPlatformRate(new BigDecimal("20.00"));
        givenResolvableOwner();

        ActivityCommissionDto dto = service().recordAffiliateEarning(
            ORG_ID, ActivityProvider.VIATOR, "VT-1", new BigDecimal("100.00"), "EUR", PROPERTY_ID);

        assertThat(dto.platformShare()).isEqualByComparingTo("20.00");
        assertThat(dto.hostShare()).isEqualByComparingTo("80.00");
        verify(ledgerService).recordTransfer(any(), any(), eq(new BigDecimal("80.00")),
            eq(LedgerReferenceType.COMMISSION), anyString(), anyString());
    }

    @Test
    void recordAffiliateEarning_retainsNothing_whenNoRateAgreed() {
        // Pas d'accord saisi : l'integralite revient a l'hote, aucun defaut applique.
        givenPlatformRate(null);
        givenResolvableOwner();

        ActivityCommissionDto dto = service().recordAffiliateEarning(
            ORG_ID, ActivityProvider.KLOOK, "KL-9", new BigDecimal("60.00"), "EUR", PROPERTY_ID);

        assertThat(dto.platformShare()).isEqualByComparingTo("0");
        assertThat(dto.hostShare()).isEqualByComparingTo("60.00");
    }

    @Test
    void recordAffiliateEarning_neverGivesAnythingToTheConcierge() {
        givenPlatformRate(new BigDecimal("30.00"));
        givenResolvableOwner();

        service().recordAffiliateEarning(
            ORG_ID, ActivityProvider.VIATOR, "VT-2", new BigDecimal("100.00"), "EUR", PROPERTY_ID);

        // Un seul transfert, vers le wallet OWNER : la conciergerie n'a pas de part.
        verify(walletService).getOrCreateWallet(ORG_ID, WalletType.OWNER, OWNER_ID, "EUR");
        verify(walletService, never()).getOrCreateWallet(eq(ORG_ID), eq(WalletType.CONCIERGE), any(), anyString());
    }

    @Test
    void recordAffiliateEarning_isIdempotent_soReplayedReportsDoNotPayTwice() {
        ActivityCommission already = commission(
            new BigDecimal("100.00"), new BigDecimal("80.00"), new BigDecimal("20.00"));
        when(commissionRepository.findByOrganizationIdAndProviderAndExternalBookingId(
            ORG_ID, ActivityProvider.VIATOR, "VT-1")).thenReturn(Optional.of(already));

        service().recordAffiliateEarning(
            ORG_ID, ActivityProvider.VIATOR, "VT-1", new BigDecimal("100.00"), "EUR", PROPERTY_ID);

        verify(commissionRepository, never()).save(any());
        verify(ledgerService, never()).recordTransfer(any(), any(), any(), any(), anyString(), anyString());
    }

    @Test
    void recordAffiliateEarning_keepsTheRow_whenOwnerCannotBeResolved() {
        givenPlatformRate(new BigDecimal("10.00"));
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.empty());

        ActivityCommissionDto dto = service().recordAffiliateEarning(
            ORG_ID, ActivityProvider.GETYOURGUIDE, "GY-3", new BigDecimal("40.00"), "EUR", PROPERTY_ID);

        // La ligne est la trace de ce que le programme a verse : on la garde.
        assertThat(dto.hostShare()).isEqualByComparingTo("36.00");
        verify(commissionRepository).save(any());
        verify(ledgerService, never()).recordTransfer(any(), any(), any(), any(), anyString(), anyString());
    }

    @Test
    void recordAffiliateEarning_rejectsNonPositiveCommission() {
        assertThatThrownBy(() -> service().recordAffiliateEarning(
            ORG_ID, ActivityProvider.VIATOR, "VT-0", BigDecimal.ZERO, "EUR", PROPERTY_ID))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void summaryForOrg_aggregatesTotals() {
        when(commissionRepository.findByOrganizationIdOrderByCreatedAtDesc(ORG_ID)).thenReturn(List.of(
            commission(new BigDecimal("100.00"), new BigDecimal("70.00"), new BigDecimal("30.00")),
            commission(new BigDecimal("50.00"), new BigDecimal("35.00"), new BigDecimal("15.00"))));

        ActivityCommissionSummaryDto summary = service().summaryForOrg(ORG_ID);

        assertThat(summary.totalGross()).isEqualByComparingTo("150.00");
        assertThat(summary.totalHostShare()).isEqualByComparingTo("105.00");
        assertThat(summary.totalPlatformShare()).isEqualByComparingTo("45.00");
        assertThat(summary.count()).isEqualTo(2);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private void givenPlatformRate(BigDecimal pct) {
        ActivityAffiliateConfig config = new ActivityAffiliateConfig();
        config.setOrganizationId(ORG_ID);
        config.setPlatformCommissionPct(pct);
        when(affiliateConfigRepository.findByOrganizationIdAndProvider(eq(ORG_ID), any()))
            .thenReturn(Optional.of(config));
    }

    private void givenResolvableOwner() {
        User owner = new User();
        owner.setId(OWNER_ID);
        Property property = new Property();
        property.setId(PROPERTY_ID);
        property.setOwner(owner);
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
    }

    private ActivityCommission commission(BigDecimal gross, BigDecimal host, BigDecimal platform) {
        ActivityCommission c = new ActivityCommission();
        c.setProvider(ActivityProvider.VIATOR);
        c.setGrossCommission(gross);
        c.setHostShare(host);
        c.setPlatformShare(platform);
        c.setCurrency("EUR");
        return c;
    }
}
