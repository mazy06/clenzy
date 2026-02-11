package com.clenzy.repository;

import com.clenzy.model.GdprConsent;
import com.clenzy.model.GdprConsent.ConsentType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GdprConsentRepository extends JpaRepository<GdprConsent, Long> {
    List<GdprConsent> findByUserId(Long userId);
    Optional<GdprConsent> findTopByUserIdAndConsentTypeOrderByVersionDesc(Long userId, ConsentType consentType);
    List<GdprConsent> findByUserIdAndGrantedTrue(Long userId);
    void deleteByUserId(Long userId);
}
