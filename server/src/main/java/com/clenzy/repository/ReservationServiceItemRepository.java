package com.clenzy.repository;

import com.clenzy.model.ReservationServiceItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReservationServiceItemRepository extends JpaRepository<ReservationServiceItem, Long> {

    List<ReservationServiceItem> findAllByReservationId(Long reservationId);
}
