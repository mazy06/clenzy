package com.clenzy.service;

import com.clenzy.dto.BillingSummaryDto;
import com.clenzy.model.BillingPeriod;
import com.clenzy.model.Organization;
import com.clenzy.repository.OrganizationMemberRepository;
import com.clenzy.repository.OrganizationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Calcul du resume de facturation per-seat d'une organisation.
 *
 * <p>Formule : total = basePrice + max(0, memberCount - freeSeats) x perSeatPrice,
 * puis application de la remise liee a la periode de facturation de l'organisation
 * (MONTHLY par defaut si absente ou invalide).</p>
 *
 * <p>(T-ARCH-01 : logique extraite d'OrganizationController — l'acces donnees et le
 * calcul vivent en couche service.)</p>
 */
@Service
public class OrganizationBillingService {

    private final OrganizationRepository organizationRepository;
    private final OrganizationMemberRepository memberRepository;
    private final PricingConfigService pricingConfigService;

    public OrganizationBillingService(OrganizationRepository organizationRepository,
                                      OrganizationMemberRepository memberRepository,
                                      PricingConfigService pricingConfigService) {
        this.organizationRepository = organizationRepository;
        this.memberRepository = memberRepository;
        this.pricingConfigService = pricingConfigService;
    }

    @Transactional(readOnly = true)
    public BillingSummaryDto getBillingSummary(Long organizationId) {
        Organization org = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new RuntimeException("Organisation non trouvee: " + organizationId));

        int memberCount = (int) memberRepository.countByOrganizationId(organizationId);
        int basePriceCents = pricingConfigService.getPmsMonthlyPriceCents();
        int perSeatPriceCents = pricingConfigService.getPmsPerSeatPriceCents();
        int freeSeats = pricingConfigService.getPmsFreeSeats();
        int billableSeats = Math.max(0, memberCount - freeSeats);
        int seatsTotalCents = billableSeats * perSeatPriceCents;
        int totalMonthlyCents = basePriceCents + seatsTotalCents;

        // Appliquer la remise de la periode de facturation
        BillingPeriod period = BillingPeriod.MONTHLY;
        if (org.getBillingPeriod() != null) {
            try {
                period = BillingPeriod.valueOf(org.getBillingPeriod());
            } catch (IllegalArgumentException ignored) {
                // fallback to MONTHLY
            }
        }
        double discount = period.getDiscount();
        int effectiveMonthlyCents = (int) Math.round(totalMonthlyCents * discount);

        return new BillingSummaryDto(
                memberCount, freeSeats, billableSeats,
                basePriceCents, perSeatPriceCents, seatsTotalCents,
                totalMonthlyCents, period.name(), discount, effectiveMonthlyCents
        );
    }
}
