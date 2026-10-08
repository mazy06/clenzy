package com.clenzy.repository;

import com.clenzy.model.HardwareOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface HardwareOrderRepository extends JpaRepository<HardwareOrder, Long> {

    List<HardwareOrder> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);

    Optional<HardwareOrder> findByStripeSessionId(String stripeSessionId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select o from HardwareOrder o where o.stripeSessionId = :session")
    Optional<HardwareOrder> lockByStripeSessionId(@org.springframework.data.repository.query.Param("session") String session);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select o from HardwareOrder o where o.id = :id and o.organizationId = :org")
    Optional<HardwareOrder> lockForOrganization(@org.springframework.data.repository.query.Param("org") Long org,
                                               @org.springframework.data.repository.query.Param("id") Long id);
}
