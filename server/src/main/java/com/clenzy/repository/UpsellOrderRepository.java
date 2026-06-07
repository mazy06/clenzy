package com.clenzy.repository;

import com.clenzy.model.UpsellOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UpsellOrderRepository extends JpaRepository<UpsellOrder, Long> {

    Optional<UpsellOrder> findByStripeSessionId(String stripeSessionId);

    List<UpsellOrder> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);

    List<UpsellOrder> findByReservationIdOrderByCreatedAtDesc(Long reservationId);
}
