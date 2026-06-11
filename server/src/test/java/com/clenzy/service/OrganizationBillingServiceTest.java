package com.clenzy.service;

import com.clenzy.dto.BillingSummaryDto;
import com.clenzy.model.Organization;
import com.clenzy.repository.OrganizationMemberRepository;
import com.clenzy.repository.OrganizationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/**
 * Tests du calcul de facturation per-seat (logique extraite
 * d'OrganizationController — T-ARCH-01).
 */
@ExtendWith(MockitoExtension.class)
class OrganizationBillingServiceTest {

    @Mock private OrganizationRepository organizationRepository;
    @Mock private OrganizationMemberRepository memberRepository;
    @Mock private PricingConfigService pricingConfigService;

    private OrganizationBillingService service;

    @BeforeEach
    void setUp() {
        service = new OrganizationBillingService(organizationRepository, memberRepository, pricingConfigService);
    }

    private Organization org(Long id, String billingPeriod) {
        Organization org = new Organization();
        org.setId(id);
        org.setBillingPeriod(billingPeriod);
        return org;
    }

    private void stubPricing() {
        when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(4900);
        when(pricingConfigService.getPmsPerSeatPriceCents()).thenReturn(900);
        when(pricingConfigService.getPmsFreeSeats()).thenReturn(2);
    }

    @Test
    void whenMonthlyOrgWithBillableSeats_thenComputesTotals() {
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(org(1L, "MONTHLY")));
        when(memberRepository.countByOrganizationId(1L)).thenReturn(5L);
        stubPricing();

        BillingSummaryDto summary = service.getBillingSummary(1L);

        assertThat(summary.getMemberCount()).isEqualTo(5);
        assertThat(summary.getFreeSeats()).isEqualTo(2);
        assertThat(summary.getBillableSeats()).isEqualTo(3);
        assertThat(summary.getSeatsTotalCents()).isEqualTo(2700);
        assertThat(summary.getTotalMonthlyCents()).isEqualTo(7600);
        assertThat(summary.getBillingPeriod()).isEqualTo("MONTHLY");
        assertThat(summary.getEffectiveMonthlyCents()).isEqualTo(7600);
    }

    @Test
    void whenAnnualBillingPeriod_thenAppliesDiscount() {
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(org(1L, "ANNUAL")));
        when(memberRepository.countByOrganizationId(1L)).thenReturn(5L);
        stubPricing();

        BillingSummaryDto summary = service.getBillingSummary(1L);

        assertThat(summary.getBillingPeriod()).isEqualTo("ANNUAL");
        assertThat(summary.getBillingPeriodDiscount()).isEqualTo(0.80);
        assertThat(summary.getEffectiveMonthlyCents()).isEqualTo(6080); // round(7600 * 0.80)
    }

    @Test
    void whenUnknownBillingPeriod_thenFallsBackToMonthly() {
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(org(1L, "WEEKLY")));
        when(memberRepository.countByOrganizationId(1L)).thenReturn(1L);
        stubPricing();

        BillingSummaryDto summary = service.getBillingSummary(1L);

        assertThat(summary.getBillingPeriod()).isEqualTo("MONTHLY");
        assertThat(summary.getBillableSeats()).isEqualTo(0); // 1 membre, 2 sieges gratuits
        assertThat(summary.getEffectiveMonthlyCents()).isEqualTo(4900);
    }

    @Test
    void whenOrganizationMissing_thenThrows() {
        when(organizationRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getBillingSummary(404L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Organisation non trouvee");
    }
}
