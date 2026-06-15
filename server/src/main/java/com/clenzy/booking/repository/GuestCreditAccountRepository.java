package com.clenzy.booking.repository;

import com.clenzy.booking.model.GuestCreditAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface GuestCreditAccountRepository extends JpaRepository<GuestCreditAccount, Long> {

    Optional<GuestCreditAccount> findByOrganizationIdAndEmail(Long organizationId, String email);

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
