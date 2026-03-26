package com.clenzy.booking.repository;

import com.clenzy.booking.model.BookingServiceCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BookingServiceCategoryRepository extends JpaRepository<BookingServiceCategory, Long> {

    List<BookingServiceCategory> findAllByOrganizationIdOrderBySortOrderAsc(Long organizationId);

    List<BookingServiceCategory> findAllByOrganizationIdAndActiveTrueOrderBySortOrderAsc(Long organizationId);

    Optional<BookingServiceCategory> findByIdAndOrganizationId(Long id, Long organizationId);
}
