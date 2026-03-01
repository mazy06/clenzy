package com.clenzy.integration.booking.repository;

import com.clenzy.integration.booking.model.BookingConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository pour la gestion des entites {@link BookingConnection}.
 */
@Repository
public interface BookingConnectionRepository extends JpaRepository<BookingConnection, Long> {

    Optional<BookingConnection> findByOrganizationId(Long organizationId);

    Optional<BookingConnection> findByHotelId(String hotelId);

    @Query("SELECT bc FROM BookingConnection bc WHERE bc.status = 'ACTIVE'")
    List<BookingConnection> findAllActive();
}
