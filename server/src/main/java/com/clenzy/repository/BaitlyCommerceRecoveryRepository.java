package com.clenzy.repository;
import com.clenzy.model.BaitlyCommerceRecovery;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface BaitlyCommerceRecoveryRepository extends JpaRepository<BaitlyCommerceRecovery,Long> {
    List<BaitlyCommerceRecovery> findByOrganizationIdAndTransferIdOrderById(Long organizationId,Long transferId);
}
