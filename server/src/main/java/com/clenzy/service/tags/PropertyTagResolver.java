package com.clenzy.service.tags;

import com.clenzy.repository.PropertyRepository;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Tags d'un logement : property.* + client.* (proprietaire).
 */
@Component
public class PropertyTagResolver implements ReferenceTagResolver {

    private final PropertyRepository propertyRepository;
    private final EntityTagBuilders builders;
    private final CleaningQuoteTagBuilder cleaningQuoteTagBuilder;

    public PropertyTagResolver(PropertyRepository propertyRepository,
                               EntityTagBuilders builders,
                               CleaningQuoteTagBuilder cleaningQuoteTagBuilder) {
        this.propertyRepository = propertyRepository;
        this.builders = builders;
        this.cleaningQuoteTagBuilder = cleaningQuoteTagBuilder;
    }

    @Override
    public String referenceType() {
        return "property";
    }

    @Override
    public void resolve(Long propertyId, Map<String, Object> context) {
        if (propertyId == null) return;

        propertyRepository.findById(propertyId).ifPresent(property -> {
            context.put("property", builders.propertyTags(property));

            if (property.getOwner() != null) {
                context.put("client", builders.clientTags(property.getOwner()));
            }

            // Moteur Ménage 3A (P8) : tags ${menage.*} du devis ménage interne.
            // Toujours posés (repli vide) — inoffensif pour les autres documents property.
            context.put("menage", cleaningQuoteTagBuilder.menageTags(property));
        });
    }
}
