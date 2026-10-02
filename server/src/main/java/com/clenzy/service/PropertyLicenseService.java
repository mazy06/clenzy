package com.clenzy.service;

import com.clenzy.dto.PropertyLicenseDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.PropertyLicense;
import com.clenzy.repository.PropertyLicenseRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.property.TourismLicense;
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
                .map(context::toDto)
                .toList();
    }

    @Transactional
    public PropertyLicenseDto create(Long propertyId, Long orgId, PropertyLicenseDto request) {
        PropertyLicense license = new PropertyLicense();
        license.setOrganizationId(orgId);
        license.setPropertyId(propertyId);
        Context context = contextOf(propertyId, orgId);
        applyRequest(license, request, context);
        if (license.getLicenseType() == PropertyLicense.LicenseType.TOURISM_REGISTRATION
                && repository.existsByPropertyIdAndOrganizationIdAndLicenseType(
                        propertyId, orgId, PropertyLicense.LicenseType.TOURISM_REGISTRATION)) {
            // Source unique : un logement n'a qu'un numero d'enregistrement, on le modifie.
            throw new IllegalArgumentException(
                    "Ce logement a deja un numero d'enregistrement : modifiez-le plutot que d'en ajouter un.");
        }
        return context.toDto(repository.save(license));
    }

    @Transactional
    public PropertyLicenseDto update(Long id, Long propertyId, Long orgId, PropertyLicenseDto request) {
        PropertyLicense license = requireOwned(id, propertyId, orgId);
        Context context = contextOf(propertyId, orgId);
        applyRequest(license, request, context);
        return context.toDto(repository.save(license));
    }

    @Transactional
    public void delete(Long id, Long propertyId, Long orgId) {
        repository.delete(requireOwned(id, propertyId, orgId));
    }

    /** Ce que le logement apporte a la lecture d'une licence : son pays, son fuseau, sa commune. */
    private record Context(String countryCode, String zone, String communeInseeCode) {
        PropertyLicenseDto toDto(PropertyLicense license) {
            return PropertyLicenseDto.from(license, countryCode, zone, communeInseeCode);
        }
    }

    /**
     * Charge le logement BORNE A L'ORGANISATION — {@code findById} contournerait le
     * filtre Hibernate. Un logement introuvable ne fait pas echouer la lecture des
     * licences : on perd seulement le controle de forme, pas la donnee.
     */
    private Context contextOf(Long propertyId, Long orgId) {
        return properties.findByIdWithOwner(propertyId, orgId)
                .map(property -> new Context(property.getCountryCode(), property.getTimezone(),
                        property.getCommuneInseeCode()))
                .orElseGet(() -> new Context(null, null, null));
    }

    private PropertyLicense requireOwned(Long id, Long propertyId, Long orgId) {
        PropertyLicense license = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new NotFoundException("Licence introuvable : " + id));
        if (!license.getPropertyId().equals(propertyId)) {
            throw new NotFoundException("Licence introuvable pour ce logement : " + id);
        }
        return license;
    }

    /**
     * Applique la requete. Le numero d'enregistrement d'un logement francais est controle
     * STRICTEMENT (decision produit 2026-10-01) : forme nationale et prefixe INSEE de la
     * commune du logement. Un numero faux est refuse a la saisie — il serait sinon affiche
     * sur les annonces, ou son absence de validite engage l'exploitant.
     */
    private void applyRequest(PropertyLicense license, PropertyLicenseDto request, Context context) {
        license.setLicenseType(request.licenseType() != null
                ? PropertyLicense.LicenseType.valueOf(request.licenseType())
                : PropertyLicense.LicenseType.OTHER);
        String number = request.licenseNumber();
        if (license.getLicenseType() == PropertyLicense.LicenseType.TOURISM_REGISTRATION) {
            number = TourismLicense.normalize(context.countryCode(), number);
            TourismLicense.Verdict verdict =
                    TourismLicense.check(context.countryCode(), number, context.communeInseeCode());
            if (TourismLicense.rejects(context.countryCode(), verdict)) {
                throw new IllegalArgumentException(verdict == TourismLicense.Verdict.COMMUNE_MISMATCH
                        ? "Le numero d'enregistrement doit commencer par le code INSEE de la commune du logement ("
                                + context.communeInseeCode() + ")."
                        : "Numero d'enregistrement invalide : 13 caracteres attendus (code INSEE de la commune, "
                                + "6 chiffres, 2 caracteres de cle), par exemple 75056000123AB.");
            }
        }
        license.setLicenseNumber(number);
        license.setIssuedBy(request.issuedBy());
        license.setIssuedAt(request.issuedAt());
        license.setExpiresAt(request.expiresAt());
        license.setRenewalLeadDays(Math.max(0, Math.min(365, request.renewalLeadDays())));
        license.setDocumentRef(request.documentRef());
        license.setNotes(request.notes());
    }
}
