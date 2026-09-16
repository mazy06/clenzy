package com.clenzy.repository;

import com.clenzy.model.UpsellTypeDef;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/** Referentiel des types de vente additionnelle. */
public interface UpsellTypeDefRepository extends JpaRepository<UpsellTypeDef, Long> {

    /**
     * Types visibles d'une organisation : les siens ET ceux de la plateforme.
     *
     * <p>Pas de filtre Hibernate sur cette entite — elle melange deux portees a
     * dessein, et un filtre tenant aurait masque les types de plateforme, donc
     * les neuf historiques dont depend le code.</p>
     */
    @Query("""
           SELECT t FROM UpsellTypeDef t
           WHERE t.active = true AND (t.organizationId IS NULL OR t.organizationId = :orgId)
           ORDER BY t.sortOrder ASC, t.labelFr ASC
           """)
    List<UpsellTypeDef> findVisibleFor(@Param("orgId") Long orgId);

    /** Resolution d'un code dans la portee d'une organisation, type propre prioritaire. */
    @Query("""
           SELECT t FROM UpsellTypeDef t
           WHERE t.code = :code AND (t.organizationId IS NULL OR t.organizationId = :orgId)
           ORDER BY t.organizationId DESC NULLS LAST
           """)
    List<UpsellTypeDef> findByCodeInScope(@Param("code") String code, @Param("orgId") Long orgId);

    Optional<UpsellTypeDef> findByIdAndOrganizationId(Long id, Long organizationId);

    boolean existsByCodeAndOrganizationId(String code, Long organizationId);
}
