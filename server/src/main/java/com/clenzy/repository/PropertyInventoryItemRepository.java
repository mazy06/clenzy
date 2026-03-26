package com.clenzy.repository;

import com.clenzy.model.PropertyInventoryItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PropertyInventoryItemRepository extends JpaRepository<PropertyInventoryItem, Long> {

    List<PropertyInventoryItem> findByPropertyIdOrderByCategoryAscNameAsc(Long propertyId);

    Optional<PropertyInventoryItem> findByPropertyIdAndId(Long propertyId, Long id);
}
