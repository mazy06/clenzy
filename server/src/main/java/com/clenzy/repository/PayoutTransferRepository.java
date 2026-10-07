package com.clenzy.repository;

import com.clenzy.model.PayoutTransfer;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.util.Optional;

public interface PayoutTransferRepository extends JpaRepository<PayoutTransfer, Long>, JpaSpecificationExecutor<PayoutTransfer> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from PayoutTransfer t where t.id = :id and t.organizationId = :orgId")
    Optional<PayoutTransfer> lockByIdAndOrganizationId(@Param("id") Long id, @Param("orgId") Long orgId);

    @Modifying
    @Query(value = """
        INSERT INTO payout_transfers(organization_id,source,source_id,beneficiary_user_id,beneficiary_organization_id,amount,currency,
            provider,destination,description,idempotency_key,state,created_at,updated_at)
        VALUES(:orgId,:source,:sourceId,:userId,:beneficiaryOrgId,:amount,:currency,'STRIPE',:destination,:description,:key,
            'SUBMITTING',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING
        """, nativeQuery = true)
    int insertIfAbsent(@Param("orgId") Long orgId, @Param("source") String source, @Param("sourceId") Long sourceId,
            @Param("userId") Long userId, @Param("beneficiaryOrgId") Long beneficiaryOrgId,
            @Param("amount") BigDecimal amount, @Param("currency") String currency,
            @Param("destination") String destination, @Param("description") String description, @Param("key") String key);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from PayoutTransfer t where t.organizationId = :orgId and t.source = :source and t.sourceId = :sourceId")
    Optional<PayoutTransfer> lockBySource(@Param("orgId") Long orgId, @Param("source") PayoutTransfer.Source source,
            @Param("sourceId") Long sourceId);

    Page<PayoutTransfer> findByOrganizationIdOrderByCreatedAtDescIdDesc(Long organizationId, Pageable pageable);
    Optional<PayoutTransfer> findByIdAndOrganizationId(Long id, Long organizationId);
    boolean existsByProviderAndDestination(String provider, String destination);
    boolean existsByProviderAndDestinationAndStripeLivemode(String provider, String destination, Boolean stripeLivemode);

    /** Scope destinataire figé, indépendant de l'organisation qui a émis le transfert. */
    @Query(value = """
        SELECT * FROM payout_transfers WHERE beneficiary_user_id=:user OR beneficiary_organization_id=:beneficiaryOrg
        ORDER BY created_at DESC,id DESC
        """, countQuery = "SELECT count(*) FROM payout_transfers WHERE beneficiary_user_id=:user OR beneficiary_organization_id=:beneficiaryOrg", nativeQuery = true)
    Page<PayoutTransfer> findForBeneficiary(@Param("user") Long user, @Param("beneficiaryOrg") Long beneficiaryOrg, Pageable pageable);

    @Query(value = """
        SELECT * FROM payout_transfers WHERE id=:id
          AND (beneficiary_user_id=:user OR beneficiary_organization_id=:beneficiaryOrg)
        """, nativeQuery = true)
    Optional<PayoutTransfer> findBeneficiaryTransfer(@Param("id") Long id,@Param("user") Long user,@Param("beneficiaryOrg") Long beneficiaryOrg);
}
