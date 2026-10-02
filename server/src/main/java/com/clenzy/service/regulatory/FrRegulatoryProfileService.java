package com.clenzy.service.regulatory;

import com.clenzy.dto.FrRegulatoryProfileDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.FrRentalUse;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyLicense;
import com.clenzy.model.RegulatoryConfig;
import com.clenzy.model.RegulatoryConfig.RegulatoryType;
import com.clenzy.repository.PropertyLicenseRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RegulatoryConfigRepository;
import com.clenzy.service.RegulatoryComplianceService;
import com.clenzy.service.property.TourismLicense;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * Profil reglementaire France d'un logement : usage, commune INSEE, et les obligations
 * qui en decoulent (plafond annuel de nuitees, numero d'enregistrement, fiche de police).
 *
 * <p>L'usage PILOTE le plafond : une residence principale active la regle
 * {@code ALUR_120_DAYS} (120 nuits, abaissable par la commune) ; tout autre usage la
 * desactive. Le logement est toujours charge BORNE A L'ORGANISATION.</p>
 */
@Service
public class FrRegulatoryProfileService {

    static final int LEGAL_MAX_NIGHTS = 120;

    private final PropertyRepository propertyRepository;
    private final PropertyLicenseRepository licenseRepository;
    private final RegulatoryConfigRepository configRepository;
    private final RegulatoryComplianceService complianceService;
    private final Clock clock;
    private final com.clenzy.service.TouristTaxService touristTaxService;
    private final FrCommuneResolver communeResolver;

    public FrRegulatoryProfileService(PropertyRepository propertyRepository,
                                      PropertyLicenseRepository licenseRepository,
                                      RegulatoryConfigRepository configRepository,
                                      RegulatoryComplianceService complianceService,
                                      com.clenzy.service.TouristTaxService touristTaxService,
                                      FrCommuneResolver communeResolver,
                                      Clock clock) {
        this.communeResolver = communeResolver;
        this.touristTaxService = touristTaxService;
        this.propertyRepository = propertyRepository;
        this.licenseRepository = licenseRepository;
        this.configRepository = configRepository;
        this.complianceService = complianceService;
        this.clock = clock;
    }

    /** Une ligne de la synthèse « Conformité France » du portefeuille. */
    public record OverviewRow(Long propertyId, String propertyName, FrRegulatoryProfileDto profile,
                              boolean touristTaxConfigured) {
    }

    /**
     * Synthèse de tous les logements situés en France de l'organisation : numéro, plafond,
     * fiche de police, barème de taxe de séjour. Lecture seule, bornée à l'organisation.
     */
    @Transactional
    public java.util.List<OverviewRow> overview(Long orgId) {
        return propertyRepository.findByOrganizationId(orgId).stream()
                .filter(FrCommuneResolver::isFrench)
                .peek(this::ensureCommune)
                .map(p -> new OverviewRow(p.getId(), p.getName(), toDto(p, orgId),
                        touristTaxService.resolveConfig(p.getId(), orgId).isPresent()))
                .toList();
    }

    @Transactional
    public FrRegulatoryProfileDto get(Long propertyId, Long orgId) {
        Property property = requireProperty(propertyId, orgId);
        ensureCommune(property);
        return toDto(property, orgId);
    }

    /**
     * Logements enregistres avant la deduction automatique : la commune est resolue depuis
     * l'adresse a la premiere lecture, puis conservee. Sans reponse de la BAN, on reessaiera.
     */
    private void ensureCommune(Property property) {
        if (property.getCommuneInseeCode() == null && FrCommuneResolver.isFrench(property)) {
            communeResolver.resolve(property).ifPresent(insee -> {
                property.setCommuneInseeCode(insee);
                propertyRepository.save(property);
            });
        }
    }

    @Transactional
    public FrRegulatoryProfileDto update(Long propertyId, Long orgId, FrRegulatoryProfileDto.Update request) {
        Property property = requireProperty(propertyId, orgId);
        ensureCommune(property);

        FrRentalUse use = request.rentalUse() == null || request.rentalUse().isBlank()
                ? null : FrRentalUse.valueOf(request.rentalUse());

        property.setFrRentalUse(use);
        propertyRepository.save(property);

        applyNightsCap(property, orgId, use, request.maxNightsPerYear());
        if (request.policeFormEnabled() != null) {
            RegulatoryConfig police = loadOrNew(property, orgId, RegulatoryType.POLICE_FORM);
            police.setIsEnabled(request.policeFormEnabled());
            configRepository.save(police);
        }
        return toDto(property, orgId);
    }

    /**
     * Residence principale → regle de plafond ACTIVE (maximum legal 120, la commune
     * peut l'abaisser : on accepte toute valeur 1..120). Autre usage → regle desactivee
     * (conservee pour l'historique, jamais supprimee).
     */
    private void applyNightsCap(Property property, Long orgId, FrRentalUse use, Integer requestedMax) {
        boolean capped = use == FrRentalUse.RESIDENCE_PRINCIPALE;
        var existing = configRepository.findByPropertyAndType(property.getId(), RegulatoryType.ALUR_120_DAYS, orgId);
        if (!capped && existing.isEmpty()) {
            return;
        }
        RegulatoryConfig cap = existing.orElseGet(() -> loadOrNew(property, orgId, RegulatoryType.ALUR_120_DAYS));
        cap.setIsEnabled(capped);
        if (requestedMax != null) {
            if (requestedMax < 1 || requestedMax > LEGAL_MAX_NIGHTS) {
                throw new IllegalArgumentException(
                        "Plafond annuel invalide : entre 1 et " + LEGAL_MAX_NIGHTS + " nuits.");
            }
            cap.setMaxDaysPerYear(requestedMax);
        } else if (cap.getMaxDaysPerYear() == null) {
            cap.setMaxDaysPerYear(LEGAL_MAX_NIGHTS);
        }
        cap.setCityCode(property.getCommuneInseeCode());
        configRepository.save(cap);
    }

    private RegulatoryConfig loadOrNew(Property property, Long orgId, RegulatoryType type) {
        return configRepository.findByPropertyAndType(property.getId(), type, orgId).orElseGet(() -> {
            RegulatoryConfig c = new RegulatoryConfig();
            c.setOrganizationId(orgId);
            c.setPropertyId(property.getId());
            c.setRegulatoryType(type);
            c.setCountryCode(property.getCountryCode() != null ? property.getCountryCode() : "FR");
            return c;
        });
    }

    private FrRegulatoryProfileDto toDto(Property property, Long orgId) {
        String number = licenseRepository.findFirstByPropertyIdAndOrganizationIdAndLicenseType(
                        property.getId(), orgId, PropertyLicense.LicenseType.TOURISM_REGISTRATION)
                .map(PropertyLicense::getLicenseNumber)
                .orElse(null);
        TourismLicense.Verdict verdict =
                TourismLicense.check(property.getCountryCode(), number, property.getCommuneInseeCode());

        var cap = configRepository.findByPropertyAndType(property.getId(), RegulatoryType.ALUR_120_DAYS, orgId);
        boolean capEnabled = cap.map(c -> Boolean.TRUE.equals(c.getIsEnabled())).orElse(false);
        int maxNights = cap.map(RegulatoryConfig::getMaxDaysPerYear).orElse(LEGAL_MAX_NIGHTS);
        int year = LocalDate.now(clock.withZone(zoneOf(property))).getYear();
        int rented = capEnabled ? complianceService.rentedNightsInYear(property.getId(), orgId, year) : 0;

        boolean policeEnabled = configRepository
                .findByPropertyAndType(property.getId(), RegulatoryType.POLICE_FORM, orgId)
                .map(c -> Boolean.TRUE.equals(c.getIsEnabled()))
                .orElse(false);

        return new FrRegulatoryProfileDto(
                property.getId(),
                property.getCountryCode(),
                property.getCommuneInseeCode(),
                property.getFrRentalUse() != null ? property.getFrRentalUse().name() : null,
                number,
                verdict.name(),
                isRegistrationRequired(property),
                capEnabled,
                maxNights,
                rented,
                Math.max(0, maxNights - rented),
                policeEnabled);
    }

    /**
     * Numero exige pour tout meuble de tourisme en France (generalisation par la loi du
     * 19 novembre 2024), sauf chambre d'hotes, qui releve d'une declaration distincte.
     */
    public static boolean isRegistrationRequired(Property property) {
        return property.getCountryCode() != null
                && "FR".equalsIgnoreCase(property.getCountryCode().trim())
                && property.getFrRentalUse() != FrRentalUse.CHAMBRE_HOTES;
    }

    private ZoneId zoneOf(Property property) {
        try {
            return property.getTimezone() != null ? ZoneId.of(property.getTimezone()) : clock.getZone();
        } catch (Exception e) {
            return clock.getZone();
        }
    }

    private Property requireProperty(Long propertyId, Long orgId) {
        return propertyRepository.findByIdWithOwner(propertyId, orgId)
                .orElseThrow(() -> new NotFoundException("Logement introuvable : " + propertyId));
    }
}
