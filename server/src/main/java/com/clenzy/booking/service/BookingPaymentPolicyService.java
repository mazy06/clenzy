package com.clenzy.booking.service;

import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.repository.BookingEngineConfigRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

/**
 * Résout la politique de paiement (caution + acompte) d'un booking engine pour une org — extrait
 * de la config. Sépare l'accès données de {@code BookingCheckoutController} (audit #4 / T-ARCH-01 :
 * un controller ne dépend pas d'un repository).
 */
@Service
public class BookingPaymentPolicyService {

    private final BookingEngineConfigRepository configRepository;

    public BookingPaymentPolicyService(BookingEngineConfigRepository configRepository) {
        this.configRepository = configRepository;
    }

    /** Politique de paiement : caution (montant), acompte (% + délai du solde). Champs null = inactif. */
    public record BookingPaymentPolicy(BigDecimal securityDepositAmount, Integer depositPercent, Integer balanceDueDays) {
        public static BookingPaymentPolicy none() {
            return new BookingPaymentPolicy(null, null, null);
        }
    }

    @Transactional(readOnly = true)
    public BookingPaymentPolicy resolve(Long orgId) {
        return configRepository.findFirstByOrganizationId(orgId)
            .map(c -> new BookingPaymentPolicy(c.getSecurityDepositAmount(), c.getDepositPercent(), c.getBalanceDueDays()))
            .orElseGet(BookingPaymentPolicy::none);
    }
}
