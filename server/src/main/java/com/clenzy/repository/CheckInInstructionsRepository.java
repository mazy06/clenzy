package com.clenzy.repository;

import com.clenzy.model.CheckInInstructions;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CheckInInstructionsRepository extends JpaRepository<CheckInInstructions, Long> {

    Optional<CheckInInstructions> findByPropertyId(Long propertyId);

    Optional<CheckInInstructions> findByPropertyIdAndOrganizationId(Long propertyId, Long organizationId);
}
