package com.clenzy.service;

import com.clenzy.config.SyncMetrics;
import com.clenzy.exception.CalendarConflictException;
import com.clenzy.model.*;
import com.clenzy.repository.MinNightsOverrideRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.SmartLockDeviceRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.messaging.AutomationEvaluationService;
import com.clenzy.service.smartlock.SmartLockAccessCodeService;
import io.micrometer.core.instrument.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.clenzy.tenant.TenantContext;
import java.math.BigDecimal;
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
    private final NotificationService notificationService;
    private final MinNightsOverrideRepository minNightsOverrideRepository;
    private final AutomationEvaluationService automationEvaluationService;
    private final SmartLockDeviceRepository smartLockDeviceRepository;
    private final SmartLockAccessCodeService smartLockAccessCodeService;

    public ReservationService(ReservationRepository reservationRepository,
                              UserRepository userRepository,
                              TenantContext tenantContext,
                              CalendarEngine calendarEngine,
                              GuestService guestService,
                              SyncMetrics syncMetrics,
                              ServiceRequestRepository serviceRequestRepository,
                              NotificationService notificationService,
                              MinNightsOverrideRepository minNightsOverrideRepository,
                              AutomationEvaluationService automationEvaluationService,
                              SmartLockDeviceRepository smartLockDeviceRepository,
                              // @Lazy : casse un eventuel cycle (codes -> messaging -> ...).
                              @Lazy SmartLockAccessCodeService smartLockAccessCodeService) {
        this.reservationRepository = reservationRepository;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
        this.calendarEngine = calendarEngine;
        this.guestService = guestService;
        this.syncMetrics = syncMetrics;
        this.serviceRequestRepository = serviceRequestRepository;
        this.notificationService = notificationService;
        this.minNightsOverrideRepository = minNightsOverrideRepository;
        this.automationEvaluationService = automationEvaluationService;
        this.smartLockDeviceRepository = smartLockDeviceRepository;
        this.smartLockAccessCodeService = smartLockAccessCodeService;
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

            // Validation min-nights (override par date si present, sinon defaut propriete)
            if (isNewConfirmed) {
                validateMinimumNights(reservation, orgId);
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

                // Mettre a jour les stats du guest (totalStays, totalSpent)
                if (saved.getGuest() != null) {
                    guestService.recordStay(saved.getGuest().getId(), saved.getTotalPrice());
                }
            }

            // Notification pour nouvelle reservation
            if (isNewConfirmed) {
                notifyReservationCreated(saved);
                seedAutomations(saved, orgId);
                generateAccessCodes(saved, orgId);
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
        Reservation cancelled = reservationRepository.save(reservation);

        // Revoque les codes d'acces serrure de la reservation (best-effort, non bloquant).
        revokeAccessCodes(reservationId);

        notifyReservationCancelled(cancelled);

        return cancelled;
    }

    /**
     * Genere un code d'acces sur chaque serrure ACTIVE du logement pour la reservation.
     * NON BLOQUANT : une panne Tuya ne doit pas faire echouer la creation de la
     * reservation (meme contrat que {@code seedAutomations}).
     */
    private void generateAccessCodes(Reservation reservation, Long orgId) {
        try {
            Long propertyId = reservation.getProperty().getId();
            List<SmartLockDevice> locks = smartLockDeviceRepository
                    .findByPropertyIdAndStatus(propertyId, SmartLockDevice.DeviceStatus.ACTIVE);
            for (SmartLockDevice lock : locks) {
                smartLockAccessCodeService.generateForReservation(
                        reservation, lock, SmartLockAccessCode.CodeSource.AUTO_RESERVATION);
            }
        } catch (Exception e) {
            log.warn("Generation des codes d'acces serrure echouee pour reservation={}: {}",
                    reservation.getId(), e.getMessage());
        }
    }

    /** Revoque les codes d'acces serrure de la reservation (annulation). NON BLOQUANT. */
    private void revokeAccessCodes(Long reservationId) {
        try {
            smartLockAccessCodeService.revokeForReservation(reservationId, "system");
        } catch (Exception e) {
            log.warn("Revocation des codes d'acces serrure echouee pour reservation={}: {}",
                    reservationId, e.getMessage());
        }
    }

    /**
     * Verifie si une reservation avec ce UID existe deja pour cette propriete.
     */
    public boolean existsByExternalUid(String externalUid, Long propertyId) {
        if (externalUid == null || propertyId == null) return false;
        return reservationRepository.existsByExternalUidAndPropertyId(externalUid, propertyId);
    }

    // ── Auto-create cleaning service request ─────────────────────────────

    /**
     * Cree automatiquement une ServiceRequest de type CLEANING en statut PENDING
     * liee a la propriete de la reservation, planifiee au jour du checkout.
     * L'intervention sera creee par le workflow de validation de la demande de service.
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

        // Create ServiceRequest in PENDING status (goes through the full workflow)
        ServiceRequest sr = new ServiceRequest(
                "Menage - " + (managedReservation.getGuestName() != null ? managedReservation.getGuestName() : "Reservation"),
                property.resolveCleaningServiceType(),
                scheduledAt,
                requestor,
                property
        );
        sr.setOrganizationId(orgId);
        sr.setStatus(RequestStatus.PENDING);
        sr.setPriority(Priority.NORMAL);

        // Use reservation cleaning fee if set, otherwise fallback to property base price
        BigDecimal estimatedCost = managedReservation.getCleaningFee();
        if (estimatedCost == null && property.getCleaningBasePrice() != null) {
            estimatedCost = property.getCleaningBasePrice();
        }
        if (estimatedCost != null) {
            sr.setEstimatedCost(estimatedCost);
        }
        if (property.getCleaningDurationMinutes() != null) {
            sr.setEstimatedDurationHours(
                    (int) Math.ceil(property.getCleaningDurationMinutes() / 60.0));
        }

        sr = serviceRequestRepository.save(sr);

        log.info("Auto-created cleaning service request {} (PENDING) for reservation {} (property {})",
                sr.getId(), managedReservation.getId(), property.getId());
    }

    private int parseCheckoutHour(String checkOutTime) {
        if (checkOutTime == null) return 11;
        try {
            return Integer.parseInt(checkOutTime.split(":")[0]);
        } catch (Exception e) {
            return 11;
        }
    }

    // ── Automatisations ──────────────────────────────────────────────────

    /**
     * Amorce les regles d'automatisation pour une reservation nouvellement creee.
     * L'echec ne doit jamais empecher la creation de la reservation.
     */
    private void seedAutomations(Reservation reservation, Long orgId) {
        try {
            automationEvaluationService.onReservationCreated(reservation, orgId);
        } catch (Exception e) {
            log.warn("Erreur amorcage automatisations pour reservation {}: {}",
                    reservation.getId(), e.getMessage());
        }
    }

    // ── Notification helpers ─────────────────────────────────────────────

    private void notifyReservationCreated(Reservation reservation) {
        try {
            String actionUrl = "/planning";
            String propertyName = reservation.getProperty() != null ? reservation.getProperty().getName() : "";
            String guestName = reservation.getGuestName() != null ? reservation.getGuestName() : "Inconnu";
            String dates = reservation.getCheckIn() + " → " + reservation.getCheckOut();

            String title = "Nouvelle reservation";
            String message = "Reservation de " + guestName + " sur " + propertyName + " (" + dates + ").";

            // Notifier le proprietaire
            if (reservation.getProperty() != null && reservation.getProperty().getOwner() != null) {
                notificationService.notify(
                        reservation.getProperty().getOwner().getKeycloakId(),
                        NotificationKey.RESERVATION_CREATED, title, message, actionUrl);
            }

            // Notifier admins/managers
            notificationService.notifyAdminsAndManagers(
                    NotificationKey.RESERVATION_CREATED, title, message, actionUrl);
        } catch (Exception e) {
            log.warn("Notification error reservationCreated: {}", e.getMessage());
        }
    }

    public void notifyReservationUpdated(Reservation reservation) {
        try {
            String actionUrl = "/planning";
            String propertyName = reservation.getProperty() != null ? reservation.getProperty().getName() : "";
            String guestName = reservation.getGuestName() != null ? reservation.getGuestName() : "Inconnu";

            String title = "Reservation modifiee";
            String message = "La reservation de " + guestName + " sur " + propertyName + " a ete modifiee.";

            if (reservation.getProperty() != null && reservation.getProperty().getOwner() != null) {
                notificationService.notify(
                        reservation.getProperty().getOwner().getKeycloakId(),
                        NotificationKey.RESERVATION_UPDATED, title, message, actionUrl);
            }

            notificationService.notifyAdminsAndManagers(
                    NotificationKey.RESERVATION_UPDATED, title, message, actionUrl);
        } catch (Exception e) {
            log.warn("Notification error reservationUpdated: {}", e.getMessage());
        }
    }

    private void notifyReservationCancelled(Reservation reservation) {
        try {
            String actionUrl = "/planning";
            String propertyName = reservation.getProperty() != null ? reservation.getProperty().getName() : "";
            String guestName = reservation.getGuestName() != null ? reservation.getGuestName() : "Inconnu";

            String title = "Reservation annulee";
            String message = "La reservation de " + guestName + " sur " + propertyName + " a ete annulee.";

            if (reservation.getProperty() != null && reservation.getProperty().getOwner() != null) {
                notificationService.notify(
                        reservation.getProperty().getOwner().getKeycloakId(),
                        NotificationKey.RESERVATION_CANCELLED, title, message, actionUrl);
            }

            notificationService.notifyAdminsAndManagers(
                    NotificationKey.RESERVATION_CANCELLED, title, message, actionUrl);
        } catch (Exception e) {
            log.warn("Notification error reservationCancelled: {}", e.getMessage());
        }
    }

    /**
     * Verifie que la duree de la reservation respecte le minimum de nuits.
     *
     * Resolution (priorite haute → basse) :
     *   1. Override min-nights sur la date de check-in (MinNightsOverride)
     *   2. Defaut de la propriete (property.minimumNights)
     *   3. Pas de contrainte si aucun des deux n'est defini
     *
     * On verifie sur la date de CHECK-IN parce que c'est la regle metier la
     * plus courante : "minimum 4 nuits si on debute un sejour ce jour-la".
     * On pourrait aussi verifier sur toutes les nuits couvertes mais ca
     * rendrait les overrides plus difficiles a raisonner.
     */
    private void validateMinimumNights(Reservation reservation, Long orgId) {
        Property property = reservation.getProperty();
        if (property == null || reservation.getCheckIn() == null || reservation.getCheckOut() == null) {
            return;
        }

        long actualNights = java.time.temporal.ChronoUnit.DAYS.between(
                reservation.getCheckIn(), reservation.getCheckOut());
        if (actualNights < 1) {
            throw new IllegalArgumentException(
                    "La duree de la reservation doit etre d'au moins 1 nuit (check-out apres check-in)");
        }

        Integer effectiveMinNights = minNightsOverrideRepository
                .findByPropertyIdAndDate(property.getId(), reservation.getCheckIn(), orgId)
                .map(o -> o.getMinNights())
                .orElseGet(property::getMinimumNights);

        if (effectiveMinNights == null || effectiveMinNights <= 1) {
            return; // pas de contrainte
        }

        if (actualNights < effectiveMinNights) {
            throw new IllegalArgumentException(String.format(
                    "Minimum de %d nuits requis pour un check-in le %s (reservation soumise: %d nuits)",
                    effectiveMinNights, reservation.getCheckIn(), actualNights));
        }
    }
}
