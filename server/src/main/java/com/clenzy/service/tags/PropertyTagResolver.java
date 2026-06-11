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

    public PropertyTagResolver(PropertyRepository propertyRepository,
                               EntityTagBuilders builders) {
        this.propertyRepository = propertyRepository;
        this.builders = builders;
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
        });
    }
}
