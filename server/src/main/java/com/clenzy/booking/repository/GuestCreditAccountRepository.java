package com.clenzy.booking.repository;

import com.clenzy.booking.model.GuestCreditAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface GuestCreditAccountRepository extends JpaRepository<GuestCreditAccount, Long> {

    Optional<GuestCreditAccount> findByOrganizationIdAndEmail(Long organizationId, String email);

    interface LockedBalance {
        Long getId();
        String getCurrency();
        String getReferralCode();
        long getBalanceCents();
    }

    /** Projection fraîche : ne réutilise pas un solde chargé avant l'attente du verrou. */
    @Query(value = "SELECT id, currency, referral_code AS \"referralCode\", balance_cents AS \"balanceCents\" FROM guest_credit_accounts "
        + "WHERE organization_id=:orgId AND email=:email FOR UPDATE", nativeQuery = true)
    Optional<LockedBalance> lockBalance(@Param("orgId") Long orgId, @Param("email") String email);

    @Modifying
    @Query(value = "INSERT INTO guest_credit_accounts(organization_id,email,currency,balance_cents) "
        + "VALUES (:orgId,:email,:currency,0) ON CONFLICT (organization_id,email) DO NOTHING", nativeQuery = true)
    void ensureAccount(@Param("orgId") Long orgId, @Param("email") String email, @Param("currency") String currency);

    @Modifying
    @Query("UPDATE GuestCreditAccount a SET a.balanceCents=a.balanceCents+:amount, a.updatedAt=CURRENT_TIMESTAMP WHERE a.id=:id")
    int addBalance(@Param("id") Long id, @Param("amount") long amount);

    /** Ne réécrit jamais un solde chargé avant une consommation concurrente. */
    @Modifying
    @Query("UPDATE GuestCreditAccount a SET a.referralCode=:code, a.updatedAt=CURRENT_TIMESTAMP WHERE a.id=:id")
    int assignReferralCode(@Param("id") Long id, @Param("code") String code);

    /** Parrainage (2.11) : résout le compte parrain depuis son code (scopé org). */
    Optional<GuestCreditAccount> findByOrganizationIdAndReferralCode(Long organizationId, String referralCode);

    /**
     * Déduction ATOMIQUE du solde (2.8 — rédemption) : ne décrémente que si le solde couvre le
     * montant (audit #8 : UPDATE conditionnel, jamais check-then-act). Renvoie le nombre de lignes
     * affectées (1 = succès, 0 = solde insuffisant / compte absent).
     */
    @Modifying
    @Query("UPDATE GuestCreditAccount a SET a.balanceCents = a.balanceCents - :amount "
        + "WHERE a.organizationId = :orgId AND a.email = :email AND a.balanceCents >= :amount")
    int deductIfSufficient(@Param("orgId") Long orgId, @Param("email") String email, @Param("amount") long amount);
}
