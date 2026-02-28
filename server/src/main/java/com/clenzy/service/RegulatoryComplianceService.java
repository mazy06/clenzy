package com.clenzy.service;

import com.clenzy.dto.RegulatoryComplianceDto;
import com.clenzy.model.Property;
import com.clenzy.model.RegulatoryConfig;
import com.clenzy.model.RegulatoryConfig.RegulatoryType;
import com.clenzy.model.Reservation;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RegulatoryConfigRepository;
import com.clenzy.repository.ReservationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class RegulatoryComplianceService {

    private static final Logger log = LoggerFactory.getLogger(RegulatoryComplianceService.class);
    private static final int DEFAULT_MAX_DAYS = 120;
    private static final int WARNING_THRESHOLD = 100;

    private final RegulatoryConfigRepository configRepository;
    private final ReservationRepository reservationRepository;
    private final PropertyRepository propertyRepository;

    public RegulatoryComplianceService(RegulatoryConfigRepository configRepository,
                                        ReservationRepository reservationRepository,
                                        PropertyRepository propertyRepository) {
        this.configRepository = configRepository;
        this.reservationRepository = reservationRepository;
        this.propertyRepository = propertyRepository;
    }

    public List<RegulatoryConfig> getConfigs(Long propertyId, Long orgId) {
        return configRepository.findByPropertyId(propertyId, orgId);
    }

    public List<RegulatoryConfig> getAllConfigs(Long orgId) {
        return configRepository.findAllByOrgId(orgId);
    }

    @Transactional
    public RegulatoryConfig saveConfig(RegulatoryConfig config) {
        return configRepository.save(config);
    }

    /**
     * Calcule la conformite ALUR (120 jours) pour une propriete sur une annee.
     */
    public RegulatoryComplianceDto checkAlurCompliance(Long propertyId, Long orgId, int year) {
        LocalDate yearStart = LocalDate.of(year, 1, 1);
        LocalDate yearEnd = LocalDate.of(year, 12, 31);

        Optional<RegulatoryConfig> configOpt = configRepository.findByPropertyAndType(
            propertyId, RegulatoryType.ALUR_120_DAYS, orgId);

        int maxDays = configOpt.map(RegulatoryConfig::getMaxDaysPerYear).orElse(DEFAULT_MAX_DAYS);
        String regNumber = configOpt.map(RegulatoryConfig::getRegistrationNumber).orElse(null);

        List<Reservation> reservations = reservationRepository.findByPropertyIdsAndDateRange(
            List.of(propertyId), yearStart, yearEnd, orgId);

        int totalDays = 0;
        for (Reservation r : reservations) {
            if (r.getCheckIn() != null && r.getCheckOut() != null) {
                LocalDate start = r.getCheckIn().isBefore(yearStart) ? yearStart : r.getCheckIn();
                LocalDate end = r.getCheckOut().isAfter(yearEnd) ? yearEnd : r.getCheckOut();
                totalDays += (int) ChronoUnit.DAYS.between(start, end);
            }
        }

        int remaining = maxDays - totalDays;
        boolean compliant = totalDays <= maxDays;

        String alert = null;
        if (!compliant) {
            alert = "DEPASSEMENT: " + totalDays + "/" + maxDays + " jours loues en " + year;
        } else if (totalDays >= WARNING_THRESHOLD) {
            alert = "ATTENTION: " + totalDays + "/" + maxDays + " jours loues, proche du seuil";
        }

        String propertyName = propertyRepository.findById(propertyId)
            .map(Property::getName).orElse("Unknown");

        return new RegulatoryComplianceDto(
            propertyId, propertyName, year, totalDays, maxDays,
            Math.max(0, remaining), compliant, regNumber, alert
        );
    }

    /**
     * Verifie toutes les proprietes soumises a ALUR pour une annee.
     */
    public List<RegulatoryComplianceDto> checkAllAlurCompliance(Long orgId, int year) {
        List<RegulatoryConfig> alurConfigs = configRepository.findAlurEnabled(orgId);
        List<RegulatoryComplianceDto> results = new ArrayList<>();

        for (RegulatoryConfig config : alurConfigs) {
            results.add(checkAlurCompliance(config.getPropertyId(), orgId, year));
        }

        return results;
    }

    /**
     * Verifie si une nouvelle reservation violerait la limite ALUR.
     */
    public boolean wouldExceedAlurLimit(Long propertyId, Long orgId,
                                         LocalDate checkIn, LocalDate checkOut) {
        int year = checkIn.getYear();
        RegulatoryComplianceDto compliance = checkAlurCompliance(propertyId, orgId, year);

        int newDays = (int) ChronoUnit.DAYS.between(checkIn, checkOut);
        return (compliance.daysRented() + newDays) > compliance.maxDays();
    }
}
