package com.clenzy.integration.booking.service;

import com.clenzy.integration.booking.model.BookingConnection;
import com.clenzy.integration.booking.repository.BookingConnectionRepository;
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
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
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
 * Service de gestion des reservations Booking.com.
 *
 * Ecoute le topic Kafka booking.reservations et traite les evenements :
 * - reservation.created  : cree la reservation + auto-genere intervention menage
 * - reservation.modified : met a jour la reservation + recalcule intervention
 * - reservation.cancelled: annule la reservation + annule l'intervention liee
 *
 * orgId est resolu via ChannelMapping et BookingConnection
 * (pas de TenantContext en contexte Kafka).
 *
 * Desactive par defaut — activer via booking.sync.enabled=true.
 */
@Service
@ConditionalOnProperty(name = "booking.sync.enabled", havingValue = "true")
public class BookingReservationService {

    private static final Logger log = LoggerFactory.getLogger(BookingReservationService.class);

    private final ChannelMappingRepository channelMappingRepository;
    private final BookingConnectionRepository bookingConnectionRepository;
    private final InterventionRepository interventionRepository;
    private final PropertyRepository propertyRepository;
    private final AuditLogService auditLogService;

    public BookingReservationService(ChannelMappingRepository channelMappingRepository,
                                     BookingConnectionRepository bookingConnectionRepository,
                                     InterventionRepository interventionRepository,
                                     PropertyRepository propertyRepository,
                                     AuditLogService auditLogService) {
        this.channelMappingRepository = channelMappingRepository;
        this.bookingConnectionRepository = bookingConnectionRepository;
        this.interventionRepository = interventionRepository;
        this.propertyRepository = propertyRepository;
        this.auditLogService = auditLogService;
    }

    /**
     * Consumer Kafka pour les evenements de reservation Booking.com.
     */
    @KafkaListener(topics = "booking.reservations", groupId = "clenzy-booking-reservations")
    public void handleReservationEvent(Map<String, Object> event) {
        String eventType = (String) event.get("event_type");
        String hotelId = (String) event.get("hotel_id");
        String reservationId = (String) event.get("reservation_id");

        log.info("Traitement evenement reservation Booking.com: {} (reservation={}, hotel={})",
                eventType, reservationId, hotelId);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) event.get("data");
            if (data == null) {
                log.warn("Evenement reservation Booking.com sans data: reservation={}", reservationId);
                return;
            }

            switch (eventType) {
                case "reservation.created" -> handleReservationCreated(hotelId, data);
                case "reservation.modified" -> handleReservationModified(hotelId, data);
                case "reservation.cancelled" -> handleReservationCancelled(hotelId, data);
                default -> log.warn("Type d'evenement reservation Booking.com inconnu: {}", eventType);
            }

        } catch (Exception e) {
            log.error("Erreur traitement reservation Booking.com {}: {}", reservationId, e.getMessage(), e);
        }
    }

    /**
     * Traite la creation d'une reservation.
     * Auto-genere une intervention de menage si la propriete le permet.
     */
    @Transactional
    public void handleReservationCreated(String hotelId, Map<String, Object> data) {
        String roomId = (String) data.get("room_id");
        String reservationId = (String) data.get("reservation_id");

        log.info("Nouvelle reservation Booking.com pour hotel {} room {} (reservation: {})",
                hotelId, roomId, reservationId);

        Long orgId = resolveOrgId(hotelId);
        if (orgId == null) {
            log.warn("Hotel Booking.com {} non lie a une organisation Clenzy, evenement ignore", hotelId);
            return;
        }

        Optional<ChannelMapping> mappingOpt = channelMappingRepository
                .findByExternalIdAndChannel(roomId, ChannelName.BOOKING, orgId);

        if (mappingOpt.isEmpty()) {
            log.warn("Room Booking.com {} non liee a une propriete Clenzy, evenement ignore", roomId);
            return;
        }

        ChannelMapping mapping = mappingOpt.get();
        Long propertyId = mapping.getInternalId();

        // Auto-generer l'intervention de menage
        createCleaningIntervention(propertyId, orgId, data);

        auditLogService.logSync("BookingReservation", reservationId,
                "Reservation Booking.com recue pour propriete " + propertyId);
    }

    /**
     * Traite la modification d'une reservation (changement de dates, nombre de guests, etc.).
     */
    @Transactional
    public void handleReservationModified(String hotelId, Map<String, Object> data) {
        String reservationId = (String) data.get("reservation_id");
        String roomId = (String) data.get("room_id");

        log.info("Modification reservation Booking.com: {} (hotel: {}, room: {})",
                reservationId, hotelId, roomId);

        Long orgId = resolveOrgId(hotelId);
        if (orgId == null) return;

        Optional<ChannelMapping> mappingOpt = channelMappingRepository
                .findByExternalIdAndChannel(roomId, ChannelName.BOOKING, orgId);
        if (mappingOpt.isEmpty()) return;

        ChannelMapping mapping = mappingOpt.get();
        Long propertyId = mapping.getInternalId();

        // Rechercher l'intervention existante liee a cette reservation
        List<Intervention> interventions = interventionRepository.findByPropertyId(propertyId, orgId);

        for (Intervention intervention : interventions) {
            if (intervention.getSpecialInstructions() != null
                    && intervention.getSpecialInstructions().contains("[BOOKING:" + reservationId + "]")) {

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

                Object guestCountObj = data.get("number_of_guests");
                if (guestCountObj instanceof Number number) {
                    int guestCount = number.intValue();
                    intervention.setEstimatedDurationHours(
                            estimateCleaningDuration(propertyId, guestCount).intValue());
                }

                interventionRepository.save(intervention);
                log.info("Intervention {} mise a jour suite a modification reservation Booking.com {}",
                        intervention.getId(), reservationId);
                break;
            }
        }

        auditLogService.logSync("BookingReservation", reservationId,
                "Reservation Booking.com mise a jour pour propriete " + propertyId);
    }

    /**
     * Traite l'annulation d'une reservation.
     * Annule automatiquement l'intervention de menage liee.
     */
    @Transactional
    public void handleReservationCancelled(String hotelId, Map<String, Object> data) {
        String reservationId = (String) data.get("reservation_id");
        String roomId = (String) data.get("room_id");

        log.info("Annulation reservation Booking.com: {} (hotel: {}, room: {})",
                reservationId, hotelId, roomId);

        Long orgId = resolveOrgId(hotelId);
        if (orgId == null) return;

        Optional<ChannelMapping> mappingOpt = channelMappingRepository
                .findByExternalIdAndChannel(roomId, ChannelName.BOOKING, orgId);
        if (mappingOpt.isEmpty()) return;

        ChannelMapping mapping = mappingOpt.get();
        Long propertyId = mapping.getInternalId();

        // Annuler les interventions liees
        List<Intervention> interventions = interventionRepository.findByPropertyId(propertyId, orgId);

        for (Intervention intervention : interventions) {
            if (intervention.getSpecialInstructions() != null
                    && intervention.getSpecialInstructions().contains("[BOOKING:" + reservationId + "]")
                    && !InterventionStatus.CANCELLED.equals(intervention.getStatus())) {

                intervention.setStatus(InterventionStatus.CANCELLED);
                interventionRepository.save(intervention);

                log.info("Intervention {} annulee suite a annulation reservation Booking.com {}",
                        intervention.getId(), reservationId);
            }
        }

        auditLogService.logSync("BookingReservation", reservationId,
                "Reservation Booking.com annulee — interventions liees annulees");
    }

    // ================================================================
    // Helpers
    // ================================================================

    /**
     * Cree automatiquement une intervention de menage pour une reservation.
     */
    private void createCleaningIntervention(Long propertyId, Long orgId, Map<String, Object> reservationData) {
        Property property = propertyRepository.findById(propertyId).orElse(null);
        if (property == null) {
            log.warn("Propriete {} introuvable pour auto-creation intervention", propertyId);
            return;
        }

        String reservationId = (String) reservationData.get("reservation_id");
        String guestName = (String) reservationData.get("guest_name");
        String checkInStr = (String) reservationData.get("check_in");
        String checkOutStr = (String) reservationData.get("check_out");
        Object guestCountObj = reservationData.get("number_of_guests");
        int guestCount = guestCountObj instanceof Number number ? number.intValue() : 1;

        LocalDate checkIn = checkInStr != null
                ? LocalDate.parse(checkInStr, DateTimeFormatter.ISO_DATE)
                : LocalDate.now();
        LocalDate checkOut = checkOutStr != null
                ? LocalDate.parse(checkOutStr, DateTimeFormatter.ISO_DATE)
                : checkIn.plusDays(1);

        Intervention intervention = new Intervention();
        intervention.setOrganizationId(orgId);
        intervention.setTitle("Menage Booking.com — " + property.getName());
        intervention.setDescription("Menage apres depart du guest " + (guestName != null ? guestName : "")
                + " (reservation Booking.com " + reservationId + ")");
        intervention.setType(ServiceType.CLEANING.name());
        intervention.setStatus(InterventionStatus.PENDING);
        intervention.setPriority(Priority.HIGH.name());
        intervention.setProperty(property);
        intervention.setScheduledDate(LocalDateTime.of(checkOut, LocalTime.of(11, 0)));
        intervention.setGuestCheckoutTime(LocalDateTime.of(checkOut, LocalTime.of(11, 0)));
        intervention.setGuestCheckinTime(LocalDateTime.of(checkOut, LocalTime.of(15, 0)));
        intervention.setEstimatedDurationHours(estimateCleaningDuration(propertyId, guestCount).intValue());
        intervention.setSpecialInstructions("[BOOKING:" + reservationId + "] "
                + (guestCount > 0 ? guestCount + " guests" : "")
                + (property.getAccessInstructions() != null ? " | Acces: " + property.getAccessInstructions() : ""));
        intervention.setIsUrgent(false);
        intervention.setRequiresFollowUp(false);

        if (property.getOwner() != null) {
            intervention.setRequestor(property.getOwner());
        }

        interventionRepository.save(intervention);

        log.info("Intervention de menage #{} auto-generee pour propriete {} (reservation Booking.com {})",
                intervention.getId(), property.getName(), reservationId);
    }

    /**
     * Resout l'organizationId depuis un hotelId Booking.com.
     */
    private Long resolveOrgId(String hotelId) {
        return bookingConnectionRepository.findByHotelId(hotelId)
                .map(BookingConnection::getOrganizationId)
                .orElse(null);
    }

    /**
     * Estime la duree de menage en fonction de la taille du logement et du nombre de guests.
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
