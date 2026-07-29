package com.clenzy.service;

import com.clenzy.config.CheckInConfig;
import com.clenzy.dto.OnlineCheckInSubmission;
import com.clenzy.model.*;
import com.clenzy.repository.OnlineCheckInRepository;
import com.clenzy.repository.ReservationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class OnlineCheckInService {

    private static final Logger log = LoggerFactory.getLogger(OnlineCheckInService.class);

    private final OnlineCheckInRepository checkInRepository;
    private final ReservationRepository reservationRepository;
    private final CheckInConfig config;
    private final NotificationService notificationService;

    public OnlineCheckInService(OnlineCheckInRepository checkInRepository,
                                 ReservationRepository reservationRepository,
                                 CheckInConfig config,
                                 NotificationService notificationService) {
        this.checkInRepository = checkInRepository;
        this.reservationRepository = reservationRepository;
        this.config = config;
        this.notificationService = notificationService;
    }

    @Transactional
    public OnlineCheckIn createCheckIn(Long reservationId, Long orgId) {
        Reservation reservation = reservationRepository.findById(reservationId)
            .orElseThrow(() -> new IllegalArgumentException("Reservation introuvable: " + reservationId));

        Optional<OnlineCheckIn> existing = checkInRepository.findByReservationIdAndOrganizationId(reservationId, orgId);
        if (existing.isPresent()) {
            return existing.get();
        }

        OnlineCheckIn checkIn = new OnlineCheckIn();
        checkIn.setOrganizationId(orgId);
        checkIn.setReservation(reservation);
        checkIn.setToken(UUID.randomUUID());
        checkIn.setStatus(OnlineCheckInStatus.PENDING);
        checkIn.setExpiresAt(LocalDateTime.now().plusDays(config.getTokenTtlDays()));

        return checkInRepository.save(checkIn);
    }

    public Optional<OnlineCheckIn> getByToken(UUID token) {
        return checkInRepository.findByToken(token)
            .filter(c -> c.getStatus() != OnlineCheckInStatus.EXPIRED);
    }

    @Transactional
    public OnlineCheckIn startCheckIn(UUID token) {
        OnlineCheckIn checkIn = checkInRepository.findByToken(token)
            .orElseThrow(() -> new IllegalArgumentException("Check-in introuvable"));

        if (checkIn.getStatus() == OnlineCheckInStatus.EXPIRED) {
            throw new IllegalStateException("Ce lien de check-in a expire");
        }
        if (checkIn.getExpiresAt().isBefore(LocalDateTime.now())) {
            checkIn.setStatus(OnlineCheckInStatus.EXPIRED);
            checkInRepository.save(checkIn);
            throw new IllegalStateException("Ce lien de check-in a expire");
        }

        if (checkIn.getStatus() == OnlineCheckInStatus.PENDING) {
            checkIn.setStatus(OnlineCheckInStatus.STARTED);
            checkIn.setStartedAt(LocalDateTime.now());
            checkIn = checkInRepository.save(checkIn);

            notifyOwner(checkIn, NotificationKey.ONLINE_CHECKIN_STARTED, "Check-in en ligne demarre");
        }

        return checkIn;
    }

    /**
     * Enregistre la saisie du voyageur et clôt son check-in.
     *
     * <p>La saisie porte désormais aussi les champs d'identité — naissance,
     * nationalité, résidence — qui vivaient dans un second formulaire.</p>
     *
     * <p>Ce service enregistre la saisie ; c'est
     * {@code CheckInSubmissionService} qui en tire la fiche voyageur. La
     * séparation n'est pas cosmétique : {@code GuestDeclarationService} lit
     * déjà le check-in pour retrouver la pièce d'identité, et l'appeler d'ici
     * fermerait un cycle de dépendances que Spring refuse de construire.</p>
     */
    @Transactional
    public OnlineCheckIn completeCheckIn(UUID token, OnlineCheckInSubmission submission) {
        OnlineCheckIn checkIn = checkInRepository.findByToken(token)
            .orElseThrow(() -> new IllegalArgumentException("Check-in introuvable"));

        if (checkIn.getStatus() == OnlineCheckInStatus.COMPLETED) {
            throw new IllegalStateException("Ce check-in est deja complete");
        }

        checkIn.setFirstName(submission.firstName());
        checkIn.setLastName(submission.lastName());
        checkIn.setEmail(submission.email());
        checkIn.setPhone(submission.phone());
        checkIn.setIdDocumentNumber(submission.idDocumentNumber());
        checkIn.setIdDocumentType(submission.idDocumentType());
        checkIn.setEstimatedArrivalTime(submission.estimatedArrivalTime());
        checkIn.setSpecialRequests(submission.specialRequests());
        checkIn.setNumberOfGuests(submission.numberOfGuests());
        checkIn.setAdditionalGuests(submission.additionalGuests());
        checkIn.setMaidenName(submission.maidenName());
        checkIn.setBirthDate(submission.birthDate());
        checkIn.setBirthPlace(submission.birthPlace());
        checkIn.setNationality(submission.nationality());
        checkIn.setResidenceAddress(submission.residenceAddress());
        checkIn.setResidenceCountry(submission.residenceCountry());
        checkIn.setStatus(OnlineCheckInStatus.COMPLETED);
        checkIn.setCompletedAt(LocalDateTime.now());

        checkIn = checkInRepository.save(checkIn);

        notifyOwner(checkIn, NotificationKey.ONLINE_CHECKIN_COMPLETED,
            "Check-in en ligne complete par " + submission.firstName() + " " + submission.lastName());

        return checkIn;
    }

    public String generateCheckInLink(OnlineCheckIn checkIn) {
        return config.getBaseUrl() + "/" + checkIn.getToken().toString();
    }

    public Optional<OnlineCheckIn> getByReservation(Long reservationId, Long orgId) {
        return checkInRepository.findByReservationIdAndOrganizationId(reservationId, orgId);
    }

    public Page<OnlineCheckIn> getAll(Long orgId, Pageable pageable) {
        return checkInRepository.findByOrganizationIdOrderByCreatedAtDesc(orgId, pageable);
    }

    @Scheduled(cron = "0 0 3 * * *") // 3h du matin
    @Transactional
    public void expireOldCheckIns() {
        List<OnlineCheckIn> expired = checkInRepository.findByStatusAndExpiresAtBefore(
            OnlineCheckInStatus.PENDING, LocalDateTime.now());
        for (OnlineCheckIn c : expired) {
            c.setStatus(OnlineCheckInStatus.EXPIRED);
        }
        checkInRepository.saveAll(expired);
        if (!expired.isEmpty()) {
            log.info("Expire {} check-ins", expired.size());
        }
    }

    private void notifyOwner(OnlineCheckIn checkIn, NotificationKey key, String message) {
        try {
            Property property = checkIn.getReservation().getProperty();
            if (property != null && property.getOwner() != null && property.getOwner().getKeycloakId() != null) {
                notificationService.send(property.getOwner().getKeycloakId(), key,
                    "Check-in en ligne", message,
                    "/reservations?highlight=" + checkIn.getReservation().getId());
            }
        } catch (Exception e) {
            log.warn("Erreur notification check-in: {}", e.getMessage());
        }
    }
}
