package com.clenzy.repository;

import com.clenzy.model.Prospect;
import com.clenzy.model.Prospect.ProspectCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProspectRepository extends JpaRepository<Prospect, Long>, JpaSpecificationExecutor<Prospect> {

    List<Prospect> findByOrganizationId(Long organizationId);

    List<Prospect> findByOrganizationIdAndCategory(Long organizationId, ProspectCategory category);

    long countByOrganizationId(Long organizationId);
}
