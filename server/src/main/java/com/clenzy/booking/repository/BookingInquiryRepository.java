package com.clenzy.booking.repository;

import com.clenzy.booking.model.BookingInquiry;
import org.springframework.data.jpa.repository.JpaRepository;

/** Accès aux demandes de réservation (« devis ») du booking engine public. */
public interface BookingInquiryRepository extends JpaRepository<BookingInquiry, Long> {
}
