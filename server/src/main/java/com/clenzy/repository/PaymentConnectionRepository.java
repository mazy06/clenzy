package com.clenzy.repository;

import com.clenzy.model.PaymentConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface PaymentConnectionRepository extends JpaRepository<PaymentConnection, UUID> {
    interface ProviderAccount {
        String getAccountId();
        boolean getReady();
    }

    /** Projection interne, lien mission/bénéficiaire imposé dans la requête et sous RLS. */
    @org.springframework.data.jpa.repository.Query(value = """
        SELECT c.provider_account_id AS "accountId",
               (c.provider='STRIPE' AND c.country='FR' AND c.authorized AND c.details_submitted
                AND c.payouts_enabled AND c.transfers_enabled) AS ready
        FROM payment_connections c
        JOIN interventions i ON i.id=:missionId
        LEFT JOIN teams t ON t.id=i.team_id
        JOIN users u ON u.id=COALESCE(i.assigned_user_id,t.personal_user_id)
        WHERE i.organization_id=:orgId AND u.id=:userId AND c.user_id=u.id
          AND i.status='COMPLETED' AND i.payment_status IN ('PAID','PARTIALLY_REFUNDED')
          AND c.beneficiary_key=concat('user:',c.user_id)
          AND (c.organization_id=u.organization_id OR c.organization_id=i.organization_id)
        ORDER BY CASE WHEN c.organization_id=u.organization_id THEN 0 ELSE 1 END
        LIMIT 1
        """, nativeQuery = true)
    Optional<ProviderAccount> findAssignedProviderAccount(
            @org.springframework.data.repository.query.Param("missionId") Long missionId,
            @org.springframework.data.repository.query.Param("orgId") Long orgId,
            @org.springframework.data.repository.query.Param("userId") Long userId);

    @org.springframework.data.jpa.repository.Query(value = """
        SELECT c.provider_account_id AS "accountId",
            (c.provider='STRIPE' AND c.country='FR' AND c.authorized AND c.details_submitted
             AND c.payouts_enabled AND c.transfers_enabled) AS ready
        FROM payment_connections c
        JOIN provider_payout_beneficiaries b ON b.beneficiary_organization_id=c.organization_id
        JOIN interventions i ON i.id=b.intervention_id AND i.organization_id=b.organization_id
        LEFT JOIN teams t ON t.id=i.team_id
        LEFT JOIN users u ON u.id=i.assigned_user_id
        WHERE i.id=:missionId AND i.organization_id=:orgId
          AND i.status='COMPLETED' AND i.payment_status IN ('PAID','PARTIALLY_REFUNDED')
          AND c.organization_id=:beneficiaryOrgId AND c.beneficiary_key='organization' AND c.user_id IS NULL
          AND i.assigned_user_id IS NOT DISTINCT FROM b.assigned_user_id
          AND i.team_id IS NOT DISTINCT FROM b.team_id
          AND c.organization_id=CASE WHEN i.assigned_user_id IS NOT NULL THEN u.organization_id ELSE t.organization_id END
        """, nativeQuery = true)
    Optional<ProviderAccount> findOrganizationProviderAccount(
            @org.springframework.data.repository.query.Param("missionId") Long missionId,
            @org.springframework.data.repository.query.Param("orgId") Long orgId,
            @org.springframework.data.repository.query.Param("beneficiaryOrgId") Long beneficiaryOrgId);

    Optional<PaymentConnection> findByOrganizationIdAndBeneficiaryKey(Long orgId, String beneficiaryKey);

    /** Compte personnel du créancier nommé sur la dépense ; aucune résolution par le compte de l'opérateur. */
    @org.springframework.data.jpa.repository.Query(value = """
        SELECT c.provider_account_id AS "accountId",
            (c.provider='STRIPE' AND c.country='FR' AND c.authorized AND c.details_submitted
             AND c.payouts_enabled AND c.transfers_enabled) AS ready
        FROM provider_expenses e
        JOIN users u ON u.id=e.provider_id
        JOIN payment_connections c ON c.user_id=e.provider_id AND c.beneficiary_key=concat('user:',c.user_id)
        WHERE e.id=:expenseId AND e.organization_id=:orgId AND e.status='INCLUDED'
          AND NOT EXISTS(SELECT 1 FROM baitly_expense_beneficiaries b WHERE b.expense_id=e.id)
          AND (c.organization_id=u.organization_id OR c.organization_id=e.organization_id)
        ORDER BY CASE WHEN c.organization_id=u.organization_id THEN 0 ELSE 1 END
        LIMIT 1
        """, nativeQuery = true)
    Optional<ProviderAccount> findExpenseProviderAccount(
            @org.springframework.data.repository.query.Param("expenseId") Long expenseId,
            @org.springframework.data.repository.query.Param("orgId") Long orgId);

    @org.springframework.data.jpa.repository.Query(value="""
        SELECT c.provider_account_id AS "accountId",
            (c.provider='STRIPE' AND c.country='FR' AND c.authorized AND c.details_submitted
             AND c.payouts_enabled AND c.transfers_enabled) AS ready
        FROM provider_expenses e JOIN baitly_expense_beneficiaries b ON b.expense_id=e.id AND b.organization_id=e.organization_id
        JOIN users u ON u.id=e.provider_id AND u.id=b.provider_id AND u.organization_id=b.beneficiary_organization_id
        JOIN payment_connections c ON c.organization_id=b.beneficiary_organization_id AND c.beneficiary_key='organization' AND c.user_id IS NULL
        WHERE e.id=:expenseId AND e.organization_id=:orgId AND e.status='INCLUDED'
        """,nativeQuery=true)
    Optional<ProviderAccount> findExpenseCompanyAccount(
            @org.springframework.data.repository.query.Param("expenseId") Long expenseId,
            @org.springframework.data.repository.query.Param("orgId") Long orgId);
    Optional<PaymentConnection> findByProviderAndProviderAccountId(String provider, String accountId);
}
