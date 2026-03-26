package com.clenzy.booking.repository;

import com.clenzy.booking.model.BookingServiceItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BookingServiceItemRepository extends JpaRepository<BookingServiceItem, Long> {

    List<BookingServiceItem> findAllByCategoryIdOrderBySortOrderAsc(Long categoryId);

    Optional<BookingServiceItem> findByIdAndOrganizationId(Long id, Long organizationId);

    List<BookingServiceItem> findAllByIdInAndOrganizationId(List<Long> ids, Long organizationId);
}
