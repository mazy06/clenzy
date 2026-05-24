package com.clenzy.repository;

import com.clenzy.model.OrganizationAmenityIconOverride;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository pour {@link OrganizationAmenityIconOverride}.
 *
 * <p>Toutes les methodes prennent {@code organizationId} explicitement plutot
 * que de se reposer sur le @Filter Hibernate : ca permet a la classe service
 * d'etre testee unitairement sans setup de TenantContext, et de pouvoir
 * resoudre les overrides pour un autre org en cas de besoin admin (cross-org
 * lookup par SUPER_ADMIN).</p>
 */
@Repository
public interface OrganizationAmenityIconOverrideRepository
        extends JpaRepository<OrganizationAmenityIconOverride, Long> {

    List<OrganizationAmenityIconOverride> findByOrganizationId(Long organizationId);

    Optional<OrganizationAmenityIconOverride> findByOrganizationIdAndAmenityCode(
            Long organizationId, String amenityCode);

    void deleteByOrganizationIdAndAmenityCode(Long organizationId, String amenityCode);
}
