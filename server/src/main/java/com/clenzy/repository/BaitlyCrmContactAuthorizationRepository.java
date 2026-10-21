package com.clenzy.repository;
import com.clenzy.model.BaitlyCrmContactAuthorization;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface BaitlyCrmContactAuthorizationRepository extends JpaRepository<BaitlyCrmContactAuthorization,Long> {
    List<BaitlyCrmContactAuthorization> findByOrganizationIdAndProspectIdOrderByIdDesc(Long organizationId,Long prospectId);
    List<BaitlyCrmContactAuthorization> findByOrganizationIdAndDestinationHashAndPurposeAndChannelOrderByIdDesc(
        Long organizationId,String destinationHash,String purpose,String channel);
}
