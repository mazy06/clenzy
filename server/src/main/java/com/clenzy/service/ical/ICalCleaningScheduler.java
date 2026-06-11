package com.clenzy.service.ical;

import com.clenzy.dto.ICalImportDto.ICalEventPreview;
import com.clenzy.model.Priority;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyType;
import com.clenzy.model.RequestStatus;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.ServiceType;
import com.clenzy.model.User;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.service.PricingConfigService;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Map;

/**
 * Creation (ou relance) des demandes de menage liees aux reservations importees
 * par iCal. L'intervention sera creee uniquement apres le paiement.
 * L'auto-assignation est differee apres le commit de l'import
 * ({@code session.srsToAutoAssign}).
 */
@Component
public class ICalCleaningScheduler {

    private static final Logger log = LoggerFactory.getLogger(ICalCleaningScheduler.class);

    private final ServiceRequestRepository serviceRequestRepository;
    private final PricingConfigService pricingConfigService;
    private final TenantContext tenantContext;

    public ICalCleaningScheduler(ServiceRequestRepository serviceRequestRepository,
                                 PricingConfigService pricingConfigService,
                                 TenantContext tenantContext) {
        this.serviceRequestRepository = serviceRequestRepository;
        this.pricingConfigService = pricingConfigService;
        this.tenantContext = tenantContext;
    }

    /**
     * Cree ou reactive la demande de menage (si auto-create active).
     * IMPORTANT: verifie meme si la reservation est un doublon, car l'utilisateur
     * peut activer l'auto-menage apres un premier import sans cette option,
     * ou ajouter une equipe apres que le scheduler ait epuise ses retries.
     */
    public void maybeCreateOrRetryCleaningRequest(ICalImportSession session, ICalEventPreview event, Long reservationId) {
        if (!session.request.isAutoCreateInterventions() || reservationId == null) {
            return;
        }
        ServiceRequest existingSR = findExistingCleaningRequest(session, event);
        if (existingSR == null) {
            // Aucune SR : on la cree puis on planifie l'auto-assignation post-commit
            // (cf. srsToAutoAssign) pour eviter qu'une exception interne ne marque
            // la transaction rollback-only.
            ServiceRequest created = createCleaningServiceRequest(
                    session.property, event, session.request.getSourceName(), reservationId);
            if (created != null) {
                session.srsToAutoAssign.add(created.getId());
            }
            return;
        }
        if (existingSR.getStatus() == RequestStatus.PENDING && existingSR.getAssignedToId() == null) {
            // SR existe mais coincee en PENDING non-assignee. Cause typique :
            // l'utilisateur a ajoute une equipe / config apres l'import initial,
            // et le scheduler a deja epuise ses 10 retries (autoAssignStatus='exhausted').
            // On reset le compteur et on retente apres commit.
            existingSR.setAutoAssignRetryCount(0);
            existingSR.setAutoAssignStatus("searching");
            existingSR.setLastAutoAssignAttempt(null);
            ServiceRequest reset = serviceRequestRepository.save(existingSR);
            session.srsToAutoAssign.add(reset.getId());
        }
    }

    private ServiceRequest findExistingCleaningRequest(ICalImportSession session, ICalEventPreview event) {
        if (event.getUid() == null) {
            return null;
        }
        String marker = "[ICAL:" + event.getUid() + "]";
        return serviceRequestRepository.findByPropertyId(session.property.getId(), session.orgId).stream()
                .filter(sr -> sr.getSpecialInstructions() != null
                        && sr.getSpecialInstructions().contains(marker))
                .findFirst()
                .orElse(null);
    }

    /**
     * Cree automatiquement une demande de service de menage pour une reservation importee.
     * L'intervention sera creee uniquement apres le paiement.
     * Retourne la SR persistee (ou null si la creation a echoue).
     */
    private ServiceRequest createCleaningServiceRequest(Property property, ICalEventPreview event,
                                                         String sourceName, Long reservationId) {
        User owner = property.getOwner();

        // Date du checkout avec l'heure par defaut de la propriete
        LocalDate checkOut = event.getDtEnd() != null ? event.getDtEnd() : event.getDtStart().plusDays(1);
        String defaultCheckOutTime = property.getDefaultCheckOutTime() != null
                ? property.getDefaultCheckOutTime() : ICalImportDefaults.DEFAULT_CHECK_OUT_TIME;
        LocalTime checkOutTime = LocalTime.parse(defaultCheckOutTime);
        LocalDateTime scheduledDate = LocalDateTime.of(checkOut, checkOutTime);
        // Fenetre de menage bornee par le check-in du guest suivant : respecter l'heure
        // de check-in de la propriete (T-BP-09), alignee sur buildReservation.
        String defaultCheckInTime = property.getDefaultCheckInTime() != null
                ? property.getDefaultCheckInTime() : ICalImportDefaults.DEFAULT_CHECK_IN_TIME;
        LocalTime checkInTime = LocalTime.parse(defaultCheckInTime);

        // Duree estimee : utiliser cleaningDurationMinutes de la propriete (calcule par PropertyService)
        // Convertir minutes -> heures arrondi au superieur (ex: 150 min -> 3h)
        int estimatedDuration;
        if (property.getCleaningDurationMinutes() != null && property.getCleaningDurationMinutes() > 0) {
            estimatedDuration = (int) Math.ceil(property.getCleaningDurationMinutes() / 60.0);
        } else {
            // Fallback si le champ n'est pas renseigne
            estimatedDuration = 2;
            log.debug("Property {} n'a pas de cleaningDurationMinutes, fallback a {}h", property.getName(), estimatedDuration);
        }
        BigDecimal estimatedCost = estimateCleaningCost(property);

        // Instructions speciales avec UID pour dedoublonnage
        StringBuilder instructions = new StringBuilder();
        if (event.getUid() != null) {
            instructions.append("[ICAL:").append(event.getUid()).append("] ");
        }
        instructions.append("[SOURCE:").append(sourceName).append("] ");
        if (event.getGuestName() != null) {
            instructions.append("Guest: ").append(event.getGuestName()).append(" ");
        }
        if (event.getConfirmationCode() != null) {
            instructions.append("Code: ").append(event.getConfirmationCode()).append(" ");
        }
        if (event.getNights() > 0) {
            instructions.append(event.getNights()).append(" nuits ");
        }
        if (property.getAccessInstructions() != null) {
            instructions.append("| Acces: ").append(property.getAccessInstructions());
        }
        String specialInstructions = instructions.toString().trim();

        // ─── 1. Creer la ServiceRequest associee ───
        String srTitle = "Menage " + sourceName + " — " + property.getName();
        ServiceType cleaningType = property.resolveCleaningServiceType();
        ServiceRequest serviceRequest = new ServiceRequest(
                srTitle,
                cleaningType,
                scheduledDate,
                owner != null ? owner : property.getOwner(),
                property
        );
        serviceRequest.setPriority(Priority.HIGH);
        serviceRequest.setStatus(RequestStatus.PENDING);
        serviceRequest.setEstimatedDurationHours(estimatedDuration);
        serviceRequest.setEstimatedCost(estimatedCost);
        serviceRequest.setGuestCheckoutTime(scheduledDate);
        serviceRequest.setGuestCheckinTime(LocalDateTime.of(checkOut, checkInTime));
        serviceRequest.setSpecialInstructions(specialInstructions);
        serviceRequest.setDescription("Import iCal " + sourceName
                + (event.getGuestName() != null ? " — Guest: " + event.getGuestName() : "")
                + (event.getConfirmationCode() != null ? " (" + event.getConfirmationCode() + ")" : ""));
        serviceRequest.setReservationId(reservationId);
        serviceRequest.setOrganizationId(tenantContext.getOrganizationId());

        serviceRequest = serviceRequestRepository.save(serviceRequest);

        log.info("Demande de service menage #{} creee pour reservation #{} propriete {} ({}, {})",
                serviceRequest.getId(), reservationId, property.getName(), sourceName,
                event.getGuestName() != null ? event.getGuestName() : "N/A");
        return serviceRequest;
    }

    /**
     * Estime le cout de menage en euros via PricingConfigService.
     * Formule : basePrix(forfait) x typeCoeff x surfaceCoeff x guestCoeff
     * Prix minimum et arrondi au multiple de 5 EUR.
     */
    private BigDecimal estimateCleaningCost(Property property) {
        // Prix de base depuis la config dynamique, selon le forfait du owner
        Map<String, Integer> basePrices = pricingConfigService.getBasePrices();
        String forfait = (property.getOwner() != null && property.getOwner().getForfait() != null)
                ? property.getOwner().getForfait().toLowerCase() : "confort";
        int basePrice = basePrices.getOrDefault(forfait, basePrices.getOrDefault("confort", 75));

        // Coefficient type de propriete (mapper PropertyType enum -> cle PricingConfig)
        Map<String, Double> typeCoeffs = pricingConfigService.getPropertyTypeCoeffs();
        String propertyTypeKey = mapPropertyTypeToKey(property.getType());
        double typeCoeff = typeCoeffs.getOrDefault(propertyTypeKey, 1.0);

        // Coefficient surface (via tiers dynamiques)
        double surfaceCoeff = property.getSquareMeters() != null
                ? pricingConfigService.getSurfaceCoeff(property.getSquareMeters()) : 1.0;

        // Coefficient capacite guests
        Map<String, Double> guestCoeffs = pricingConfigService.getGuestCapacityCoeffs();
        int guests = property.getMaxGuests() != null ? property.getMaxGuests() : 2;
        String guestKey = guests <= 2 ? "1-2" : guests <= 4 ? "3-4" : guests <= 6 ? "5-6" : "7+";
        double guestCoeff = guestCoeffs.getOrDefault(guestKey, 1.0);

        double cost = basePrice * typeCoeff * surfaceCoeff * guestCoeff;

        // Prix minimum
        int minPrice = pricingConfigService.getMinPrice();
        cost = Math.max(cost, minPrice);

        // Arrondir au multiple de 5 EUR le plus proche
        cost = Math.round(cost / 5.0) * 5.0;

        log.debug("Estimation cout menage pour {} : base={} x type({})={} x surface={} x guests({})={} = {}",
                property.getName(), basePrice, propertyTypeKey, typeCoeff, surfaceCoeff, guestKey, guestCoeff, cost);

        return BigDecimal.valueOf(cost);
    }

    /**
     * Mappe un PropertyType enum vers la cle utilisee dans PricingConfig.
     */
    private String mapPropertyTypeToKey(PropertyType type) {
        if (type == null) return "autre";
        switch (type) {
            case APARTMENT: return "appartement";
            case HOUSE: return "maison";
            case STUDIO: return "studio";
            case VILLA: return "villa";
            case LOFT: return "loft";
            case GUEST_ROOM: return "chambre-hote";
            case COTTAGE: return "gite";
            case CHALET: return "chalet";
            case BOAT: return "bateau";
            default: return "autre";
        }
    }
}
