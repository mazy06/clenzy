package com.clenzy.repository;

import com.clenzy.model.OnlineCheckIn;
import com.clenzy.model.OnlineCheckInStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OnlineCheckInRepository extends JpaRepository<OnlineCheckIn, Long> {

    Optional<OnlineCheckIn> findByToken(UUID token);

    Optional<OnlineCheckIn> findByReservationIdAndOrganizationId(Long reservationId, Long organizationId);

    Page<OnlineCheckIn> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId, Pageable pageable);

    List<OnlineCheckIn> findByStatusAndExpiresAtBefore(OnlineCheckInStatus status, LocalDateTime before);
}
