package com.clenzy.service;

import com.clenzy.dto.PropertyLicenseDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.PropertyLicense;
import com.clenzy.repository.PropertyLicenseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Licences & autorisations d'un logement (vague M-A des modèles métier de la
 * constellation). CRUD org-scopé — l'ownership du LOGEMENT est validé par le
 * controller (OrganizationAccessGuard) avant chaque appel ; ici on garantit que la
 * licence manipulée appartient bien à l'org ET au logement annoncés.
 */
@Service
public class PropertyLicenseService {

    private final PropertyLicenseRepository repository;

    public PropertyLicenseService(PropertyLicenseRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<PropertyLicenseDto> list(Long propertyId, Long orgId) {
        return repository.findByPropertyIdAndOrganizationIdOrderByExpiresAtAsc(propertyId, orgId)
                .stream().map(PropertyLicenseDto::from).toList();
    }

    @Transactional
    public PropertyLicenseDto create(Long propertyId, Long orgId, PropertyLicenseDto request) {
        PropertyLicense license = new PropertyLicense();
        license.setOrganizationId(orgId);
        license.setPropertyId(propertyId);
        applyRequest(license, request);
        return PropertyLicenseDto.from(repository.save(license));
    }

    @Transactional
    public PropertyLicenseDto update(Long id, Long propertyId, Long orgId, PropertyLicenseDto request) {
        PropertyLicense license = requireOwned(id, propertyId, orgId);
        applyRequest(license, request);
        return PropertyLicenseDto.from(repository.save(license));
    }

    @Transactional
    public void delete(Long id, Long propertyId, Long orgId) {
        repository.delete(requireOwned(id, propertyId, orgId));
    }

    private PropertyLicense requireOwned(Long id, Long propertyId, Long orgId) {
        PropertyLicense license = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new NotFoundException("Licence introuvable : " + id));
        if (!license.getPropertyId().equals(propertyId)) {
            throw new NotFoundException("Licence introuvable pour ce logement : " + id);
        }
        return license;
    }

    private void applyRequest(PropertyLicense license, PropertyLicenseDto request) {
        license.setLicenseType(request.licenseType() != null
                ? PropertyLicense.LicenseType.valueOf(request.licenseType())
                : PropertyLicense.LicenseType.OTHER);
        license.setLicenseNumber(request.licenseNumber());
        license.setIssuedBy(request.issuedBy());
        license.setIssuedAt(request.issuedAt());
        license.setExpiresAt(request.expiresAt());
        license.setRenewalLeadDays(Math.max(0, Math.min(365, request.renewalLeadDays())));
        license.setDocumentRef(request.documentRef());
        license.setNotes(request.notes());
    }
}
