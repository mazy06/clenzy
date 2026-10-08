package com.clenzy.repository;

import com.clenzy.model.BaitlyTransferRecovery;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface BaitlyTransferRecoveryRepository extends JpaRepository<BaitlyTransferRecovery,Long> {
    /** L'appelant a déjà autorisé ce transfert ; le filtre organisation reste explicite. */
    @Query(value="SELECT * FROM baitly_transfer_recoveries WHERE organization_id=:org AND transfer_id=:transfer ORDER BY id",nativeQuery=true)
    List<BaitlyTransferRecovery> findHistory(@Param("org") Long org,@Param("transfer") Long transfer);
}
