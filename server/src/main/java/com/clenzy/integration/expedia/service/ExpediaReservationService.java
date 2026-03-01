package com.clenzy.integration.expedia.service;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.Priority;
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
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Service de gestion des reservations Expedia/VRBO.
 *
 * Ecoute le topic Kafka expedia.reservations.sync et traite les evenements :
 * - reservation.created  : cree la reservation + auto-genere intervention menage
 * - reservation.updated  : met a jour la reservation + recalcule intervention
 * - reservation.cancelled: annule la reservation + annule l'intervention liee
 *
 * Suit le meme pattern que AirbnbReservationService.
 */
@Service
public class ExpediaReservationService {

    private static final Logger log = LoggerFactory.getLogger(ExpediaReservationService.class);

    private static final String TOPIC_EXPEDIA_RESERVATIONS = "expedia.reservations.sync";

    private final ChannelMappingRepository channelMappingRepository;
    private final InterventionRepository interventionRepository;
    private final PropertyRepository propertyRepository;
    private final ExpediaWebhookService webhookService;
    private final AuditLogService auditLogService;

    public ExpediaReservationService(ChannelMappingRepository channelMappingRepository,
                                     InterventionRepository interventionRepository,
                                     PropertyRepository propertyRepository,
                                     ExpediaWebhookService webhookService,
                                     AuditLogService auditLogService) {
        this.channelMappingRepository = channelMappingRepository;
        this.interventionRepository = interventionRepository;
        this.propertyRepository = propertyRepository;
        this.webhookService = webhookService;
        this.auditLogService = auditLogService;
    }

    /**
     * Consumer Kafka pour les evenements de reservation Expedia/VRBO.
     */
    @KafkaListener(topics = TOPIC_EXPEDIA_RESERVATIONS, groupId = "clenzy-expedia-reservations")
    public void handleReservationEvent(Map<String, Object> event) {
        String eventType = (String) event.get("event_type");
        String eventId = (String) event.get("event_id");

        log.info("Traitement evenement reservation Expedia: {} ({})", eventType, eventId);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) event.get("data");
            if (data == null) {
                log.warn("Evenement reservation Expedia sans data: {}", eventId);
                webhookService.markAsFailed(eventId, "Missing data field");
                return;
            }

            switch (eventType) {
                case "reservation.created" -> handleReservationCreated(data);
                case "reservation.updated" -> handleReservationUpdated(data);
                case "reservation.cancelled" -> handleReservationCancelled(data);
                default -> log.warn("Type d'evenement reservation Expedia inconnu: {}", eventType);
            }

            webhookService.markAsProcessed(eventId);

        } catch (Exception e) {
            log.error("Erreur traitement reservation Expedia {}: {}", eventId, e.getMessage());
            webhookService.markAsFailed(eventId, e.getMessage());
        }
    }

    /**
     * Traite la creation d'une reservation.
     * Auto-genere une intervention de menage si la propriete le permet.
     */
    @Transactional
    public void handleReservationCreated(Map<String, Object> data) {
        String expediaPropertyId = (String) data.get("property_id");
        String reservationId = (String) data.get("reservation_id");
        Long orgId = parseOrgId(data);

        log.info("Nouvelle reservation Expedia pour propriete {} (reservation: {})",
                expediaPropertyId, reservationId);

        Optional<ChannelMapping> mappingOpt = findExpediaMapping(expediaPropertyId, orgId);
        if (mappingOpt.isEmpty()) {
            log.warn("Propriete Expedia {} non liee a une propriete Clenzy, evenement ignore",
                    expediaPropertyId);
            return;
        }

        ChannelMapping mapping = mappingOpt.get();
        Property property = propertyRepository.findById(mapping.getInternalId()).orElse(null);
        if (property == null) {
            log.warn("Propriete Clenzy {} introuvable pour mapping Expedia", mapping.getInternalId());
            return;
        }

        // Auto-generer l'intervention de menage
        createCleaningIntervention(property, mapping, data, reservationId);

        auditLogService.logSync("ExpediaReservation", reservationId,
                "Reservation Expedia/VRBO recue pour propriete " + mapping.getInternalId());
    }

    /**
     * Traite la mise a jour d'une reservation (changement de dates, nombre de guests, etc.).
     */
    @Transactional
    public void handleReservationUpdated(Map<String, Object> data) {
        String reservationId = (String) data.get("reservation_id");
        String expediaPropertyId = (String) data.get("property_id");
        Long orgId = parseOrgId(data);

        log.info("Mise a jour reservation Expedia: {} (propriete: {})",
                reservationId, expediaPropertyId);

        Optional<ChannelMapping> mappingOpt = findExpediaMapping(expediaPropertyId, orgId);
        if (mappingOpt.isEmpty()) {
            return;
        }

        ChannelMapping mapping = mappingOpt.get();
        Long resolvedOrgId = mapping.getOrganizationId();

        // Rechercher l'intervention existante liee a cette reservation
        List<Intervention> interventions = interventionRepository
                .findByPropertyId(mapping.getInternalId(), resolvedOrgId);

        for (Intervention intervention : interventions) {
            if (intervention.getSpecialInstructions() != null
                    && intervention.getSpecialInstructions().contains(reservationId)) {

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
                Object guestCountObj = data.get("total_guests");
                if (guestCountObj instanceof Number number) {
                    int guestCount = number.intValue();
                    intervention.setEstimatedDurationHours(
                            estimateCleaningDuration(mapping.getInternalId(), guestCount).intValue());
                }

                interventionRepository.save(intervention);

                log.info("Intervention {} mise a jour suite a modification reservation Expedia {}",
                        intervention.getId(), reservationId);
                break;
            }
        }

        auditLogService.logSync("ExpediaReservation", reservationId,
                "Reservation Expedia/VRBO mise a jour pour propriete " + mapping.getInternalId());
    }

    /**
     * Traite l'annulation d'une reservation.
     * Annule automatiquement l'intervention de menage liee.
     */
    @Transactional
    public void handleReservationCancelled(Map<String, Object> data) {
        String reservationId = (String) data.get("reservation_id");
        String expediaPropertyId = (String) data.get("property_id");
        Long orgId = parseOrgId(data);

        log.info("Annulation reservation Expedia: {} (propriete: {})",
                reservationId, expediaPropertyId);

        Optional<ChannelMapping> mappingOpt = findExpediaMapping(expediaPropertyId, orgId);
        if (mappingOpt.isEmpty()) {
            return;
        }

        ChannelMapping mapping = mappingOpt.get();
        Long resolvedOrgId = mapping.getOrganizationId();

        // Annuler les interventions liees
        List<Intervention> interventions = interventionRepository
                .findByPropertyId(mapping.getInternalId(), resolvedOrgId);

        for (Intervention intervention : interventions) {
            if (intervention.getSpecialInstructions() != null
                    && intervention.getSpecialInstructions().contains(reservationId)
                    && !"CANCELLED".equals(intervention.getStatus().name())) {

                intervention.setStatus(InterventionStatus.CANCELLED);
                interventionRepository.save(intervention);

                log.info("Intervention {} annulee suite a annulation reservation Expedia {}",
                        intervention.getId(), reservationId);
            }
        }

        auditLogService.logSync("ExpediaReservation", reservationId,
                "Reservation Expedia/VRBO annulee — interventions liees annulees");
    }

    // ================================================================
    // Helpers
    // ================================================================

    /**
     * Cree automatiquement une intervention de menage pour une reservation Expedia.
     */
    private void createCleaningIntervention(Property property, ChannelMapping mapping,
                                             Map<String, Object> reservationData,
                                             String reservationId) {
        String guestFirstName = (String) reservationData.get("guest_first_name");
        String guestLastName = (String) reservationData.get("guest_last_name");
        String guestName = buildGuestName(guestFirstName, guestLastName);

        String checkInStr = (String) reservationData.get("check_in");
        String checkOutStr = (String) reservationData.get("check_out");
        Object guestCountObj = reservationData.get("total_guests");
        int guestCount = guestCountObj instanceof Number number ? number.intValue() : 1;

        LocalDate checkIn = checkInStr != null
                ? LocalDate.parse(checkInStr, DateTimeFormatter.ISO_DATE) : LocalDate.now();
        LocalDate checkOut = checkOutStr != null
                ? LocalDate.parse(checkOutStr, DateTimeFormatter.ISO_DATE) : checkIn.plusDays(1);

        String source = (String) reservationData.getOrDefault("source", "VRBO");

        Intervention intervention = new Intervention();
        intervention.setOrganizationId(property.getOrganizationId());
        intervention.setTitle("Menage " + source + " — " + property.getName());
        intervention.setDescription("Menage apres depart du guest " + guestName
                + " (reservation " + source + " " + reservationId + ")");
        intervention.setType(ServiceType.CLEANING.name());
        intervention.setStatus(InterventionStatus.PENDING);
        intervention.setPriority(Priority.HIGH.name());
        intervention.setProperty(property);
        intervention.setScheduledDate(LocalDateTime.of(checkOut, LocalTime.of(11, 0)));
        intervention.setGuestCheckoutTime(LocalDateTime.of(checkOut, LocalTime.of(11, 0)));
        intervention.setGuestCheckinTime(LocalDateTime.of(checkOut, LocalTime.of(15, 0)));
        intervention.setEstimatedDurationHours(
                estimateCleaningDuration(property.getId(), guestCount).intValue());
        intervention.setSpecialInstructions("[" + source + ":" + reservationId + "] "
                + (guestCount > 0 ? guestCount + " guests" : "")
                + (property.getAccessInstructions() != null
                        ? " | Acces: " + property.getAccessInstructions() : ""));
        intervention.setIsUrgent(false);
        intervention.setRequiresFollowUp(false);

        if (property.getOwner() != null) {
            intervention.setRequestor(property.getOwner());
        }

        interventionRepository.save(intervention);

        log.info("Intervention de menage #{} auto-generee pour propriete {} (reservation {} {})",
                intervention.getId(), property.getName(), source, reservationId);
    }

    private Optional<ChannelMapping> findExpediaMapping(String expediaPropertyId, Long orgId) {
        if (expediaPropertyId == null || orgId == null) {
            return Optional.empty();
        }
        return channelMappingRepository.findByExternalIdAndChannel(
                expediaPropertyId, ChannelName.VRBO, orgId);
    }

    private Long parseOrgId(Map<String, Object> data) {
        Object orgIdObj = data.get("organization_id");
        if (orgIdObj instanceof Number number) {
            return number.longValue();
        }
        if (orgIdObj instanceof String str) {
            try {
                return Long.parseLong(str);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private String buildGuestName(String firstName, String lastName) {
        if (firstName == null && lastName == null) return "";
        return ((firstName != null ? firstName : "")
                + " " + (lastName != null ? lastName : "")).trim();
    }

    /**
     * Estime la duree de menage en fonction de la taille du logement et du nombre de guests.
     * Meme formule que AirbnbReservationService.
     */
    private BigDecimal estimateCleaningDuration(Long propertyId, int guestCount) {
        Property property = propertyRepository.findById(propertyId).orElse(null);
        if (property == null) {
            return new BigDecimal("2.0");
        }

        double base = 1.5;
        if (property.getBedroomCount() != null) {
            base += property.getBedroomCount() * 0.5;
        }
        if (guestCount > 2) {
            base += (guestCount - 2) * 0.25;
        }
        if (property.getSquareMeters() != null && property.getSquareMeters() > 80) {
            base += 0.5;
        }

        return BigDecimal.valueOf(Math.ceil(base * 2) / 2);
    }
}
