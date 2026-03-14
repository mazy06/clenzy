package com.clenzy.repository;

import com.clenzy.model.ExpenseStatus;
import com.clenzy.model.ProviderExpense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ProviderExpenseRepository extends JpaRepository<ProviderExpense, Long> {

    @Query("SELECT e FROM ProviderExpense e WHERE e.organizationId = :orgId ORDER BY e.expenseDate DESC")
    List<ProviderExpense> findAllByOrgId(@Param("orgId") Long orgId);

    @Query("SELECT e FROM ProviderExpense e WHERE e.id = :id AND e.organizationId = :orgId")
    Optional<ProviderExpense> findByIdAndOrgId(@Param("id") Long id, @Param("orgId") Long orgId);

    @Query("SELECT e FROM ProviderExpense e WHERE e.provider.id = :providerId AND e.organizationId = :orgId ORDER BY e.expenseDate DESC")
    List<ProviderExpense> findByProviderIdAndOrgId(@Param("providerId") Long providerId, @Param("orgId") Long orgId);

    @Query("SELECT e FROM ProviderExpense e WHERE e.property.id = :propertyId AND e.status IN :statuses AND e.organizationId = :orgId ORDER BY e.expenseDate DESC")
    List<ProviderExpense> findByPropertyIdAndStatusIn(
            @Param("propertyId") Long propertyId,
            @Param("statuses") List<ExpenseStatus> statuses,
            @Param("orgId") Long orgId);

    @Query("SELECT e FROM ProviderExpense e WHERE e.ownerPayout.id = :payoutId AND e.organizationId = :orgId")
    List<ProviderExpense> findByPayoutIdAndOrgId(@Param("payoutId") Long payoutId, @Param("orgId") Long orgId);

    /**
     * Trouve les depenses APPROVED liees aux proprietes d'un owner sur une periode.
     * Utilisee lors de la generation du payout pour agreger les depenses.
     */
    @Query("""
        SELECT e FROM ProviderExpense e
        JOIN e.property p
        WHERE p.owner.id = :ownerId
          AND e.status = com.clenzy.model.ExpenseStatus.APPROVED
          AND e.expenseDate BETWEEN :from AND :to
          AND e.organizationId = :orgId
        ORDER BY e.expenseDate
        """)
    List<ProviderExpense> findApprovedByPropertyOwnerAndPeriod(
            @Param("ownerId") Long ownerId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);

    @Query("SELECT e FROM ProviderExpense e WHERE e.status = :status AND e.organizationId = :orgId ORDER BY e.expenseDate DESC")
    List<ProviderExpense> findByStatusAndOrgId(@Param("status") ExpenseStatus status, @Param("orgId") Long orgId);

    @Query("SELECT e FROM ProviderExpense e WHERE e.expenseDate BETWEEN :from AND :to AND e.organizationId = :orgId ORDER BY e.expenseDate")
    List<ProviderExpense> findByDateRangeAndOrgId(
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);

    /**
     * Depenses non encore synchronisees vers Pennylane (statuts APPROVED/INCLUDED/PAID).
     */
    @Query("SELECT e FROM ProviderExpense e WHERE e.organizationId = :orgId " +
           "AND e.pennylaneInvoiceId IS NULL " +
           "AND e.status IN :statuses " +
           "ORDER BY e.expenseDate DESC")
    List<ProviderExpense> findPendingPennylaneSync(
            @Param("orgId") Long orgId,
            @Param("statuses") List<ExpenseStatus> statuses);

    @Query("SELECT COUNT(e) FROM ProviderExpense e WHERE e.organizationId = :orgId " +
           "AND e.pennylaneInvoiceId IS NULL " +
           "AND e.status IN :statuses")
    long countPendingPennylaneSync(
            @Param("orgId") Long orgId,
            @Param("statuses") List<ExpenseStatus> statuses);
}
