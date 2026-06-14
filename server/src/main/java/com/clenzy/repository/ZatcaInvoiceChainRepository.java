package com.clenzy.repository;

import com.clenzy.model.ZatcaInvoiceChain;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ZatcaInvoiceChainRepository extends JpaRepository<ZatcaInvoiceChain, Long> {

    /**
     * Tête de chaîne (ICV max) d'une org, avec <b>verrou pessimiste</b> : sérialise l'attribution
     * de l'ICV suivant et la lecture du PIH (modèle {@code InvoiceNumberingService}, audit #8).
     * Vide pour la première facture (la contrainte unique (org, icv) tranche la course genesis).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM ZatcaInvoiceChain c WHERE c.organizationId = :orgId "
        + "AND c.icv = (SELECT MAX(c2.icv) FROM ZatcaInvoiceChain c2 WHERE c2.organizationId = :orgId)")
    Optional<ZatcaInvoiceChain> findTailForUpdate(@Param("orgId") Long orgId);

    /** Idempotence : une facture déjà chaînée n'est pas ré-ajoutée. */
    Optional<ZatcaInvoiceChain> findByOrganizationIdAndInvoiceNumber(Long organizationId, String invoiceNumber);
}
