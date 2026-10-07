package com.clenzy.repository;

import com.clenzy.model.PayoutTransferEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface PayoutTransferEventRepository extends JpaRepository<PayoutTransferEvent, Long> {
    List<PayoutTransferEvent> findByOrganizationIdAndTransferIdOrderByIdAsc(Long organizationId, Long transferId);

    /** Après vérification du bénéficiaire ; le filtre de son organisation ne doit pas masquer l'émetteur. */
    @Query(value = "SELECT * FROM payout_transfer_events WHERE organization_id=:org AND transfer_id=:transfer ORDER BY id", nativeQuery = true)
    List<PayoutTransferEvent> findRecipientHistory(@Param("org") Long organizationId, @Param("transfer") Long transferId);
}
