package com.clenzy.repository;

import com.clenzy.model.PropertyInventoryItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PropertyInventoryItemRepository extends JpaRepository<PropertyInventoryItem, Long> {
    @org.springframework.data.jpa.repository.Query(value="SELECT i.* FROM property_inventory_items i WHERE i.property_id=:property AND i.organization_id=:org ORDER BY i.category,i.name,i.id",nativeQuery=true)
    List<PropertyInventoryItem> findBaitlyMissionInventory(@org.springframework.data.repository.query.Param("property") Long property,@org.springframework.data.repository.query.Param("org") Long org);
    @org.springframework.data.jpa.repository.Query(value="SELECT i.* FROM property_inventory_items i WHERE i.id=:id AND i.property_id=:property AND i.organization_id=:org",nativeQuery=true)
    Optional<PropertyInventoryItem> findBaitlyMissionItem(@org.springframework.data.repository.query.Param("id") Long id,@org.springframework.data.repository.query.Param("property") Long property,@org.springframework.data.repository.query.Param("org") Long org);

    List<PropertyInventoryItem> findByPropertyIdOrderByCategoryAscNameAsc(Long propertyId);

    Optional<PropertyInventoryItem> findByPropertyIdAndId(Long propertyId, Long id);
}
