package com.clenzy.repository;

import com.clenzy.model.PaymentProviderType;
import com.clenzy.model.PaymentTransaction;
import com.clenzy.model.TransactionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {

    Optional<PaymentTransaction> findByTransactionRef(String transactionRef);

    Optional<PaymentTransaction> findByIdempotencyKey(String idempotencyKey);

    List<PaymentTransaction> findByOrganizationIdAndSourceTypeAndSourceId(
        Long organizationId, String sourceType, Long sourceId);

    Page<PaymentTransaction> findByOrganizationId(Long organizationId, Pageable pageable);

    Page<PaymentTransaction> findByOrganizationIdAndStatus(
        Long organizationId, TransactionStatus status, Pageable pageable);

    Page<PaymentTransaction> findByOrganizationIdAndProviderType(
        Long organizationId, PaymentProviderType providerType, Pageable pageable);

    List<PaymentTransaction> findByOrganizationIdAndStatus(
        Long organizationId, TransactionStatus status);
}
