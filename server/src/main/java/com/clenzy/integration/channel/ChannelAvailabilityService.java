package com.clenzy.integration.channel;

import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * Ouverture / fermeture de la vente PAR CANAL sur une plage de dates (S3).
 *
 * <p>Contrairement a {@link ChannelSyncService#syncProperty}, qui repousse l'etat
 * reel du CalendarEngine vers TOUS les canaux connectes, ce service cible UN
 * canal precis :</p>
 * <ul>
 *   <li><b>close</b> : pousse une fermeture forcee ({@code available=false},
 *       equivalent stop-sell) sur le canal donne uniquement via
 *       {@link ChannelConnector#pushAvailabilityClosure} — les autres canaux
 *       restent ouverts a la vente ;</li>
 *   <li><b>open</b> : repousse l'etat reel du calendrier sur ce canal via
 *       {@link ChannelConnector#pushCalendarUpdate}, ce qui annule toute
 *       fermeture forcee anterieure.</li>
 * </ul>
 *
 * <p><b>Idempotence</b> : aucun etat local n'est persiste — l'etat de fermeture
 * vit chez l'OTA. Re-pousser le meme etat (double close, double open) est sans
 * effet de bord.</p>
 *
 * <p><b>Transactions</b> : ce service n'est volontairement PAS transactionnel —
 * l'appel HTTP vers l'OTA se fait hors de toute transaction DB (regle absolue
 * « jamais d'appel externe dans une transaction »). Le resultat est journalise
 * apres coup dans {@code channel_sync_log} via une transaction courte dediee
 * (save Spring Data).</p>
 */
@Service
public class ChannelAvailabilityService {

    private static final Logger log = LoggerFactory.getLogger(ChannelAvailabilityService.class);

    /** Borne de securite sur la plage poussee aux OTAs. */
    static final int MAX_RANGE_DAYS = 365;

    private final ChannelConnectorRegistry connectorRegistry;
    private final ChannelMappingRepository channelMappingRepository;
    private final PropertyRepository propertyRepository;
    private final OrganizationAccessGuard organizationAccessGuard;
    private final ChannelSyncService channelSyncService;

    public ChannelAvailabilityService(ChannelConnectorRegistry connectorRegistry,
                                      ChannelMappingRepository channelMappingRepository,
                                      PropertyRepository propertyRepository,
                                      OrganizationAccessGuard organizationAccessGuard,
                                      ChannelSyncService channelSyncService) {
        this.connectorRegistry = connectorRegistry;
        this.channelMappingRepository = channelMappingRepository;
        this.propertyRepository = propertyRepository;
        this.organizationAccessGuard = organizationAccessGuard;
        this.channelSyncService = channelSyncService;
    }

    /**
     * Ouvre ou ferme la vente sur UN canal pour une plage de dates.
     *
     * @param orgId      organisation du demandeur (fait foi pour l'ownership)
     * @param propertyId propriete PMS
     * @param channel    canal cible (doit etre connecte pour ce bien)
     * @param dateFrom   debut de plage (inclus)
     * @param dateTo     fin de plage (INCLUSE — semantique utilisateur ;
     *                   convertie en borne exclusive pour les connecteurs)
     * @param open       true = reouverture (re-push de la verite calendrier),
     *                   false = fermeture forcee sur ce canal
     * @return resultat du push vers le canal
     * @throws IllegalArgumentException plage invalide, propriete inconnue ou
     *                                  canal non connecte
     * @throws org.springframework.security.access.AccessDeniedException
     *                                  propriete hors de l'organisation
     */
    public SyncResult setChannelAvailability(Long orgId, Long propertyId, ChannelName channel,
                                             LocalDate dateFrom, LocalDate dateTo, boolean open) {
        validateRange(dateFrom, dateTo);

        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable: " + propertyId));
        // findById contourne le filtre Hibernate → validation d'org explicite obligatoire.
        organizationAccessGuard.requireSameOrganization(
                property.getOrganizationId(), orgId, "Propriete hors de votre organisation");

        ChannelMapping mapping = channelMappingRepository
                .findByPropertyIdAndChannel(propertyId, channel, orgId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Canal " + channel + " non connecte pour la propriete " + propertyId));

        ChannelConnector connector = connectorRegistry.getConnector(channel)
                .orElseThrow(() -> new IllegalStateException(
                        "Connecteur non enregistre pour le canal: " + channel));

        LocalDate toExclusive = dateTo.plusDays(1);
        // Appel HTTP externe HORS transaction DB (service non transactionnel).
        SyncResult result = open
                ? connector.pushCalendarUpdate(propertyId, dateFrom, toExclusive, orgId)
                : connector.pushAvailabilityClosure(propertyId, dateFrom, toExclusive, orgId);

        // Persistance du resultat APRES l'appel externe (transaction courte dediee).
        channelSyncService.logSync(mapping.getConnection(), mapping, SyncDirection.OUTBOUND,
                open ? "CHANNEL_OPEN" : "CHANNEL_CLOSE", result);

        log.info("ChannelAvailabilityService: {} canal {} propriete {} [{} → {}] → {}",
                open ? "ouverture" : "fermeture", channel, propertyId, dateFrom, dateTo,
                result.getStatus());
        return result;
    }

    private void validateRange(LocalDate dateFrom, LocalDate dateTo) {
        if (dateFrom == null || dateTo == null) {
            throw new IllegalArgumentException("dateFrom et dateTo sont requis");
        }
        if (dateFrom.isAfter(dateTo)) {
            throw new IllegalArgumentException("dateFrom doit etre <= dateTo");
        }
        long days = ChronoUnit.DAYS.between(dateFrom, dateTo) + 1;
        if (days > MAX_RANGE_DAYS) {
            throw new IllegalArgumentException(
                    "Plage maximale " + MAX_RANGE_DAYS + " jours (demande: " + days + " jours)");
        }
    }
}
