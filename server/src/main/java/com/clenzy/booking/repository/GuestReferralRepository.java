package com.clenzy.booking.repository;

import com.clenzy.booking.model.GuestReferral;
import com.clenzy.booking.model.GuestReferralStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GuestReferralRepository extends JpaRepository<GuestReferral, Long> {

    /** Un filleul n'est rattaché qu'une fois par org → garde l'anti double-parrainage au claim. */
    boolean existsByOrganizationIdAndRefereeEmail(Long organizationId, String refereeEmail);

    /** Lien en attente d'une réservation terminée (clé du grant côté scheduler). */
    Optional<GuestReferral> findByOrganizationIdAndReservationCodeAndStatus(
            Long organizationId, String reservationCode, GuestReferralStatus status);

    /** Liens en attente d'une org (scan de crédit des séjours terminés). */
    List<GuestReferral> findByOrganizationIdAndStatus(Long organizationId, GuestReferralStatus status);
}
