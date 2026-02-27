package com.clenzy.service;

import com.clenzy.dto.TouristTaxCalculationDto;
import com.clenzy.model.TouristTaxConfig;
import com.clenzy.model.TouristTaxConfig.TaxCalculationMode;
import com.clenzy.repository.TouristTaxConfigRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class TouristTaxService {

    private final TouristTaxConfigRepository configRepository;

    public TouristTaxService(TouristTaxConfigRepository configRepository) {
        this.configRepository = configRepository;
    }

    public List<TouristTaxConfig> getAllConfigs(Long orgId) {
        return configRepository.findByOrgId(orgId);
    }

    public Optional<TouristTaxConfig> getConfigForProperty(Long propertyId, Long orgId) {
        return configRepository.findByPropertyId(propertyId, orgId);
    }

    @Transactional
    public TouristTaxConfig saveConfig(TouristTaxConfig config) {
        return configRepository.save(config);
    }

    /**
     * Calcule la taxe de sejour pour une reservation.
     *
     * @param propertyId ID de la propriete
     * @param orgId ID de l'organisation
     * @param nights nombre de nuits
     * @param guests nombre de personnes
     * @param nightlyRate tarif par nuit (pour mode PERCENTAGE)
     * @return calcul de la taxe ou null si pas de config
     */
    public TouristTaxCalculationDto calculate(Long propertyId, Long orgId,
                                               int nights, int guests, BigDecimal nightlyRate) {
        Optional<TouristTaxConfig> configOpt = configRepository.findByPropertyId(propertyId, orgId);
        if (configOpt.isEmpty() || !configOpt.get().getEnabled()) {
            return null;
        }

        TouristTaxConfig config = configOpt.get();
        int effectiveNights = config.getMaxNights() != null
            ? Math.min(nights, config.getMaxNights()) : nights;

        BigDecimal taxPerNight;
        BigDecimal totalTax;
        String details;

        switch (config.getCalculationMode()) {
            case PER_PERSON_PER_NIGHT:
                taxPerNight = config.getRatePerPerson() != null
                    ? config.getRatePerPerson().multiply(BigDecimal.valueOf(guests))
                    : BigDecimal.ZERO;
                totalTax = taxPerNight.multiply(BigDecimal.valueOf(effectiveNights))
                    .setScale(2, RoundingMode.HALF_UP);
                details = String.format("%s x %d personnes x %d nuits = %s EUR",
                    config.getRatePerPerson(), guests, effectiveNights, totalTax);
                break;

            case PERCENTAGE_OF_RATE:
                BigDecimal rate = config.getPercentageRate() != null
                    ? config.getPercentageRate() : BigDecimal.ZERO;
                taxPerNight = nightlyRate.multiply(rate).setScale(2, RoundingMode.HALF_UP);
                totalTax = taxPerNight.multiply(BigDecimal.valueOf(effectiveNights))
                    .setScale(2, RoundingMode.HALF_UP);
                details = String.format("%.2f%% de %s EUR/nuit x %d nuits = %s EUR",
                    rate.multiply(BigDecimal.valueOf(100)), nightlyRate, effectiveNights, totalTax);
                break;

            case FLAT_PER_NIGHT:
                taxPerNight = config.getRatePerPerson() != null
                    ? config.getRatePerPerson() : BigDecimal.ZERO;
                totalTax = taxPerNight.multiply(BigDecimal.valueOf(effectiveNights))
                    .setScale(2, RoundingMode.HALF_UP);
                details = String.format("%s EUR/nuit x %d nuits = %s EUR",
                    taxPerNight, effectiveNights, totalTax);
                break;

            default:
                taxPerNight = BigDecimal.ZERO;
                totalTax = BigDecimal.ZERO;
                details = "Unknown calculation mode";
        }

        return new TouristTaxCalculationDto(
            propertyId, config.getCommuneName(), config.getCalculationMode(),
            effectiveNights, guests, taxPerNight, totalTax, details
        );
    }
}
