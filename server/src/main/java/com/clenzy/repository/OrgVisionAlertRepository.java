package com.clenzy.repository;

import com.clenzy.model.OrgVisionAlert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrgVisionAlertRepository extends JpaRepository<OrgVisionAlert, Long> {

    Optional<OrgVisionAlert> findByOrganizationId(Long organizationId);

    /**
     * Liste de toutes les configs actives — utilise par le scheduler hebdo pour
     * iterer sur les orgs opt-in. Pas de filtre tenant : c'est un job systeme.
     */
    @Override
    List<OrgVisionAlert> findAll();
}
