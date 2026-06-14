package com.clenzy.service;

import com.clenzy.dto.CancellationRefundPreviewDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.CancellationPolicyType;
import com.clenzy.model.ChannelCancellationPolicy;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ChannelCancellationPolicyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;
import java.util.Map;

/**
 * Applique la politique d'annulation a une reservation pour calculer un apercu de remboursement
 * (CLZ Domaine 2). Resout la politique pertinente (canal DIRECT prioritaire, sinon BOOKING_ENGINE,
 * sinon premiere configuree, sinon defaut FLEXIBLE) puis delegue le calcul au moteur pur
 * {@link CancellationRefundCalculator}.
 */
@Service
public class CancellationRefundService {

    private final ReservationRepository reservationRepository;
    private final ChannelCancellationPolicyRepository policyRepository;
    private final CancellationRefundCalculator calculator;
    private final TenantContext tenantContext;
    private final Clock clock;

    public CancellationRefundService(ReservationRepository reservationRepository,
                                     ChannelCancellationPolicyRepository policyRepository,
                                     CancellationRefundCalculator calculator,
                                     TenantContext tenantContext,
                                     Clock clock) {
        this.reservationRepository = reservationRepository;
        this.policyRepository = policyRepository;
        this.calculator = calculator;
        this.tenantContext = tenantContext;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public CancellationRefundPreviewDto preview(Long reservationId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new NotFoundException("Reservation not found: " + reservationId));
        // Audit #3 : findById contourne le filtre Hibernate -> valider l'org explicitement.
        if (reservation.getOrganizationId() == null || !reservation.getOrganizationId().equals(orgId)) {
            throw new AccessDeniedException("Reservation " + reservationId + " hors organisation");
        }

        Property property = reservation.getProperty();
        Long propertyId = property != null ? property.getId() : null;
        PolicyResolution resolution = resolvePolicy(propertyId, orgId);

        CancellationRefundCalculator.Result result = calculator.compute(new CancellationRefundCalculator.Input(
                reservation.getTotalPrice(),
                reservation.getCheckIn(),
                reservation.getCheckInTime(),
                property != null ? property.getTimezone() : null,
                clock.instant(),
                resolution.policyType(),
                resolution.customRules()
        ));

        String currency = property != null && property.getDefaultCurrency() != null
                ? property.getDefaultCurrency() : "EUR";

        return new CancellationRefundPreviewDto(
                reservationId,
                result.policyType().name(),
                result.refundPercentage(),
                result.refundAmount(),
                result.nonRefundableAmount(),
                currency,
                result.daysBeforeCheckIn(),
                resolution.configured(),
                result.explanation());
    }

    private PolicyResolution resolvePolicy(Long propertyId, Long orgId) {
        if (propertyId == null) {
            return PolicyResolution.defaultPolicy();
        }
        return policyRepository.findByPropertyIdAndChannelName(propertyId, ChannelName.DIRECT, orgId)
                .or(() -> policyRepository.findByPropertyIdAndChannelName(propertyId, ChannelName.BOOKING_ENGINE, orgId))
                .map(p -> PolicyResolution.from(p))
                .orElseGet(() -> {
                    List<ChannelCancellationPolicy> all = policyRepository.findByPropertyId(propertyId, orgId);
                    return all.isEmpty() ? PolicyResolution.defaultPolicy() : PolicyResolution.from(all.get(0));
                });
    }

    private record PolicyResolution(CancellationPolicyType policyType,
                                    List<Map<String, Object>> customRules,
                                    boolean configured) {

        static PolicyResolution defaultPolicy() {
            return new PolicyResolution(CancellationPolicyType.FLEXIBLE, List.of(), false);
        }

        static PolicyResolution from(ChannelCancellationPolicy p) {
            CancellationPolicyType type = p.getPolicyType() != null ? p.getPolicyType() : CancellationPolicyType.FLEXIBLE;
            List<Map<String, Object>> rules = p.getCancellationRules() != null ? p.getCancellationRules() : List.of();
            return new PolicyResolution(type, rules, true);
        }
    }
}
