package com.clenzy.service;

import com.clenzy.dto.PropertyLicenseDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.PropertyLicense;
import com.clenzy.repository.PropertyLicenseRepository;
import com.clenzy.repository.PropertyRepository;
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
    private final PropertyRepository properties;

    public PropertyLicenseService(PropertyLicenseRepository repository, PropertyRepository properties) {
        this.properties = properties;
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<PropertyLicenseDto> list(Long propertyId, Long orgId) {
        // Pays et fuseau lus UNE fois : le format d'une licence est national et sa
        // peremption se juge chez le logement, mais les deux valent pour toute la liste.
        Context context = contextOf(propertyId, orgId);
        return repository.findByPropertyIdAndOrganizationIdOrderByExpiresAtAsc(propertyId, orgId)
                .stream()
                .map(license -> PropertyLicenseDto.from(license, context.countryCode(), context.zone()))
                .toList();
    }

    @Transactional
    public PropertyLicenseDto create(Long propertyId, Long orgId, PropertyLicenseDto request) {
        PropertyLicense license = new PropertyLicense();
        license.setOrganizationId(orgId);
        license.setPropertyId(propertyId);
        applyRequest(license, request);
        Context context = contextOf(propertyId, orgId);
        return PropertyLicenseDto.from(repository.save(license), context.countryCode(), context.zone());
    }

    @Transactional
    public PropertyLicenseDto update(Long id, Long propertyId, Long orgId, PropertyLicenseDto request) {
        PropertyLicense license = requireOwned(id, propertyId, orgId);
        applyRequest(license, request);
        Context context = contextOf(propertyId, orgId);
        return PropertyLicenseDto.from(repository.save(license), context.countryCode(), context.zone());
    }

    @Transactional
    public void delete(Long id, Long propertyId, Long orgId) {
        repository.delete(requireOwned(id, propertyId, orgId));
    }

    /** Ce que le logement apporte a la lecture d'une licence : son pays, son fuseau. */
    private record Context(String countryCode, String zone) {
    }

    /**
     * Charge le logement BORNE A L'ORGANISATION — {@code findById} contournerait le
     * filtre Hibernate. Un logement introuvable ne fait pas echouer la lecture des
     * licences : on perd seulement le controle de forme, pas la donnee.
     */
    private Context contextOf(Long propertyId, Long orgId) {
        return properties.findByIdWithOwner(propertyId, orgId)
                .map(property -> new Context(property.getCountryCode(), property.getTimezone()))
                .orElseGet(() -> new Context(null, null));
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
