package com.clenzy.repository;

import com.clenzy.model.GdprConsent;
import com.clenzy.model.GdprConsent.ConsentType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GdprConsentRepository extends JpaRepository<GdprConsent, Long> {
    List<GdprConsent> findByUserId(Long userId);
    Optional<GdprConsent> findTopByUserIdAndConsentTypeOrderByVersionDesc(Long userId, ConsentType consentType);
    List<GdprConsent> findByUserIdAndGrantedTrue(Long userId);
    @Modifying
    @Query("DELETE FROM GdprConsent gc WHERE gc.userId = :userId AND gc.organizationId = :orgId")
    void deleteByUserIdAndOrganizationId(@Param("userId") Long userId, @Param("orgId") Long orgId);
}
