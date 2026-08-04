package com.clenzy.repository;

import com.clenzy.model.ListingQualityScore;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ListingQualityScoreRepository extends JpaRepository<ListingQualityScore, Long> {

    Optional<ListingQualityScore> findByPropertyIdAndOrganizationId(Long propertyId, Long organizationId);
}
