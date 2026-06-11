package com.clenzy.service;

import com.clenzy.model.DocumentType;
import com.clenzy.service.tags.ReferenceTagResolver;
import com.clenzy.service.tags.TagFormatting;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service de resolution des tags de templates de documents.
 * Resout les tags Freemarker (ex: ${client.nom}, ${intervention.date_fin})
 * en valeurs concretes a partir des entites metier.
 * <p>
 * Formatage (voir {@link TagFormatting}) :
 * - Dates : dd/MM/yyyy HH:mm ou dd/MM/yyyy
 * - Montants : #,##0.00 € (locale FR)
 * <p>
 * Dispatch OCP (T-SOLID-5) : la resolution par type de reference est deleguee
 * a un registre de {@link ReferenceTagResolver} (un bean par type — intervention,
 * reservation, service_request, property, user, provider_expense, received_form,
 * management_contract). Ajouter un type = ajouter un bean, sans modifier ce service.
 */
@Service
public class TagResolverService {

    private static final Logger log = LoggerFactory.getLogger(TagResolverService.class);

    private final Map<String, ReferenceTagResolver> resolversByType;

    @Value("${clenzy.company.name:Clenzy}")
    private String companyName;

    @Value("${clenzy.company.address:}")
    private String companyAddress;

    @Value("${clenzy.company.siret:}")
    private String companySiret;

    @Value("${clenzy.company.email:info@clenzy.fr}")
    private String companyEmail;

    @Value("${clenzy.company.phone:}")
    private String companyPhone;

    public TagResolverService(List<ReferenceTagResolver> referenceTagResolvers) {
        this.resolversByType = referenceTagResolvers.stream()
                .collect(Collectors.toUnmodifiableMap(ReferenceTagResolver::referenceType, resolver -> resolver));
    }

    /**
     * Resout tous les tags pour un type de document et une reference donnee.
     *
     * @param documentType Type de document a generer
     * @param referenceId  ID de l'entite de reference (intervention, service request, etc.)
     * @param referenceType Type de reference ("intervention", "service_request", "property", "user")
     * @return Map hierarchique des tags resolus (ex: {"client": {"nom": "Dupont", ...}, "property": {...}})
     */
    public Map<String, Object> resolveTagsForDocument(DocumentType documentType, Long referenceId, String referenceType) {
        log.debug("Resolving tags for {} (ref: {} #{})", documentType, referenceType, referenceId);

        Map<String, Object> context = new LinkedHashMap<>();

        // Tags systeme (toujours presents)
        context.put("system", resolveSystemTags());
        context.put("entreprise", resolveEntrepriseTags());

        // Resoudre selon le type de reference (registre OCP)
        ReferenceTagResolver resolver = resolversByType.get(
                referenceType != null ? referenceType.toLowerCase(Locale.ROOT) : "");
        if (resolver != null) {
            resolver.resolve(referenceId, context);
        } else {
            log.warn("Unknown reference type: {}", referenceType);
        }

        log.debug("Resolved {} top-level tag groups", context.size());
        return context;
    }

    // ─── Tags systeme / entreprise ──────────────────────────────────────────

    private Map<String, Object> resolveSystemTags() {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("date", LocalDateTime.now().format(TagFormatting.DATE_FORMAT));
        tags.put("datetime", LocalDateTime.now().format(TagFormatting.DATETIME_FORMAT));
        tags.put("annee", String.valueOf(LocalDateTime.now().getYear()));
        tags.put("numero_auto", UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        return tags;
    }

    private Map<String, Object> resolveEntrepriseTags() {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("nom", companyName);
        tags.put("adresse", companyAddress);
        tags.put("siret", companySiret);
        tags.put("email", companyEmail);
        tags.put("telephone", companyPhone);
        return tags;
    }
}
