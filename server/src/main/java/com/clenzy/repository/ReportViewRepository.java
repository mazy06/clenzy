package com.clenzy.repository;

import com.clenzy.model.ReportView;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Vues de rapport sauvegardées, org-scopées (CLZ-P0-15).
 */
@Repository
public interface ReportViewRepository extends JpaRepository<ReportView, Long> {

    List<ReportView> findByOrganizationId(Long organizationId);
}
