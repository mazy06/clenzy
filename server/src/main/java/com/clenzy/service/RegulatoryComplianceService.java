package com.clenzy.service;

import com.clenzy.dto.RegulatoryComplianceDto;
import com.clenzy.dto.RegulatoryConfigRequest;
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

    /**
     * Upsert d'une config reglementaire a partir d'un payload client.
     *
     * <p>Cle naturelle : {@code (propertyId, regulatoryType, orgId)} — une config
     * par type reglementaire, par propriete et par organisation. On charge la
     * config existante de l'org (jamais par {@code id} fourni par le client :
     * fermeture du mass assignment / IDOR), sinon on en cree une nouvelle.
     * L'{@code organizationId} est impose par le {@code TenantContext}.</p>
     */
    @Transactional
    public RegulatoryConfig upsertConfig(RegulatoryConfigRequest request, Long orgId) {
        if (request.propertyId() == null || request.regulatoryType() == null) {
            throw new IllegalArgumentException("propertyId and regulatoryType are required");
        }

        RegulatoryConfig config = configRepository
            .findByPropertyAndType(request.propertyId(), request.regulatoryType(), orgId)
            .orElseGet(RegulatoryConfig::new);

        config.setOrganizationId(orgId);
        config.setPropertyId(request.propertyId());
        config.setRegulatoryType(request.regulatoryType());
        if (request.isEnabled() != null) {
            config.setIsEnabled(request.isEnabled());
        }
        config.setRegistrationNumber(request.registrationNumber());
        if (request.maxDaysPerYear() != null) {
            config.setMaxDaysPerYear(request.maxDaysPerYear());
        }
        if (request.countryCode() != null) {
            config.setCountryCode(request.countryCode());
        }
        config.setCityCode(request.cityCode());
        config.setNotes(request.notes());

        return configRepository.save(config);
    }

    /**
     * Calcule la conformite ALUR (120 jours) pour une propriete sur une annee.
     *
     * <p>Les nuits sont comptees sur {@code [1er janvier, 1er janvier suivant)} : un sejour a
     * cheval sur deux annees n'impute a chacune que ses propres nuits, et un depart le 1er
     * janvier compte bien la nuit du 31 decembre. Les annulations ne consomment rien.</p>
     */
    public RegulatoryComplianceDto checkAlurCompliance(Long propertyId, Long orgId, int year) {
        Optional<RegulatoryConfig> configOpt = configRepository.findByPropertyAndType(
            propertyId, RegulatoryType.ALUR_120_DAYS, orgId);

        int maxDays = configOpt.map(RegulatoryConfig::getMaxDaysPerYear).orElse(DEFAULT_MAX_DAYS);
        String regNumber = configOpt.map(RegulatoryConfig::getRegistrationNumber).orElse(null);

        int totalDays = rentedNightsInYear(propertyId, orgId, year);
        int remaining = maxDays - totalDays;
        boolean compliant = totalDays <= maxDays;

        String alert = null;
        if (!compliant) {
            alert = "DEPASSEMENT: " + totalDays + "/" + maxDays + " jours loues en " + year;
        } else if (totalDays >= WARNING_THRESHOLD) {
            alert = "ATTENTION: " + totalDays + "/" + maxDays + " jours loues, proche du seuil";
        }

        // Nom resolu DANS l'organisation : un propertyId d'une autre org ne fuit rien.
        String propertyName = propertyRepository.findNameByIdAndOrgId(propertyId, orgId).orElse("Unknown");

        return new RegulatoryComplianceDto(
            propertyId, propertyName, year, totalDays, maxDays,
            Math.max(0, remaining), compliant, regNumber, alert
        );
    }

    /** Nuits louees (hors annulations) d'une propriete sur une annee civile. */
    public int rentedNightsInYear(Long propertyId, Long orgId, int year) {
        LocalDate from = LocalDate.of(year, 1, 1);
        LocalDate toExclusive = from.plusYears(1);
        int total = 0;
        for (Reservation r : reservationRepository.findRentedStaysOverlapping(
                propertyId, orgId, from, toExclusive)) {
            total += overlapNights(r.getCheckIn(), r.getCheckOut(), from, toExclusive);
        }
        return total;
    }

    /** Nuits de {@code [checkIn, checkOut)} comprises dans {@code [from, toExclusive)}. */
    public static int overlapNights(LocalDate checkIn, LocalDate checkOut, LocalDate from, LocalDate toExclusive) {
        if (checkIn == null || checkOut == null) {
            return 0;
        }
        LocalDate start = checkIn.isBefore(from) ? from : checkIn;
        LocalDate end = checkOut.isAfter(toExclusive) ? toExclusive : checkOut;
        return end.isAfter(start) ? (int) ChronoUnit.DAYS.between(start, end) : 0;
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
     *
     * <p>Chaque annee civile touchee par le sejour est verifiee avec ses seules nuits : un
     * sejour du 28 decembre au 4 janvier pese 4 nuits sur l'annee N et 3 sur N+1.</p>
     */
    public boolean wouldExceedAlurLimit(Long propertyId, Long orgId,
                                         LocalDate checkIn, LocalDate checkOut) {
        if (checkIn == null || checkOut == null || !checkOut.isAfter(checkIn)) {
            return false;
        }
        int maxDays = configRepository.findByPropertyAndType(propertyId, RegulatoryType.ALUR_120_DAYS, orgId)
            .map(RegulatoryConfig::getMaxDaysPerYear).orElse(DEFAULT_MAX_DAYS);
        for (int year = checkIn.getYear(); year <= checkOut.minusDays(1).getYear(); year++) {
            LocalDate from = LocalDate.of(year, 1, 1);
            int newNights = overlapNights(checkIn, checkOut, from, from.plusYears(1));
            if (rentedNightsInYear(propertyId, orgId, year) + newNights > maxDays) {
                return true;
            }
        }
        return false;
    }
}
