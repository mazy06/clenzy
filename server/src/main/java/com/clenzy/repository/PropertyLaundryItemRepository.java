package com.clenzy.repository;

import com.clenzy.model.PropertyLaundryItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PropertyLaundryItemRepository extends JpaRepository<PropertyLaundryItem, Long> {

    List<PropertyLaundryItem> findByPropertyId(Long propertyId);

    Optional<PropertyLaundryItem> findByPropertyIdAndId(Long propertyId, Long id);
}
