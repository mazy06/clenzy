package com.clenzy.repository;

import com.clenzy.model.UpsellOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UpsellOrderRepository extends JpaRepository<UpsellOrder, Long> {

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select o from UpsellOrder o where o.id=:id and o.organizationId=:org")
    Optional<UpsellOrder> lockForExecution(@org.springframework.data.repository.query.Param("id") Long id,
                                        @org.springframework.data.repository.query.Param("org") Long org);

    Optional<UpsellOrder> findByStripeSessionId(String stripeSessionId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select o from UpsellOrder o where o.stripeSessionId = :sessionId")
    Optional<UpsellOrder> lockBySession(@org.springframework.data.repository.query.Param("sessionId") String sessionId);

    List<UpsellOrder> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);

    List<UpsellOrder> findByReservationIdOrderByCreatedAtDesc(Long reservationId);
}
