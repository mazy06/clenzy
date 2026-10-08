package com.clenzy.repository;
import com.clenzy.model.BaitlySubscriptionOrder;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;

public interface BaitlySubscriptionOrderRepository extends JpaRepository<BaitlySubscriptionOrder,Long> {
    Optional<BaitlySubscriptionOrder> findBySignupId(Long signupId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from BaitlySubscriptionOrder o where o.id=:id")
    Optional<BaitlySubscriptionOrder> lockById(@Param("id")Long id);
    Optional<BaitlySubscriptionOrder> findByOrganizationIdAndRequestId(Long organizationId,UUID requestId);
    Optional<BaitlySubscriptionOrder> findByCheckoutSessionId(String sessionId);
    Optional<BaitlySubscriptionOrder> findByStripeSubscriptionId(String subscriptionId);
    Optional<BaitlySubscriptionOrder> findByIdAndOrganizationId(Long id,Long organizationId);
    List<BaitlySubscriptionOrder> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);
    long countByPromoCodeIdAndStatusIn(Long promoCodeId,Collection<String> statuses);
    @Query("select o from BaitlySubscriptionOrder o where o.id>:afterId and o.checkoutSessionId is not null and o.status in ('CHECKOUT_OPEN','ACTIVATING','PAID_AWAITING_ACCOUNT','ACTIVE','PAST_DUE','CANCELLED','SUSPENDED','REVIEW_REQUIRED') order by o.id")
    List<BaitlySubscriptionOrder> recoveryBatch(@Param("afterId")long afterId,org.springframework.data.domain.Pageable page);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from BaitlySubscriptionOrder o where o.id=:id and o.organizationId=:org")
    Optional<BaitlySubscriptionOrder> lockByIdAndOrganizationId(@Param("id")Long id,@Param("org")Long org);
}
