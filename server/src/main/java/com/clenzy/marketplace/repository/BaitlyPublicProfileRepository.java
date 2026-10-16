package com.clenzy.marketplace.repository;
import com.clenzy.marketplace.model.BaitlyPublicProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface BaitlyPublicProfileRepository extends JpaRepository<BaitlyPublicProfile, UUID> {
    Optional<BaitlyPublicProfile> findByOrganizationIdAndAuthorUserId(Long organizationId, Long authorUserId);
    List<BaitlyPublicProfile> findTop100ByPublishedTrueAndRoleOrderByUpdatedAtDesc(String role);
}
