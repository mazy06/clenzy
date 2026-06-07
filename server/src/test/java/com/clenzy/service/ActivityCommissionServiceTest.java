package com.clenzy.service;

import com.clenzy.dto.ActivityCommissionDto;
import com.clenzy.dto.ActivityCommissionSummaryDto;
import com.clenzy.model.*;
import com.clenzy.repository.ActivityCommissionRepository;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ActivityCommissionServiceTest {

    @Mock private ActivityCommissionRepository commissionRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private WalletService walletService;
    @Mock private LedgerService ledgerService;
    @Mock private MonetizationConfigService monetizationConfigService;

    private ActivityCommissionService service() {
        return new ActivityCommissionService(
            commissionRepository, monetizationConfigService, reservationRepository, walletService, ledgerService);
    }

    @Test
    void record_computesSplit_andCreditsHostShare() {
        when(monetizationConfigService.getEffectiveActivityPlatformCommissionPct(1L)).thenReturn(new BigDecimal("30"));
        when(monetizationConfigService.getEffectiveActivityOrgCommissionPct(1L)).thenReturn(BigDecimal.ZERO);
        when(commissionRepository.save(any())).thenAnswer(inv -> {
            ActivityCommission c = inv.getArgument(0);
            c.setId(1L);
            return c;
        });
        User owner = new User();
        owner.setId(5L);
        Property property = new Property();
        property.setOwner(owner);
        Reservation reservation = new Reservation();
        reservation.setProperty(property);
        when(reservationRepository.findById(50L)).thenReturn(Optional.of(reservation));
        Wallet platformWallet = new Wallet();
        Wallet ownerWallet = new Wallet();
        when(walletService.getOrCreatePlatformWallet(1L, "EUR")).thenReturn(platformWallet);
        when(walletService.getOrCreateWallet(1L, WalletType.OWNER, 5L, "EUR")).thenReturn(ownerWallet);

        ActivityCommissionDto dto = service().record(
            1L, 50L, 9L, ActivityProvider.VIATOR, "VIATOR-123", new BigDecimal("100.00"), "EUR");

        assertThat(dto.hostShare()).isEqualByComparingTo("70.00"); // 70% défaut
        assertThat(dto.platformShare()).isEqualByComparingTo("30.00");
        verify(ledgerService).recordTransfer(eq(platformWallet), eq(ownerWallet),
            eq(new BigDecimal("70.00")), eq(LedgerReferenceType.COMMISSION), anyString(), anyString());
    }

    @Test
    void summaryForOrg_aggregatesTotals() {
        when(commissionRepository.findByOrganizationIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(
            commission(new BigDecimal("100.00"), new BigDecimal("70.00"), new BigDecimal("30.00")),
            commission(new BigDecimal("50.00"), new BigDecimal("35.00"), new BigDecimal("15.00"))));

        ActivityCommissionSummaryDto summary = service().summaryForOrg(1L);

        assertThat(summary.totalGross()).isEqualByComparingTo("150.00");
        assertThat(summary.totalHostShare()).isEqualByComparingTo("105.00");
        assertThat(summary.totalPlatformShare()).isEqualByComparingTo("45.00");
        assertThat(summary.count()).isEqualTo(2);
    }

    private ActivityCommission commission(BigDecimal gross, BigDecimal host, BigDecimal platform) {
        ActivityCommission c = new ActivityCommission();
        c.setGrossCommission(gross);
        c.setHostShare(host);
        c.setPlatformShare(platform);
        c.setCurrency("EUR");
        return c;
    }
}
