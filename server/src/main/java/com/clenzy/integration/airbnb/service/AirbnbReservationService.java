package com.clenzy.integration.airbnb.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.integration.airbnb.config.AirbnbConfig;
import com.clenzy.integration.airbnb.dto.AirbnbReservationDto;
import com.clenzy.integration.airbnb.model.AirbnbListingMapping;
import com.clenzy.integration.airbnb.repository.AirbnbListingMappingRepository;
import com.clenzy.integration.airbnb.repository.AirbnbWebhookEventRepository;
import com.clenzy.model.Intervention;
import com.clenzy.model.Property;
import com.clenzy.model.ServiceType;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.AuditLogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Service de gestion des reservations Airbnb.
 *
 * Ecoute le topic Kafka airbnb.reservations.sync et traite les evenements :
 * - reservation.created  : cree la reservation + auto-genere intervention menage
 * - reservation.updated  : met a jour la reservation + recalcule intervention
 * - reservation.cancelled: annule la reservation + annule l'intervention liee
 */
@Service
public class AirbnbReservationService {

    private static final Logger log = LoggerFactory.getLogger(AirbnbReservationService.class);

    private final AirbnbListingMappingRepository listingMappingRepository;
    private final InterventionRepository interventionRepository;
    private final PropertyRepository propertyRepository;
    private final AirbnbWebhookService webhookService;
    private final AuditLogService auditLogService;

    public AirbnbReservationService(AirbnbListingMappingRepository listingMappingRepository,
                                    InterventionRepository interventionRepository,
                                    PropertyRepository propertyRepository,
                                    AirbnbWebhookService webhookService,
                                    AuditLogService auditLogService) {
        this.listingMappingRepository = listingMappingRepository;
        this.interventionRepository = interventionRepository;
        this.propertyRepository = propertyRepository;
        this.webhookService = webhookService;
        this.auditLogService = auditLogService;
    }

    /**
     * Consumer Kafka pour les evenements de reservation Airbnb.
     */
    @KafkaListener(topics = KafkaConfig.TOPIC_AIRBNB_RESERVATIONS, groupId = "clenzy-reservations")
    public void handleReservationEvent(Map<String, Object> event) {
        String eventType = (String) event.get("event_type");
        String eventId = (String) event.get("event_id");

        log.info("Traitement evenement reservation Airbnb: {} ({})", eventType, eventId);

        try {
            Map<String, Object> data = (Map<String, Object>) event.get("data");
            if (data == null) {
                log.warn("Evenement reservation sans data: {}", eventId);
                webhookService.markAsFailed(eventId, "Missing data field");
                return;
            }

            switch (eventType) {
                case "reservation.created":
                    handleReservationCreated(data);
                    break;
                case "reservation.updated":
                    handleReservationUpdated(data);
                    break;
                case "reservation.cancelled":
                    handleReservationCancelled(data);
                    break;
                default:
                    log.warn("Type d'evenement reservation inconnu: {}", eventType);
            }

            webhookService.markAsProcessed(eventId);

        } catch (Exception e) {
            log.error("Erreur traitement reservation Airbnb {}: {}", eventId, e.getMessage());
            webhookService.markAsFailed(eventId, e.getMessage());
        }
    }

    /**
     * Traite la creation d'une reservation.
     * Auto-genere une intervention de menage si la propriete le permet.
     */
    @Transactional
    public void handleReservationCreated(Map<String, Object> data) {
        String airbnbListingId = (String) data.get("listing_id");
        String confirmationCode = (String) data.get("confirmation_code");

        log.info("Nouvelle reservation Airbnb pour listing {} (code: {})", airbnbListingId, confirmationCode);

        // Trouver le mapping propriete Clenzy <-> listing Airbnb
        Optional<AirbnbListingMapping> mappingOpt = listingMappingRepository.findByAirbnbListingId(airbnbListingId);
        if (mappingOpt.isEmpty()) {
            log.warn("Listing Airbnb {} non liee a une propriete Clenzy, evenement ignore", airbnbListingId);
            return;
        }

        AirbnbListingMapping mapping = mappingOpt.get();

        // Auto-generer l'intervention de menage si active
        if (mapping.isAutoCreateInterventions()) {
            createCleaningIntervention(mapping, data);
        }

        // Audit
        auditLogService.logSync("AirbnbReservation", confirmationCode,
                "Reservation Airbnb recue pour propriete " + mapping.getPropertyId());
    }

    /**
     * Traite la mise a jour d'une reservation (changement de dates, nombre de guests, etc.).
     */
    @Transactional
    public void handleReservationUpdated(Map<String, Object> data) {
        String confirmationCode = (String) data.get("confirmation_code");
        String airbnbListingId = (String) data.get("listing_id");

        log.info("Mise a jour reservation Airbnb: {} (listing: {})", confirmationCode, airbnbListingId);

        Optional<AirbnbListingMapping> mappingOpt = listingMappingRepository.findByAirbnbListingId(airbnbListingId);
        if (mappingOpt.isEmpty()) {
            return;
        }

        AirbnbListingMapping mapping = mappingOpt.get();

        // Resoudre l'orgId depuis la propriete (pas de TenantContext en contexte Kafka)
        Long orgId = resolveOrganizationId(mapping);
        if (orgId == null) {
            log.warn("Impossible de resoudre l'organizationId pour le mapping {}", mapping.getId());
            return;
        }

        // Rechercher l'intervention existante liee a cette reservation
        List<Intervention> interventions = interventionRepository
                .findByPropertyId(mapping.getPropertyId(), orgId);

        // Trouver l'intervention avec le meme code de confirmation dans les notes
        for (Intervention intervention : interventions) {
            if (intervention.getSpecialInstructions() != null
                    && intervention.getSpecialInstructions().contains(confirmationCode)) {

                // Mettre a jour les dates si elles ont change
                String checkOutStr = (String) data.get("check_out");
                if (checkOutStr != null) {
                    LocalDate newCheckOut = LocalDate.parse(checkOutStr, DateTimeFormatter.ISO_DATE);
                    intervention.setScheduledDate(LocalDateTime.of(newCheckOut, LocalTime.of(11, 0)));
                    intervention.setGuestCheckoutTime(LocalDateTime.of(newCheckOut, LocalTime.of(11, 0)));
                }

                String checkInStr = (String) data.get("check_in");
                if (checkInStr != null) {
                    LocalDate newCheckIn = LocalDate.parse(checkInStr, DateTimeFormatter.ISO_DATE);
                    intervention.setGuestCheckinTime(LocalDateTime.of(newCheckIn, LocalTime.of(15, 0)));
                }

                // Recalculer la duree estimee
                Object guestCountObj = data.get("guest_count");
                if (guestCountObj instanceof Number) {
                    int guestCount = ((Number) guestCountObj).intValue();
                    intervention.setEstimatedDurationHours(estimateCleaningDuration(mapping.getPropertyId(), guestCount).intValue());
                }

                interventionRepository.save(intervention);

                log.info("Intervention {} mise a jour suite a modification reservation {}",
                        intervention.getId(), confirmationCode);
                break;
            }
        }

        auditLogService.logSync("AirbnbReservation", confirmationCode,
                "Reservation Airbnb mise a jour pour propriete " + mapping.getPropertyId());
    }

    /**
     * Traite l'annulation d'une reservation.
     * Annule automatiquement l'intervention de menage liee.
     */
    @Transactional
    public void handleReservationCancelled(Map<String, Object> data) {
        String confirmationCode = (String) data.get("confirmation_code");
        String airbnbListingId = (String) data.get("listing_id");

        log.info("Annulation reservation Airbnb: {} (listing: {})", confirmationCode, airbnbListingId);

        Optional<AirbnbListingMapping> mappingOpt = listingMappingRepository.findByAirbnbListingId(airbnbListingId);
        if (mappingOpt.isEmpty()) {
            return;
        }

        AirbnbListingMapping mapping = mappingOpt.get();

        // Resoudre l'orgId depuis la propriete (pas de TenantContext en contexte Kafka)
        Long orgId = resolveOrganizationId(mapping);
        if (orgId == null) {
            log.warn("Impossible de resoudre l'organizationId pour le mapping {}", mapping.getId());
            return;
        }

        // Annuler les interventions liees
        List<Intervention> interventions = interventionRepository
                .findByPropertyId(mapping.getPropertyId(), orgId);

        for (Intervention intervention : interventions) {
            if (intervention.getSpecialInstructions() != null
                    && intervention.getSpecialInstructions().contains(confirmationCode)
                    && !"CANCELLED".equals(intervention.getStatus().name())) {

                intervention.setStatus(com.clenzy.model.InterventionStatus.CANCELLED);
                interventionRepository.save(intervention);

                log.info("Intervention {} annulee suite a annulation reservation {}",
                        intervention.getId(), confirmationCode);
            }
        }

        auditLogService.logSync("AirbnbReservation", confirmationCode,
                "Reservation Airbnb annulee — interventions liees annulees");
    }

    /**
     * Cree automatiquement une intervention de menage pour une reservation.
     */
    private void createCleaningIntervention(AirbnbListingMapping mapping, Map<String, Object> reservationData) {
        Property property = propertyRepository.findById(mapping.getPropertyId()).orElse(null);
        if (property == null) {
            log.warn("Propriete {} introuvable pour auto-creation intervention", mapping.getPropertyId());
            return;
        }

        String confirmationCode = (String) reservationData.get("confirmation_code");
        String guestName = (String) reservationData.get("guest_name");
        String checkInStr = (String) reservationData.get("check_in");
        String checkOutStr = (String) reservationData.get("check_out");
        Object guestCountObj = reservationData.get("guest_count");
        int guestCount = guestCountObj instanceof Number ? ((Number) guestCountObj).intValue() : 1;

        LocalDate checkIn = checkInStr != null ? LocalDate.parse(checkInStr, DateTimeFormatter.ISO_DATE) : LocalDate.now();
        LocalDate checkOut = checkOutStr != null ? LocalDate.parse(checkOutStr, DateTimeFormatter.ISO_DATE) : checkIn.plusDays(1);

        // Creer l'intervention de menage
        Intervention intervention = new Intervention();
        intervention.setOrganizationId(property.getOrganizationId());
        intervention.setTitle("Menage Airbnb — " + property.getName());
        intervention.setDescription("Menage apres depart du guest " + (guestName != null ? guestName : "")
                + " (reservation Airbnb " + confirmationCode + ")");
        intervention.setType(ServiceType.CLEANING.name());
        intervention.setStatus(com.clenzy.model.InterventionStatus.PENDING);
        intervention.setPriority(com.clenzy.model.Priority.HIGH.name());
        intervention.setProperty(property);
        intervention.setScheduledDate(LocalDateTime.of(checkOut, LocalTime.of(11, 0)));
        intervention.setGuestCheckoutTime(LocalDateTime.of(checkOut, LocalTime.of(11, 0)));
        intervention.setGuestCheckinTime(LocalDateTime.of(checkOut, LocalTime.of(15, 0))); // Prochain check-in
        intervention.setEstimatedDurationHours(estimateCleaningDuration(property.getId(), guestCount).intValue());
        intervention.setSpecialInstructions("[AIRBNB:" + confirmationCode + "] "
                + (guestCount > 0 ? guestCount + " guests" : "")
                + (property.getAccessInstructions() != null ? " | Acces: " + property.getAccessInstructions() : ""));
        intervention.setIsUrgent(false);
        intervention.setRequiresFollowUp(false);

        // Requestor = owner de la propriete
        if (property.getOwner() != null) {
            intervention.setRequestor(property.getOwner());
        }

        interventionRepository.save(intervention);

        log.info("Intervention de menage #{} auto-generee pour propriete {} (reservation {})",
                intervention.getId(), property.getName(), confirmationCode);
    }

    /**
     * Resout l'organizationId depuis un mapping Airbnb.
     * Utilise le mapping.organizationId s'il est defini, sinon charge la propriete.
     */
    private Long resolveOrganizationId(AirbnbListingMapping mapping) {
        if (mapping.getOrganizationId() != null) {
            return mapping.getOrganizationId();
        }
        return propertyRepository.findById(mapping.getPropertyId())
                .map(Property::getOrganizationId)
                .orElse(null);
    }

    /**
     * Estime la duree de menage en fonction de la taille du logement et du nombre de guests.
     */
    private BigDecimal estimateCleaningDuration(Long propertyId, int guestCount) {
        Property property = propertyRepository.findById(propertyId).orElse(null);
        if (property == null) {
            return new BigDecimal("2.0"); // Defaut : 2h
        }

        // Formule : base 1.5h + 0.5h par chambre + 0.25h par guest au-dela de 2
        double base = 1.5;
        if (property.getBedroomCount() != null) {
            base += property.getBedroomCount() * 0.5;
        }
        if (guestCount > 2) {
            base += (guestCount - 2) * 0.25;
        }

        // Surface : +0.5h si > 80m²
        if (property.getSquareMeters() != null && property.getSquareMeters() > 80) {
            base += 0.5;
        }

        return BigDecimal.valueOf(Math.ceil(base * 2) / 2); // Arrondi au 0.5h pres
    }
}
