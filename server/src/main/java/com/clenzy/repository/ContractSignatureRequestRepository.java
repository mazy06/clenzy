package com.clenzy.repository;

import com.clenzy.model.ContractSignatureRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ContractSignatureRequestRepository extends JpaRepository<ContractSignatureRequest, Long> {

    /** Lookup public par token (le filtre org n'est pas actif hors TenantFilter). */
    Optional<ContractSignatureRequest> findByToken(UUID token);

    Optional<ContractSignatureRequest> findFirstByContractIdAndStatus(
            Long contractId, ContractSignatureRequest.Status status);

    /** Batch pour enrichir les DTOs contrats (évite le N+1 sur la liste). */
    List<ContractSignatureRequest> findByContractIdIn(Collection<Long> contractIds);

    /**
     * Transition atomique PENDING → SIGNED (garde anti double-clic / requêtes
     * concurrentes) : exactement un thread obtient rowcount == 1.
     */
    @Modifying
    @Query("UPDATE ContractSignatureRequest r SET r.status = 'SIGNED' "
            + "WHERE r.id = :id AND r.status = 'PENDING'")
    int markSigned(@Param("id") Long id);
}
