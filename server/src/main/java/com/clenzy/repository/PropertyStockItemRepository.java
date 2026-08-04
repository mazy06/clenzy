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

    /** Décrément atomique de la consommation par ménage (jamais sous zéro). */
    @Modifying
    @Query("UPDATE PropertyStockItem s "
            + "SET s.quantity = CASE WHEN s.quantity > s.consumptionPerStay "
            + "    THEN s.quantity - s.consumptionPerStay ELSE 0 END "
            + "WHERE s.propertyId = :propertyId AND s.organizationId = :orgId "
            + "AND s.consumptionPerStay > 0")
    int consumeForStay(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);
}
