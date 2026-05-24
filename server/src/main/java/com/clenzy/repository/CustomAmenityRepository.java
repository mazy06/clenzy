package com.clenzy.repository;

import com.clenzy.model.CustomAmenity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CustomAmenityRepository extends JpaRepository<CustomAmenity, Long> {

    List<CustomAmenity> findByOrganizationIdOrderByLabelFrAsc(Long organizationId);

    Optional<CustomAmenity> findByOrganizationIdAndCode(Long organizationId, String code);

    boolean existsByOrganizationIdAndCode(Long organizationId, String code);
}
