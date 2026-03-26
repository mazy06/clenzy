package com.clenzy.booking.repository;

import com.clenzy.booking.model.BookingGuestProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BookingGuestProfileRepository extends JpaRepository<BookingGuestProfile, Long> {

    Optional<BookingGuestProfile> findByKeycloakIdAndOrganizationId(String keycloakId, Long organizationId);

    Optional<BookingGuestProfile> findByEmailAndOrganizationId(String email, Long organizationId);

    List<BookingGuestProfile> findByKeycloakId(String keycloakId);

    boolean existsByEmailAndOrganizationId(String email, Long organizationId);
}
