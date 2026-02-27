package com.clenzy.repository;

import com.clenzy.model.WelcomeGuide;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WelcomeGuideRepository extends JpaRepository<WelcomeGuide, Long> {

    List<WelcomeGuide> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);

    List<WelcomeGuide> findByPropertyIdAndOrganizationId(Long propertyId, Long organizationId);

    Optional<WelcomeGuide> findByPropertyIdAndLanguage(Long propertyId, String language);

    Optional<WelcomeGuide> findByIdAndOrganizationId(Long id, Long organizationId);
}
