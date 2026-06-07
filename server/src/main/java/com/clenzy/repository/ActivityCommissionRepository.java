package com.clenzy.repository;

import com.clenzy.model.ActivityCommission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ActivityCommissionRepository extends JpaRepository<ActivityCommission, Long> {

    List<ActivityCommission> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);
}
