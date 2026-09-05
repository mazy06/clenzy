package com.clenzy.service.report.snapshot;

import com.clenzy.model.Property;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Le perimetre resolu d'UN document.
 *
 * <p>Une demande groupee par proprietaire produit autant de perimetres que de
 * proprietaires ; chacun donne un document. Resoudre le perimetre AVANT de
 * construire le snapshot est ce qui rend le cumule et le separe strictement
 * equivalents en calcul : meme moteur, meme periode, seule la liste des biens
 * change.</p>
 *
 * @param ownerId       le proprietaire quand le document lui est propre, sinon {@code null}
 * @param recipientName le nom porte par la page de garde
 */
public record ReportScope(
        Long ownerId,
        /** Identifiant Keycloak du proprietaire : c'est par lui que le pace filtre. */
        String ownerKeycloakId,
        String recipientName,
        String recipientEmail,
        List<Property> properties
) {
    public ReportScope {
        properties = properties == null ? List.of() : List.copyOf(properties);
    }

    public Set<Long> propertyIds() {
        return properties.stream().map(Property::getId).collect(Collectors.toSet());
    }
}
