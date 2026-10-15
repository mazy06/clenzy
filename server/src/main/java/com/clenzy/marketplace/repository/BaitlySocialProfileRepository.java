package com.clenzy.marketplace.repository;
import com.clenzy.marketplace.model.BaitlySocialProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
public interface BaitlySocialProfileRepository extends JpaRepository<BaitlySocialProfile,UUID> {
    Optional<BaitlySocialProfile> findByOrganizationIdAndAuthorUserId(Long organizationId,Long authorUserId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from BaitlySocialProfile p where p.id = :id")
    Optional<BaitlySocialProfile> findLockedById(@Param("id") UUID id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<BaitlySocialProfile> findByInstagramUserId(String instagramUserId);
}
