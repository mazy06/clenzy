package com.clenzy.booking.repository;

import com.clenzy.booking.model.GuestCreditTransaction;
import com.clenzy.booking.model.GuestCreditTxType;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GuestCreditTransactionRepository extends JpaRepository<GuestCreditTransaction, Long> {

    java.util.Optional<GuestCreditTransaction> findByOrganizationIdAndReservationCodeAndType(
        Long organizationId, String reservationCode, GuestCreditTxType type);

    /** Idempotence du gain : une réservation n'est créditée qu'une fois. */
    boolean existsByOrganizationIdAndReservationCodeAndType(Long organizationId, String reservationCode, GuestCreditTxType type);
    java.util.List<GuestCreditTransaction> findByOrganizationIdAndSourceCreditId(Long organizationId,Long sourceCreditId);
}
