package com.clenzy.repository;

import com.clenzy.model.HardwareOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface HardwareOrderRepository extends JpaRepository<HardwareOrder, Long> {

    List<HardwareOrder> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);

    Optional<HardwareOrder> findByStripeSessionId(String stripeSessionId);
}
