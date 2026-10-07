package com.clenzy.service;

import com.clenzy.model.DocumentType;
import com.clenzy.repository.FiscalProfileRepository;
import com.clenzy.repository.OrganizationRepository;
import org.springframework.stereotype.Service;
import java.util.LinkedHashMap;
import java.util.Map;

/** Identité de l'émetteur : jamais celle de l'utilisateur qui clique sur Télécharger. */
@Service
public class BaitlyDocumentIdentity {
    private final OrganizationRepository organizations;
    private final FiscalProfileRepository profiles;

    public BaitlyDocumentIdentity(OrganizationRepository organizations, FiscalProfileRepository profiles) {
        this.organizations = organizations;
        this.profiles = profiles;
    }

    public Map<String, Object> organization(Long orgId, String country) {
        if (orgId == null) return Map.of();
        var organization = organizations.findById(orgId).orElseThrow(
            () -> new com.clenzy.exception.DocumentGenerationException("Organisation émettrice introuvable"));
        var profile = country == null || country.isBlank()
            ? profiles.findByOrganizationId(orgId)
            : profiles.findByOrganizationIdAndCountryCode(orgId, country.toUpperCase(java.util.Locale.ROOT));
        var result = new LinkedHashMap<String, Object>();
        String name = profile.map(p -> p.getLegalEntityName()).filter(s -> !s.isBlank()).orElse(organization.getName());
        if (name == null || name.isBlank())
            throw new com.clenzy.exception.DocumentGenerationException("Renseignez le nom de l'organisation émettrice avant de générer son document");
        result.put("nom", displayName(name));
        result.put("adresse", profile.map(p -> p.getLegalAddress()).orElse(""));
        result.put("siret", profile.map(p -> p.getTaxIdNumber()).orElse(""));
        result.put("email", "");
        result.put("telephone", "");
        return result;
    }

    public String name(Long orgId, String country) {
        return String.valueOf(organization(orgId, country).getOrDefault("nom", "Baitly"));
    }

    public void apply(Long orgId, String country, DocumentType type, String referenceType, Map<String, Object> context) {
        var issuer = organization(orgId, country);
        if (!issuer.isEmpty()) context.put("entreprise", issuer);
        // Le prestataire émet son propre devis. Le bon de commande reste émis par l'organisation acheteuse.
        if ("service_quote".equalsIgnoreCase(referenceType)) {
            if (!(context.get("emetteur_prestataire") instanceof Map<?, ?> provider)
                    || !(provider.get("nom") instanceof String name) || name.isBlank())
                throw new com.clenzy.exception.DocumentGenerationException("Émetteur du devis prestataire introuvable");
            var providerTags = new LinkedHashMap<String, Object>();
            provider.forEach((key, value) -> providerTags.put(String.valueOf(key), value));
            providerTags.put("nom", displayName(name));
            context.put("entreprise", providerTags);
        }
        if (context.get("entreprise") instanceof Map<?, ?> company) {
            var identity = new LinkedHashMap<String, Object>();
            identity.put("nom", displayName(String.valueOf(company.getOrDefault("nom", null))));
            identity.put("document", type.getLabel());
            context.put("identite", identity);
        }
    }

    /** Ancienne marque de la plateforme ; les noms tiers ne sont pas remplacés par Baitly. */
    public static String displayName(String value) {
        if (value == null || value.isBlank() || value.equals("null")) return "Baitly";
        return value.replaceAll("(?i)\\bclenzy\\b", "Baitly");
    }
}
