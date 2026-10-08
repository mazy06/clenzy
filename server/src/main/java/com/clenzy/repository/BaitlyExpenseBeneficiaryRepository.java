package com.clenzy.repository;

import com.clenzy.model.BaitlyExpenseBeneficiary;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface BaitlyExpenseBeneficiaryRepository extends JpaRepository<BaitlyExpenseBeneficiary,Long> {
    interface Company { Long getId(); String getName(); }
    Optional<BaitlyExpenseBeneficiary> findByExpenseIdAndOrganizationId(Long expenseId,Long organizationId);
    @Query(value="""
        SELECT o.id,o.name FROM provider_expenses e JOIN users u ON u.id=e.provider_id
        JOIN organizations o ON o.id=u.organization_id
        WHERE e.id=:expense AND e.organization_id=:org AND o.type IN ('CONCIERGE','CLEANING_COMPANY')
        """,nativeQuery=true)
    Optional<Company> company(@Param("expense") Long expenseId,@Param("org") Long orgId);
    @Query(value="SELECT count(*)>0 FROM payout_transfers WHERE organization_id=:org AND source='PROVIDER_EXPENSE' AND source_id=:expense",nativeQuery=true)
    boolean hasTransfer(@Param("expense") Long expenseId,@Param("org") Long orgId);
}
