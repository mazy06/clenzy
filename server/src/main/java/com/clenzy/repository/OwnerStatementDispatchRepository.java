package com.clenzy.repository;

import com.clenzy.model.OwnerStatementDispatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;

@Repository
public interface OwnerStatementDispatchRepository extends JpaRepository<OwnerStatementDispatch, Long> {

    boolean existsByOrganizationIdAndOwnerIdAndPeriodStart(Long organizationId, Long ownerId, LocalDate periodStart);

    /**
     * Verrou advisory TRANSACTIONNEL sur la cle de claim d'un releve
     * ({@code OWNER_STATEMENT:orgId:ownerId:periodStart}) : serialise les
     * executeurs concurrents du MEME releve (double tick scheduler, re-livraison).
     * Le perdant attend le commit du gagnant, voit le claim au check d'existence
     * et sort en skip propre — au lieu de percuter la contrainte unique
     * {@code uq_owner_statement_dispatch} (0306), ce qui marquerait la
     * transaction englobante du moteur ({@code fireTrigger @Transactional})
     * rollback-only : le catch de DataIntegrityViolationException en aval ne
     * peut alors plus rien sauver (UnexpectedRollbackException au commit — meme
     * bug que le menage auto, revele par AutomationConcurrencyIT, vague T3).
     * Relache automatiquement en fin de transaction.
     */
    @Query(value = "SELECT pg_advisory_xact_lock(hashtext(:claimKey))", nativeQuery = true)
    Object acquireDispatchClaimLock(@Param("claimKey") String claimKey);
}
