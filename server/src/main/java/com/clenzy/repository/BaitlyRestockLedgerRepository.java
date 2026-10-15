package com.clenzy.repository;
import com.clenzy.model.BaitlyRestockLedger;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface BaitlyRestockLedgerRepository extends JpaRepository<BaitlyRestockLedger,Long> {
    Optional<BaitlyRestockLedger> findByRequestKey(String key);
    @org.springframework.data.jpa.repository.Query(value="SELECT l.* FROM baitly_restock_ledger l WHERE l.intervention_id=:mission AND l.organization_id=:org ORDER BY l.created_at,l.id",nativeQuery=true)
    List<BaitlyRestockLedger> findByInterventionIdAndOrganizationIdOrderByCreatedAtAsc(@org.springframework.data.repository.query.Param("mission") Long mission,@org.springframework.data.repository.query.Param("org") Long org);
}
