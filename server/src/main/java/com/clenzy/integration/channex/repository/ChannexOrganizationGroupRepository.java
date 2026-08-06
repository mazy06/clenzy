package com.clenzy.integration.channex.repository;

import com.clenzy.integration.channex.model.ChannexOrganizationGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChannexOrganizationGroupRepository
    extends JpaRepository<ChannexOrganizationGroup, UUID> {

    Optional<ChannexOrganizationGroup> findByOrganizationId(Long organizationId);

    /**
     * Tous les groups provisionnes, toutes organisations confondues.
     *
     * <p>Sert au cloisonnement en lecture : la decouverte a besoin de savoir
     * quels groups appartiennent a d'AUTRES organisations pour en masquer le
     * contenu. Table de routage sans donnee metier, pas de fuite.</p>
     */
    List<ChannexOrganizationGroup> findAllBy();
}
