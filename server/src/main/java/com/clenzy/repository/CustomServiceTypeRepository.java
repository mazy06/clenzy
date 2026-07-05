package com.clenzy.repository;

import com.clenzy.model.CustomServiceType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CustomServiceTypeRepository extends JpaRepository<CustomServiceType, Long> {

    List<CustomServiceType> findByOrganizationIdAndCategoryOrderByLabelAsc(Long organizationId, String category);

    Optional<CustomServiceType> findByOrganizationIdAndCategoryAndLabelIgnoreCase(
            Long organizationId, String category, String label);
}
