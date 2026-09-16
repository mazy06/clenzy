package com.clenzy.marketplace.service;

import com.clenzy.marketplace.dto.ProviderSearchCriteria;
import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.model.MarketplaceProviderOffer;
import com.clenzy.marketplace.model.MarketplaceProviderZone;
import com.clenzy.util.StringUtils;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Traduction des criteres de recherche en predicats JPA.
 *
 * <p><b>Sous-requetes plutot que jointures</b> pour les categories, les zones et
 * les disponibilites : un professionnel a plusieurs prestations et plusieurs
 * zones, et une jointure produirait autant de lignes que de combinaisons — donc
 * des doublons dans la page et un total faux. {@code EXISTS} repond a la seule
 * question posee (« en a-t-il au moins une qui corresponde ? ») sans multiplier
 * les lignes.</p>
 */
final class MarketplaceProviderSpecifications {

    private MarketplaceProviderSpecifications() {}

    /** Fenetre d'alerte de conformite : une piece expire « bientot » sous trente jours. */
    private static final int COMPLIANCE_WARNING_DAYS = 30;

    /**
     * Restreint une recherche a ce qu'une ORGANISATION a le droit de voir.
     *
     * <p>Se compose avec {@link #from} plutot que de la remplacer : les filtres
     * de recherche — metier, ville, disponibilite — sont les memes des deux
     * cotes, seule la visibilite change.</p>
     *
     * <p>Trois bornes, dans cet ordre :</p>
     * <ol>
     *   <li>seules les fiches ACTIVES ;</li>
     *   <li>pas de fiche EXCLUSIVE, sauf la sienne — l'exclusivite est portee
     *       par le mode d'engagement, pas par une regle ;</li>
     *   <li>pas les fiches masquees par une regle, sauf la sienne : une
     *       organisation voit toujours son propre prestataire, meme si la
     *       plateforme l'a retire du catalogue general.</li>
     * </ol>
     */
    static Specification<MarketplaceProvider> visibleTo(Long organizationId, List<Long> hiddenIds) {
        return (root, cq, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            var own = organizationId == null
                ? cb.disjunction()
                : cb.equal(root.get("homeOrganizationId"), organizationId);

            predicates.add(cb.or(own,
                cb.equal(root.get("status"), com.clenzy.marketplace.model.ProviderStatus.ACTIVE)));

            predicates.add(cb.or(own, cb.notEqual(root.get("engagementMode"),
                com.clenzy.marketplace.model.EngagementMode.EXCLUSIVE)));

            if (hiddenIds != null && !hiddenIds.isEmpty()) {
                predicates.add(cb.or(own, cb.not(root.get("id").in(hiddenIds))));
            }

            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    static Specification<MarketplaceProvider> covers(com.clenzy.model.Property property) {
        return (root, cq, cb) -> {
            if (property == null) return cb.conjunction();
            String country = property.getCountryCode();
            if (country == null || country.isBlank()) country = "FR";
            return cb.and(cb.isTrue(cb.function("public.baitly_provider_accepts_property",Boolean.class,root.get("id"),
                property.getType()==null ? cb.nullLiteral(String.class) : cb.literal(property.getType().name()))),
                cb.isTrue(cb.function("public.baitly_provider_covers", Boolean.class,
                root.get("id"), cb.literal(country),
                property.getDepartment() == null ? cb.nullLiteral(String.class) : cb.literal(property.getDepartment()),
                property.getArrondissement() == null ? cb.nullLiteral(String.class) : cb.literal(property.getArrondissement()),
                property.getCity() == null ? cb.nullLiteral(String.class) : cb.literal(property.getCity()))));
        };
    }

    static Specification<MarketplaceProvider> from(ProviderSearchCriteria c, LocalDate today) {
        return (root, cq, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (isNotBlank(c.query())) {
                String raw = c.query().trim();
                String pattern = "%" + raw.toLowerCase(Locale.ROOT) + "%";

                // `email` est chiffre au repos : un LIKE dessus compare du
                // ciphertext et ne trouve jamais rien. La recherche textuelle
                // porte donc sur les seules colonnes lisibles — enseigne, raison
                // sociale, ville.
                List<Predicate> textMatches = new ArrayList<>();
                textMatches.add(cb.like(cb.lower(root.get("displayName")), pattern));
                textMatches.add(cb.like(cb.lower(cb.coalesce(root.get("legalName"), "")), pattern));
                textMatches.add(cb.like(cb.lower(cb.coalesce(root.get("baseCity"), "")), pattern));

                // Une adresse complete reste cherchable par son empreinte. La
                // recherche partielle sur un courriel est impossible par
                // construction, et c'est le prix du chiffrement au repos.
                if (raw.contains("@")) {
                    textMatches.add(cb.equal(root.get("emailHash"),
                        StringUtils.computeEmailHash(raw)));
                }

                predicates.add(cb.or(textMatches.toArray(Predicate[]::new)));
            }

            if (isNotEmpty(c.statuses())) {
                predicates.add(root.get("status").in(c.statuses()));
            }

            if (isNotEmpty(c.engagementModes())) {
                predicates.add(root.get("engagementMode").in(c.engagementModes()));
            }

            if (c.minRating() != null) {
                // Une fiche sans note est exclue plutot que traitee comme zero :
                // « pas encore note » n'est pas « mal note ».
                predicates.add(cb.and(
                    cb.isNotNull(root.get("ratingAvg")),
                    cb.greaterThanOrEqualTo(root.get("ratingAvg"), c.minRating())
                ));
            }

            if (c.verifiedOnly()) {
                predicates.add(cb.isNotNull(root.get("verifiedAt")));
            }

            if (c.acceptsUrgent()) {
                predicates.add(cb.isTrue(root.get("acceptsUrgent")));
            }

            if (c.hasOrganization() != null) {
                predicates.add(c.hasOrganization()
                    ? cb.isNotNull(root.get("homeOrganizationId"))
                    : cb.isNull(root.get("homeOrganizationId")));
            }

            if (c.organizationId() != null) {
                predicates.add(cb.equal(root.get("homeOrganizationId"), c.organizationId()));
            }

            if (c.complianceAlert() != null) {
                LocalDate threshold = today.plusDays(COMPLIANCE_WARNING_DAYS);
                // Une piece ABSENTE ne declenche pas d'alerte : la plupart des
                // dossiers sont incomplets a l'inscription, et les signaler tous
                // rendrait le filtre inutilisable.
                Predicate expiring = cb.or(
                    cb.and(cb.isNotNull(root.get("insuranceExpiresAt")),
                        cb.lessThan(root.get("insuranceExpiresAt"), threshold)),
                    cb.and(cb.isNotNull(root.get("vigilanceExpiresAt")),
                        cb.lessThan(root.get("vigilanceExpiresAt"), threshold))
                );
                predicates.add(c.complianceAlert() ? expiring : cb.not(expiring));
            }

            if (isNotEmpty(c.categoryCodes()) || isNotEmpty(c.serviceCodes())) {
                Subquery<Long> sub = cq.subquery(Long.class);
                var offer = sub.from(MarketplaceProviderOffer.class);
                var category = offer.join("category");
                var tariff = offer.join("tariff", jakarta.persistence.criteria.JoinType.LEFT);
                var item = offer.join("serviceItem", jakarta.persistence.criteria.JoinType.LEFT);
                var itemCategory = item.join("category", jakarta.persistence.criteria.JoinType.LEFT);
                List<Predicate> matches = new ArrayList<>();
                matches.add(cb.equal(offer.get("provider"), root));
                matches.add(cb.isTrue(offer.get("active")));
                matches.add(cb.or(cb.isNull(tariff.get("id")), cb.isTrue(tariff.get("enabled"))));
                matches.add(cb.isTrue(category.get("active")));
                matches.add(cb.or(cb.isNull(item.get("id")), cb.and(
                    cb.isTrue(item.get("active")), cb.equal(itemCategory.get("code"), category.get("code")))));
                // Les deux filtres doivent correspondre à la même offre.
                if (isNotEmpty(c.categoryCodes())) matches.add(category.get("code").in(c.categoryCodes()));
                if (isNotEmpty(c.serviceCodes())) matches.add(item.get("code").in(c.serviceCodes()));
                sub.select(cb.literal(1L)).where(cb.and(matches.toArray(Predicate[]::new)));
                predicates.add(cb.exists(sub));
            }

            if (isNotBlank(c.countryCode()) || isNotBlank(c.city()) || isNotBlank(c.department())) {
                Subquery<Long> sub = cq.subquery(Long.class);
                var zone = sub.from(MarketplaceProviderZone.class);
                List<Predicate> zonePredicates = new ArrayList<>();
                zonePredicates.add(cb.or(cb.equal(zone.get("userId"), root.get("userId")),
                    cb.and(cb.isNull(root.get("userId")), cb.equal(zone.get("provider"), root))));
                if (isNotBlank(c.countryCode())) {
                    zonePredicates.add(cb.equal(cb.upper(zone.get("countryCode")), c.countryCode().trim().toUpperCase(Locale.ROOT)));
                }
                if (isNotBlank(c.city())) {
                    zonePredicates.add(cb.equal(
                        cb.lower(zone.get("city")), c.city().trim().toLowerCase(Locale.ROOT)));
                }
                if (isNotBlank(c.department())) {
                    zonePredicates.add(cb.equal(zone.get("department"), c.department().trim()));
                }
                sub.select(cb.literal(1L)).where(cb.and(zonePredicates.toArray(Predicate[]::new)));

                // L'adresse du siège n'est pas une déclaration de zone d'intervention.
                predicates.add(cb.exists(sub));
            }

            if (c.availableOnDay() != null) {
                // Même semaine que l'attribution individuelle, avant pagination et comptage.
                // Ce filtre de jour hebdomadaire ne promet ni absence datée ni réservation libre.
                predicates.add(cb.isTrue(cb.function("public.baitly_provider_available_on_day", Boolean.class,
                        root.get("id"), cb.literal(c.availableOnDay()))));
            }

            if ("missions".equals(c.sort()) && cq.getResultType() != Long.class && cq.getResultType() != long.class) {
                cq.orderBy(cb.desc(cb.function("public.baitly_provider_completed_missions", Integer.class, root.get("id"))),
                    cb.desc(root.get("id")));
            }
            if ("rating".equals(c.sort()) && cq.getResultType() != Long.class && cq.getResultType() != long.class) {
                cq.orderBy(cb.asc(cb.<Integer>selectCase().when(cb.isNull(root.get("ratingAvg")), 1).otherwise(0)),
                        cb.desc(root.get("ratingAvg")), cb.desc(root.get("ratingCount")), cb.desc(root.get("id")));
            }
            return predicates.isEmpty() ? cb.conjunction() : cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static boolean isNotBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static boolean isNotEmpty(List<?> list) {
        return list != null && !list.isEmpty();
    }
}
