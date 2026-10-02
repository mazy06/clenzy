package com.clenzy.repository;

import com.clenzy.model.PropertyLicense;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PropertyLicenseRepository extends JpaRepository<PropertyLicense, Long> {

    List<PropertyLicense> findByPropertyIdAndOrganizationIdOrderByExpiresAtAsc(
            Long propertyId, Long organizationId);

    Optional<PropertyLicense> findByIdAndOrganizationId(Long id, Long organizationId);

    boolean existsByPropertyIdAndOrganizationIdAndLicenseType(
            Long propertyId, Long organizationId, PropertyLicense.LicenseType licenseType);

    List<PropertyLicense> findByOrganizationIdAndLicenseTypeAndPropertyIdIn(
            Long organizationId, PropertyLicense.LicenseType licenseType, java.util.Collection<Long> propertyIds);

    Optional<PropertyLicense> findFirstByPropertyIdAndOrganizationIdAndLicenseType(
            Long propertyId, Long organizationId, PropertyLicense.LicenseType licenseType);
}
