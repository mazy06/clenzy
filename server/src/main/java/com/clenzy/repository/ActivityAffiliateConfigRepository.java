package com.clenzy.repository;

import com.clenzy.model.ActivityAffiliateConfig;
import com.clenzy.model.ActivityProvider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ActivityAffiliateConfigRepository extends JpaRepository<ActivityAffiliateConfig, Long> {

    List<ActivityAffiliateConfig> findByOrganizationId(Long organizationId);

    List<ActivityAffiliateConfig> findByOrganizationIdAndEnabledTrue(Long organizationId);

    Optional<ActivityAffiliateConfig> findByOrganizationIdAndProvider(Long organizationId, ActivityProvider provider);
}
