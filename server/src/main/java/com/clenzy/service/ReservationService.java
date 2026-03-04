package com.clenzy.service;

import com.clenzy.config.SyncMetrics;
import com.clenzy.exception.CalendarConflictException;
import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
import io.micrometer.core.instrument.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.clenzy.tenant.TenantContext;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class ReservationService {

    private static final Logger log = LoggerFactory.getLogger(ReservationService.class);

    private final ReservationRepository reservationRepository;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;
    private final CalendarEngine calendarEngine;
    private final GuestService guestService;
    private final SyncMetrics syncMetrics;
    private final ServiceRequestRepository serviceRequestRepository;
    private final InterventionRepository interventionRepository;

    public ReservationService(ReservationRepository reservationRepository,
                              UserRepository userRepository,
                              TenantContext tenantContext,
                              CalendarEngine calendarEngine,
                              GuestService guestService,
                              SyncMetrics syncMetrics,
                              ServiceRequestRepository serviceRequestRepository,
                              InterventionRepository interventionRepository) {
        this.reservationRepository = reservationRepository;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
        this.calendarEngine = calendarEngine;
        this.guestService = guestService;
        this.syncMetrics = syncMetrics;
        this.serviceRequestRepository = serviceRequestRepository;
        this.interventionRepository = interventionRepository;
    }

    /**
     * Retourne toutes les reservations dans une plage de dates.
     * Admin/Manager : toutes.
     * Host : uniquement ses proprietes.
     */
    public List<Reservation> getReservations(String keycloakId, List<Long> propertyIds,
                                              LocalDate from, LocalDate to) {
        User user = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));

        boolean isAdminOrManager = user.getRole() != null && user.getRole().isPlatformStaff();

        if (propertyIds != null && !propertyIds.isEmpty()) {
            return reservationRepository.findByPropertyIdsAndDateRange(propertyIds, from, to, tenantContext.getRequiredOrganizationId());
        }

        if (isAdminOrManager) {
            return reservationRepository.findAllByDateRange(from, to, tenantContext.getRequiredOrganizationId());
        }

        // Host : ses propres proprietes
        return reservationRepository.findByOwnerKeycloakIdAndDateRange(keycloakId, from, to, tenantContext.getRequiredOrganizationId());
    }

    /**
     * Retourne les reservations d'une propriete specifique.
     */
    public List<Reservation> getByProperty(Long propertyId) {
        return reservationRepository.findByPropertyId(propertyId, tenantContext.getRequiredOrganizationId());
    }

    /**
     * Sauvegarde une reservation (creation ou mise a jour).
     * Valide que l'organizationId correspond au tenant courant.
     *
     * Pour les nouvelles reservations confirmees, reserve les jours
     * dans le calendrier via CalendarEngine (anti-double-booking).
     */
    @Transactional
    public Reservation save(Reservation reservation) {
        Timer.Sample sample = syncMetrics.startTimer();
        Long orgId = tenantContext.getRequiredOrganizationId();
        if (reservation.getOrganizationId() == null) {
            reservation.setOrganizationId(orgId);
        } else if (!reservation.getOrganizationId().equals(orgId)) {
            log.warn("Tentative de sauvegarde d'une reservation cross-tenant: reservation orgId={} vs caller orgId={}",
                    reservation.getOrganizationId(), orgId);
            throw new RuntimeException("Acces refuse : reservation hors de votre organisation");
        }

        boolean isNewConfirmed = reservation.getId() == null && "confirmed".equals(reservation.getStatus());

        try {
            // G6 : Creer/lier le Guest si un nom est fourni et pas encore lie
            if (reservation.getGuest() == null && reservation.getGuestName() != null
                    && !reservation.getGuestName().isBlank()) {
                com.clenzy.model.Guest guest = guestService.findOrCreateFromName(
                        reservation.getGuestName(), reservation.getSource(), orgId);
                if (guest != null) {
                    reservation.setGuest(guest);
                }
            }

            // Anti-double-booking : reserver les jours dans le calendrier AVANT la sauvegarde
            if (isNewConfirmed) {
                try {
                    calendarEngine.book(
                            reservation.getProperty().getId(),
                            reservation.getCheckIn(),
                            reservation.getCheckOut(),
                            null,
                            orgId,
                            reservation.getSource(),
                            null
                    );
                } catch (CalendarConflictException e) {
                    syncMetrics.incrementDoubleBookingPrevented();
                    throw e;
                }
            }

            // Sauvegarder la reservation
            Reservation saved = reservationRepository.save(reservation);

            // Lier la reservation aux CalendarDays
            if (isNewConfirmed) {
                calendarEngine.linkReservation(
                        saved.getProperty().getId(),
                        saved.getCheckIn(),
                        saved.getCheckOut(),
                        saved.getId(),
                        orgId
                );
            }

            return saved;
        } finally {
            if (isNewConfirmed) {
                String source = reservation.getSource() != null ? reservation.getSource() : "MANUAL";
                syncMetrics.recordReservationCreation(source, sample);
            }
        }
    }

    /**
     * Annule une reservation : met le statut a "cancelled" et libere
     * les jours dans le calendrier.
     *
     * @param reservationId id de la reservation a annuler
     * @return la reservation mise a jour
     */
    @Transactional
    public Reservation cancel(Long reservationId) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new RuntimeException("Reservation introuvable: " + reservationId));

        if (!reservation.getOrganizationId().equals(orgId)) {
            throw new RuntimeException("Acces refuse : reservation hors de votre organisation");
        }

        // Liberer les jours dans le calendrier
        calendarEngine.cancel(reservationId, orgId, null);

        // Mettre a jour le statut
        reservation.setStatus("cancelled");
        return reservationRepository.save(reservation);
    }

    /**
     * Verifie si une reservation avec ce UID existe deja pour cette propriete.
     */
    public boolean existsByExternalUid(String externalUid, Long propertyId) {
        if (externalUid == null || propertyId == null) return false;
        return reservationRepository.existsByExternalUidAndPropertyId(externalUid, propertyId);
    }

    // ── Auto-create cleaning intervention ────────────────────────────────

    /**
     * Cree automatiquement une ServiceRequest + Intervention de type CLEANING
     * liee a la reservation, planifiee au jour du checkout.
     */
    @Transactional
    public void createCleaningForReservation(Reservation reservation, String userSub) {
        // Re-load the reservation in the current session to avoid
        // LazyInitializationException on detached proxy (open-in-view=false)
        Long reservationId = reservation.getId();
        Reservation managedReservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new RuntimeException("Reservation introuvable: " + reservationId));
        Property property = managedReservation.getProperty();
        Long orgId = managedReservation.getOrganizationId();

        User requestor = userRepository.findByKeycloakId(userSub)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));

        LocalDateTime scheduledAt = managedReservation.getCheckOut()
                .atTime(parseCheckoutHour(managedReservation.getCheckOutTime()), 0);

        // 1. Create pre-approved ServiceRequest
        ServiceRequest sr = new ServiceRequest(
                "Menage - " + (managedReservation.getGuestName() != null ? managedReservation.getGuestName() : "Reservation"),
                ServiceType.CLEANING,
                scheduledAt,
                requestor,
                property
        );
        sr.setOrganizationId(orgId);
        sr.setStatus(RequestStatus.APPROVED);
        sr.setApprovedBy(userSub);
        sr.setApprovedAt(LocalDateTime.now());
        sr.setPriority(Priority.NORMAL);
        if (property.getCleaningBasePrice() != null) {
            sr.setEstimatedCost(property.getCleaningBasePrice());
        }
        sr = serviceRequestRepository.save(sr);

        // 2. Create Intervention linked to ServiceRequest
        Intervention intervention = new Intervention();
        intervention.setTitle("Menage - " + property.getName());
        intervention.setDescription("Menage post-depart"
                + (managedReservation.getGuestName() != null ? " pour " + managedReservation.getGuestName() : ""));
        intervention.setType("CLEANING");
        intervention.setStatus(InterventionStatus.PENDING);
        intervention.setPriority("NORMAL");
        intervention.setProperty(property);
        intervention.setRequestor(requestor);
        intervention.setServiceRequest(sr);
        intervention.setOrganizationId(orgId);
        intervention.setScheduledDate(scheduledAt);
        intervention.setStartTime(scheduledAt);
        intervention.setCreatedAt(LocalDateTime.now());
        if (property.getCleaningBasePrice() != null) {
            intervention.setEstimatedCost(property.getCleaningBasePrice());
        }
        if (property.getCleaningDurationMinutes() != null) {
            intervention.setEstimatedDurationHours(
                    (int) Math.ceil(property.getCleaningDurationMinutes() / 60.0));
        }
        intervention = interventionRepository.save(intervention);

        // 3. Link intervention to reservation
        managedReservation.setIntervention(intervention);
        reservationRepository.save(managedReservation);

        log.info("Auto-created cleaning intervention {} for reservation {} (property {})",
                intervention.getId(), managedReservation.getId(), property.getId());
    }

    private int parseCheckoutHour(String checkOutTime) {
        if (checkOutTime == null) return 11;
        try {
            return Integer.parseInt(checkOutTime.split(":")[0]);
        } catch (Exception e) {
            return 11;
        }
    }
}
