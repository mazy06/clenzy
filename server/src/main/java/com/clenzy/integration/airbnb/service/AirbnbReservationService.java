package com.clenzy.integration.airbnb.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.integration.airbnb.model.AirbnbListingMapping;
import com.clenzy.integration.airbnb.repository.AirbnbListingMappingRepository;
import com.clenzy.model.*;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ServiceRequestRepository;
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
 * - reservation.created  : cree la reservation + auto-genere demande de service menage
 * - reservation.updated  : met a jour la demande de service
 * - reservation.cancelled: annule la demande de service liee
 */
@Service
public class AirbnbReservationService {

    private static final Logger log = LoggerFactory.getLogger(AirbnbReservationService.class);

    private final AirbnbListingMappingRepository listingMappingRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final PropertyRepository propertyRepository;
    private final AirbnbWebhookService webhookService;
    private final AuditLogService auditLogService;

    public AirbnbReservationService(AirbnbListingMappingRepository listingMappingRepository,
                                    ServiceRequestRepository serviceRequestRepository,
                                    PropertyRepository propertyRepository,
                                    AirbnbWebhookService webhookService,
                                    AuditLogService auditLogService) {
        this.listingMappingRepository = listingMappingRepository;
        this.serviceRequestRepository = serviceRequestRepository;
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
     * Auto-genere une demande de service de menage si la propriete le permet.
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

        // Auto-generer la demande de service de menage si active
        if (mapping.isAutoCreateInterventions()) {
            createCleaningServiceRequest(mapping, data);
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

        // Rechercher la demande de service existante liee a cette reservation
        List<ServiceRequest> serviceRequests = serviceRequestRepository
                .findByPropertyId(mapping.getPropertyId(), orgId);

        // Trouver la SR avec le meme code de confirmation dans les notes
        for (ServiceRequest sr : serviceRequests) {
            if (sr.getSpecialInstructions() != null
                    && sr.getSpecialInstructions().contains(confirmationCode)) {

                // Mettre a jour les dates si elles ont change
                String checkOutStr = (String) data.get("check_out");
                if (checkOutStr != null) {
                    LocalDate newCheckOut = LocalDate.parse(checkOutStr, DateTimeFormatter.ISO_DATE);
                    sr.setDesiredDate(LocalDateTime.of(newCheckOut, LocalTime.of(11, 0)));
                    sr.setGuestCheckoutTime(LocalDateTime.of(newCheckOut, LocalTime.of(11, 0)));
                }

                String checkInStr = (String) data.get("check_in");
                if (checkInStr != null) {
                    LocalDate newCheckIn = LocalDate.parse(checkInStr, DateTimeFormatter.ISO_DATE);
                    sr.setGuestCheckinTime(LocalDateTime.of(newCheckIn, LocalTime.of(15, 0)));
                }

                // Recalculer la duree estimee depuis cleaningDurationMinutes de la propriete
                Property prop = propertyRepository.findById(mapping.getPropertyId()).orElse(null);
                if (prop != null && prop.getCleaningDurationMinutes() != null && prop.getCleaningDurationMinutes() > 0) {
                    sr.setEstimatedDurationHours((int) Math.ceil(prop.getCleaningDurationMinutes() / 60.0));
                }

                serviceRequestRepository.save(sr);

                log.info("Demande de service {} mise a jour suite a modification reservation {}",
                        sr.getId(), confirmationCode);
                break;
            }
        }

        auditLogService.logSync("AirbnbReservation", confirmationCode,
                "Reservation Airbnb mise a jour pour propriete " + mapping.getPropertyId());
    }

    /**
     * Traite l'annulation d'une reservation.
     * Annule automatiquement la demande de service de menage liee.
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

        // Annuler les demandes de service liees
        List<ServiceRequest> serviceRequests = serviceRequestRepository
                .findByPropertyId(mapping.getPropertyId(), orgId);

        for (ServiceRequest sr : serviceRequests) {
            if (sr.getSpecialInstructions() != null
                    && sr.getSpecialInstructions().contains(confirmationCode)
                    && sr.getStatus() != RequestStatus.CANCELLED) {

                sr.setStatus(RequestStatus.CANCELLED);
                serviceRequestRepository.save(sr);

                log.info("Demande de service {} annulee suite a annulation reservation {}",
                        sr.getId(), confirmationCode);
            }
        }

        auditLogService.logSync("AirbnbReservation", confirmationCode,
                "Reservation Airbnb annulee — demandes de service liees annulees");
    }

    /**
     * Cree automatiquement une demande de service de menage pour une reservation.
     * L'intervention sera creee uniquement apres le paiement.
     */
    private void createCleaningServiceRequest(AirbnbListingMapping mapping, Map<String, Object> reservationData) {
        Property property = propertyRepository.findById(mapping.getPropertyId()).orElse(null);
        if (property == null) {
            log.warn("Propriete {} introuvable pour auto-creation demande de service", mapping.getPropertyId());
            return;
        }

        String confirmationCode = (String) reservationData.get("confirmation_code");
        String guestName = (String) reservationData.get("guest_name");
        String checkOutStr = (String) reservationData.get("check_out");
        Object guestCountObj = reservationData.get("guest_count");
        int guestCount = guestCountObj instanceof Number ? ((Number) guestCountObj).intValue() : 1;

        LocalDate checkOut = checkOutStr != null ? LocalDate.parse(checkOutStr, DateTimeFormatter.ISO_DATE) : LocalDate.now().plusDays(1);
        LocalDateTime scheduledDate = LocalDateTime.of(checkOut, LocalTime.of(11, 0));

        // Creer la demande de service de menage
        ServiceRequest sr = new ServiceRequest(
                "Menage Airbnb — " + property.getName(),
                ServiceType.CLEANING,
                scheduledDate,
                property.getOwner(),
                property
        );
        sr.setOrganizationId(property.getOrganizationId());
        sr.setStatus(RequestStatus.PENDING);
        sr.setPriority(Priority.HIGH);
        sr.setDescription("Menage apres depart du guest " + (guestName != null ? guestName : "")
                + " (reservation Airbnb " + confirmationCode + ")");
        sr.setGuestCheckoutTime(scheduledDate);
        sr.setGuestCheckinTime(LocalDateTime.of(checkOut, LocalTime.of(15, 0)));

        // Duree depuis cleaningDurationMinutes de la propriete
        if (property.getCleaningDurationMinutes() != null && property.getCleaningDurationMinutes() > 0) {
            sr.setEstimatedDurationHours((int) Math.ceil(property.getCleaningDurationMinutes() / 60.0));
        } else {
            sr.setEstimatedDurationHours(2); // Fallback 2h
        }

        // Cout estime depuis le prix de base du menage
        if (property.getCleaningBasePrice() != null) {
            sr.setEstimatedCost(property.getCleaningBasePrice());
        }

        sr.setSpecialInstructions("[AIRBNB:" + confirmationCode + "] "
                + (guestCount > 0 ? guestCount + " guests" : "")
                + (property.getAccessInstructions() != null ? " | Acces: " + property.getAccessInstructions() : ""));

        serviceRequestRepository.save(sr);

        log.info("Demande de service menage #{} auto-generee pour propriete {} (reservation Airbnb {})",
                sr.getId(), property.getName(), confirmationCode);
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

}
