package com.clenzy.repository;

import com.clenzy.model.MarketingContact;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MarketingContactRepository extends JpaRepository<MarketingContact, Long> {

    Optional<MarketingContact> findByOrganizationIdAndEmail(Long organizationId, String email);

    @Query("SELECT c FROM MarketingContact c WHERE c.organizationId = :orgId ORDER BY c.createdAt DESC")
    List<MarketingContact> findByOrganizationId(@Param("orgId") Long orgId, Pageable pageable);

    long countByOrganizationId(Long organizationId);
}
