package com.clenzy.repository;

import com.clenzy.model.PropertyStockItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PropertyStockItemRepository extends JpaRepository<PropertyStockItem, Long> {

    List<PropertyStockItem> findByPropertyIdAndOrganizationIdOrderByNameAsc(
            Long propertyId, Long organizationId);

    Optional<PropertyStockItem> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Articles SOUS LEUR SEUIL sur toute l'organisation, le plus bas d'abord.
     *
     * <p>Le stock ne se consultait que logement par logement : voir ce qu'il
     * faut recommander demandait d'ouvrir les fiches une a une. Un seuil a zero
     * signifie « article non suivi » — il est ecarte, comme dans le scanner.</p>
     */
    @Query("SELECT s FROM PropertyStockItem s "
            + "WHERE s.organizationId = :orgId AND s.reorderThreshold > 0 "
            + "AND s.quantity <= s.reorderThreshold "
            + "ORDER BY (s.quantity - s.reorderThreshold) ASC, s.name ASC")
    List<PropertyStockItem> findBelowThreshold(@Param("orgId") Long orgId);

    /** Décrément atomique de la consommation par ménage (jamais sous zéro). */
    @Modifying
    @Query("UPDATE PropertyStockItem s "
            + "SET s.quantity = CASE WHEN s.quantity > s.consumptionPerStay "
            + "    THEN s.quantity - s.consumptionPerStay ELSE 0 END "
            + "WHERE s.propertyId = :propertyId AND s.organizationId = :orgId "
            + "AND s.consumptionPerStay > 0")
    int consumeForStay(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);
}
