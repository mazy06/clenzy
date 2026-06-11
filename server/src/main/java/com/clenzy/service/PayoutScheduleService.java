package com.clenzy.service;

import com.clenzy.dto.PayoutScheduleConfigDto;
import com.clenzy.model.PayoutScheduleConfig;
import com.clenzy.repository.PayoutScheduleConfigRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Configuration du calendrier de generation automatique des reversements.
 *
 * <p>Table singleton plateforme (pas de scoping org) : un seul row, upsert via
 * l'application. La restriction d'ecriture (SUPER_ADMIN) est portee par le
 * {@code @PreAuthorize} du controller.</p>
 */
@Service
public class PayoutScheduleService {

    private final PayoutScheduleConfigRepository repository;

    public PayoutScheduleService(PayoutScheduleConfigRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public Optional<PayoutScheduleConfigDto> getScheduleConfig() {
        return repository.findAll().stream()
                .findFirst()
                .map(PayoutScheduleConfigDto::from);
    }

    /**
     * Upsert de la config singleton. Les champs null sont conserves tels quels ;
     * les jours hors plage 1-28 sont filtres, la grace period est bornee 0-30.
     */
    @Transactional
    public PayoutScheduleConfigDto updateScheduleConfig(List<Integer> payoutDaysOfMonth,
                                                        Integer gracePeriodDays,
                                                        Boolean autoGenerateEnabled) {
        PayoutScheduleConfig config = repository.findAll().stream()
                .findFirst()
                .orElseGet(PayoutScheduleConfig::new);

        if (payoutDaysOfMonth != null) {
            // Valider que les jours sont entre 1 et 28
            List<Integer> validDays = payoutDaysOfMonth.stream()
                    .filter(d -> d >= 1 && d <= 28)
                    .distinct()
                    .sorted()
                    .toList();
            config.setPayoutDaysOfMonth(validDays);
        }

        if (gracePeriodDays != null) {
            config.setGracePeriodDays(Math.max(0, Math.min(gracePeriodDays, 30)));
        }

        if (autoGenerateEnabled != null) {
            config.setAutoGenerateEnabled(autoGenerateEnabled);
        }

        return PayoutScheduleConfigDto.from(repository.save(config));
    }
}
