package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.integration.airbnb.model.AirbnbConnection;
import com.clenzy.integration.airbnb.repository.AirbnbConnectionRepository;
import com.clenzy.integration.minut.model.MinutConnection;
import com.clenzy.integration.minut.repository.MinutConnectionRepository;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Intégrations dont la connexion est morte.
 *
 * <p>Jeton expiré, accès révoqué depuis l'autre côté, erreur persistante : la
 * synchronisation s'arrête, et le produit continue d'afficher l'intégration
 * comme si elle fonctionnait. Pour un canal de réservation, cela veut dire des
 * disponibilités qui ne remontent plus — donc de la surréservation.</p>
 *
 * <p>Technique, donc réservée au staff plateforme : rétablir une connexion
 * OAuth n'est pas un geste de gestion.</p>
 */
@Component
public class IntegrationConnectionActionSource implements ActionItemSource {

    private final AirbnbConnectionRepository airbnbConnectionRepository;
    private final MinutConnectionRepository minutConnectionRepository;

    public IntegrationConnectionActionSource(
            AirbnbConnectionRepository airbnbConnectionRepository,
            MinutConnectionRepository minutConnectionRepository) {
        this.airbnbConnectionRepository = airbnbConnectionRepository;
        this.minutConnectionRepository = minutConnectionRepository;
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.INTEGRATION_DISCONNECTED);
    }

    @Override
    public Scope scope() {
        return Scope.TECHNICAL;
    }

    @Override
    public List<ActionItemDto> collect(ActionItemContext ctx) {
        final List<ActionItemDto> items = new ArrayList<>();

        airbnbConnectionRepository.findBrokenForOrg(ctx.organizationId(),
                        AirbnbConnection.AirbnbConnectionStatus.ACTIVE, ctx.nowDateTime()).stream()
                .map(connection -> item("airbnb", connection.getId(), "Airbnb",
                        connection.getStatus() == null ? null : connection.getStatus().name()))
                .forEach(items::add);

        minutConnectionRepository.findBrokenForOrg(ctx.organizationId(),
                        MinutConnection.MinutConnectionStatus.ACTIVE, ctx.nowDateTime()).stream()
                .map(connection -> item("minut", connection.getId(), "Minut",
                        connection.getStatus() == null ? null : connection.getStatus().name()))
                .forEach(items::add);

        return items;
    }

    private static ActionItemDto item(String provider, Long id, String label, String status) {
        return new ActionItemDto(
                "connection:" + provider + ":" + id,
                ActionItemKind.INTEGRATION_DISCONNECTED,
                "critical",
                label,
                status,
                null,
                id,
                null, null, null, null,
                // La sous-nature identifie le fournisseur : c'est elle qui dira à
                // l'écran vers quel écran de reconnexion envoyer.
                provider,
                null);
    }
}
