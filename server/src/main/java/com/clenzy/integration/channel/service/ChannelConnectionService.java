package com.clenzy.integration.channel.service;

import com.clenzy.integration.agoda.model.AgodaConnection;
import com.clenzy.integration.agoda.repository.AgodaConnectionRepository;
import com.clenzy.integration.booking.model.BookingConnection;
import com.clenzy.integration.booking.repository.BookingConnectionRepository;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.dto.ChannelConnectRequest;
import com.clenzy.integration.channel.dto.ChannelConnectionDto;
import com.clenzy.integration.channel.dto.ChannelConnectionTestResult;
import com.clenzy.integration.channel.model.ChannelConnection;
import com.clenzy.integration.channel.repository.ChannelConnectionRepository;
import com.clenzy.integration.expedia.model.ExpediaConnection;
import com.clenzy.integration.expedia.repository.ExpediaConnectionRepository;
import com.clenzy.integration.homeaway.model.HomeAwayConnection;
import com.clenzy.integration.homeaway.repository.HomeAwayConnectionRepository;
import com.clenzy.integration.hotelscom.model.HotelsComConnection;
import com.clenzy.integration.hotelscom.repository.HotelsComConnectionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.clenzy.exception.NotFoundException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Service unifie de gestion des connexions channel (hors Airbnb qui a son propre flow OAuth).
 *
 * Orchestre la creation/suppression des connexions channel-specifiques
 * (BookingConnection, ExpediaConnection, etc.) et de l'entite generique ChannelConnection.
 */
@Service
@Transactional(readOnly = true)
public class ChannelConnectionService {

    private static final Logger log = LoggerFactory.getLogger(ChannelConnectionService.class);

    private static final Set<ChannelName> SUPPORTED_CHANNELS = Set.of(
        ChannelName.BOOKING, ChannelName.EXPEDIA, ChannelName.HOTELS_COM,
        ChannelName.AGODA, ChannelName.HOMEAWAY
    );

    private final ChannelConnectionRepository channelConnectionRepository;
    private final BookingConnectionRepository bookingConnectionRepository;
    private final ExpediaConnectionRepository expediaConnectionRepository;
    private final HotelsComConnectionRepository hotelsComConnectionRepository;
    private final AgodaConnectionRepository agodaConnectionRepository;
    private final HomeAwayConnectionRepository homeAwayConnectionRepository;
    private final CredentialEncryptionService encryptionService;

    public ChannelConnectionService(
            ChannelConnectionRepository channelConnectionRepository,
            BookingConnectionRepository bookingConnectionRepository,
            ExpediaConnectionRepository expediaConnectionRepository,
            HotelsComConnectionRepository hotelsComConnectionRepository,
            AgodaConnectionRepository agodaConnectionRepository,
            HomeAwayConnectionRepository homeAwayConnectionRepository,
            CredentialEncryptionService encryptionService) {
        this.channelConnectionRepository = channelConnectionRepository;
        this.bookingConnectionRepository = bookingConnectionRepository;
        this.expediaConnectionRepository = expediaConnectionRepository;
        this.hotelsComConnectionRepository = hotelsComConnectionRepository;
        this.agodaConnectionRepository = agodaConnectionRepository;
        this.homeAwayConnectionRepository = homeAwayConnectionRepository;
        this.encryptionService = encryptionService;
    }

    // ========================================================================
    // Queries
    // ========================================================================

    /**
     * Liste toutes les connexions actives d'une organisation.
     */
    public List<ChannelConnectionDto> getConnectionsForOrganization(Long orgId) {
        List<ChannelConnection> connections = channelConnectionRepository.findActiveByOrganizationId(orgId);
        return connections.stream().map(this::toDto).toList();
    }

    /**
     * Statut de connexion pour un channel specifique.
     */
    public Optional<ChannelConnectionDto> getConnectionStatus(Long orgId, ChannelName channel) {
        return channelConnectionRepository.findByOrganizationIdAndChannel(orgId, channel)
                .map(this::toDto);
    }

    // ========================================================================
    // Connect
    // ========================================================================

    /**
     * Connecte un channel avec les credentials fournis.
     * Cree l'entite channel-specifique + l'entite generique ChannelConnection.
     */
    @Transactional
    public ChannelConnectionDto connect(Long orgId, ChannelName channel, ChannelConnectRequest request) {
        validateSupportedChannel(channel);

        // Verifier qu'il n'y a pas deja une connexion active
        Optional<ChannelConnection> existing = channelConnectionRepository
                .findByOrganizationIdAndChannel(orgId, channel);
        if (existing.isPresent() && existing.get().isActive()) {
            throw new IllegalStateException("Channel " + channel + " deja connecte pour cette organisation");
        }

        log.info("Connexion du channel {} pour l'organisation {}", channel, orgId);

        Map<String, String> creds = request.credentials();

        return switch (channel) {
            case BOOKING -> connectBooking(orgId, creds);
            case EXPEDIA -> connectExpedia(orgId, creds);
            case HOTELS_COM -> connectHotelsCom(orgId, creds);
            case AGODA -> connectAgoda(orgId, creds);
            case HOMEAWAY -> connectHomeAway(orgId, creds);
            default -> throw new IllegalArgumentException("Channel non supporte: " + channel);
        };
    }

    // ========================================================================
    // Disconnect
    // ========================================================================

    /**
     * Deconnecte un channel — passe le statut a INACTIVE.
     */
    @Transactional
    public void disconnect(Long orgId, ChannelName channel) {
        validateSupportedChannel(channel);

        Optional<ChannelConnection> ccOpt = channelConnectionRepository
                .findByOrganizationIdAndChannel(orgId, channel);

        if (ccOpt.isEmpty()) {
            throw new NotFoundException("Aucune connexion " + channel + " trouvee pour l'organisation " + orgId);
        }

        ChannelConnection cc = ccOpt.get();
        cc.setStatus(ChannelConnection.ConnectionStatus.INACTIVE);
        channelConnectionRepository.save(cc);

        // Desactiver aussi la connexion channel-specifique
        deactivateChannelSpecificConnection(orgId, channel);

        log.info("Channel {} deconnecte pour l'organisation {}", channel, orgId);
    }

    // ========================================================================
    // Test
    // ========================================================================

    /**
     * Teste les credentials sans les sauvegarder.
     *
     * TODO: Actuellement, cette methode ne fait qu'une validation de format (presence des champs requis).
     *       Pour chaque channel, il faudrait effectuer un appel API reel pour verifier que les credentials
     *       sont fonctionnels :
     *       - BOOKING : appeler l'API Booking.com Connectivity avec hotelId/username/password
     *       - EXPEDIA : appeler l'API EPS (Expedia Partner Solutions) avec apiKey/apiSecret
     *       - HOTELS_COM : appeler l'API Hotels.com Partner avec apiKey/apiSecret
     *       - AGODA : appeler l'API YCS (Yield CS) Agoda avec apiKey
     *       - HOMEAWAY : appeler l'API Vrbo/Abritel avec accessToken pour valider le token OAuth
     *       Chaque ChannelAdapter devrait exposer une methode `testCredentials(Map<String,String>)`
     *       retournant un ChannelConnectionTestResult.
     */
    public ChannelConnectionTestResult testConnection(Long orgId, ChannelName channel, ChannelConnectRequest request) {
        validateSupportedChannel(channel);
        Map<String, String> creds = request.credentials();

        try {
            switch (channel) {
                case BOOKING -> {
                    requireCredential(creds, "hotelId");
                    requireCredential(creds, "username");
                    requireCredential(creds, "password");
                    return new ChannelConnectionTestResult(true,
                            "Credentials Booking.com valides", creds.get("hotelId"));
                }
                case EXPEDIA -> {
                    requireCredential(creds, "propertyId");
                    requireCredential(creds, "apiKey");
                    requireCredential(creds, "apiSecret");
                    return new ChannelConnectionTestResult(true,
                            "Credentials Expedia valides", creds.get("propertyId"));
                }
                case HOTELS_COM -> {
                    requireCredential(creds, "propertyId");
                    requireCredential(creds, "apiKey");
                    requireCredential(creds, "apiSecret");
                    return new ChannelConnectionTestResult(true,
                            "Credentials Hotels.com valides", creds.get("propertyId"));
                }
                case AGODA -> {
                    requireCredential(creds, "propertyId");
                    requireCredential(creds, "apiKey");
                    return new ChannelConnectionTestResult(true,
                            "Credentials Agoda valides", creds.get("propertyId"));
                }
                case HOMEAWAY -> {
                    requireCredential(creds, "listingId");
                    requireCredential(creds, "accessToken");
                    return new ChannelConnectionTestResult(true,
                            "Credentials Vrbo/Abritel valides", creds.get("listingId"));
                }
                default -> {
                    return new ChannelConnectionTestResult(false,
                            "Channel non supporte: " + channel, null);
                }
            }
        } catch (IllegalArgumentException e) {
            return new ChannelConnectionTestResult(false, e.getMessage(), null);
        }
    }

    // ========================================================================
    // Channel-specific connect methods
    // ========================================================================

    private ChannelConnectionDto connectBooking(Long orgId, Map<String, String> creds) {
        String hotelId = requireCredential(creds, "hotelId");
        String username = requireCredential(creds, "username");
        String password = requireCredential(creds, "password");

        BookingConnection bc = new BookingConnection(orgId, hotelId);
        bc.setUsername(username);
        bc.setPasswordEncrypted(encryptionService.encrypt(password));
        bc.setConnectedAt(LocalDateTime.now());
        bc = bookingConnectionRepository.save(bc);

        ChannelConnection cc = createGenericConnection(orgId, ChannelName.BOOKING,
                String.valueOf(bc.getId()), hotelId);
        return toDto(cc);
    }

    private ChannelConnectionDto connectExpedia(Long orgId, Map<String, String> creds) {
        String propertyId = requireCredential(creds, "propertyId");
        String apiKey = requireCredential(creds, "apiKey");
        String apiSecret = requireCredential(creds, "apiSecret");

        ExpediaConnection ec = new ExpediaConnection(orgId, propertyId,
                encryptionService.encrypt(apiKey), encryptionService.encrypt(apiSecret));
        ec = expediaConnectionRepository.save(ec);

        ChannelConnection cc = createGenericConnection(orgId, ChannelName.EXPEDIA,
                String.valueOf(ec.getId()), propertyId);
        return toDto(cc);
    }

    private ChannelConnectionDto connectHotelsCom(Long orgId, Map<String, String> creds) {
        String propertyId = requireCredential(creds, "propertyId");
        String apiKey = requireCredential(creds, "apiKey");
        String apiSecret = requireCredential(creds, "apiSecret");

        HotelsComConnection hc = new HotelsComConnection();
        hc.setOrganizationId(orgId);
        hc.setPropertyId(propertyId);
        hc.setApiKeyEncrypted(encryptionService.encrypt(apiKey));
        hc.setApiSecretEncrypted(encryptionService.encrypt(apiSecret));
        hc = hotelsComConnectionRepository.save(hc);

        ChannelConnection cc = createGenericConnection(orgId, ChannelName.HOTELS_COM,
                String.valueOf(hc.getId()), propertyId);
        return toDto(cc);
    }

    private ChannelConnectionDto connectAgoda(Long orgId, Map<String, String> creds) {
        String propertyId = requireCredential(creds, "propertyId");
        String apiKey = requireCredential(creds, "apiKey");
        String apiSecret = creds.getOrDefault("apiSecret", "");

        AgodaConnection ac = new AgodaConnection(orgId, propertyId, encryptionService.encrypt(apiKey));
        if (!apiSecret.isBlank()) {
            ac.setApiSecretEncrypted(encryptionService.encrypt(apiSecret));
        }
        ac = agodaConnectionRepository.save(ac);

        ChannelConnection cc = createGenericConnection(orgId, ChannelName.AGODA,
                String.valueOf(ac.getId()), propertyId);
        return toDto(cc);
    }

    private ChannelConnectionDto connectHomeAway(Long orgId, Map<String, String> creds) {
        String listingId = requireCredential(creds, "listingId");
        String accessToken = requireCredential(creds, "accessToken");
        String refreshToken = creds.getOrDefault("refreshToken", "");

        HomeAwayConnection hc = new HomeAwayConnection(orgId, encryptionService.encrypt(accessToken));
        hc.setListingId(listingId);
        if (!refreshToken.isBlank()) {
            hc.setRefreshTokenEncrypted(encryptionService.encrypt(refreshToken));
        }
        hc = homeAwayConnectionRepository.save(hc);

        ChannelConnection cc = createGenericConnection(orgId, ChannelName.HOMEAWAY,
                String.valueOf(hc.getId()), listingId);
        return toDto(cc);
    }

    // ========================================================================
    // Helpers
    // ========================================================================

    private ChannelConnection createGenericConnection(Long orgId, ChannelName channel,
                                                       String credentialsRef, String externalId) {
        // Reactiver si connexion inactive existante
        Optional<ChannelConnection> existing = channelConnectionRepository
                .findByOrganizationIdAndChannel(orgId, channel);

        ChannelConnection cc;
        if (existing.isPresent()) {
            cc = existing.get();
            cc.setStatus(ChannelConnection.ConnectionStatus.ACTIVE);
            cc.setCredentialsRef(credentialsRef);
            cc.setExternalPropertyId(externalId);
            cc.setLastError(null);
        } else {
            cc = new ChannelConnection(orgId, channel);
            cc.setCredentialsRef(credentialsRef);
            cc.setExternalPropertyId(externalId);
        }

        return channelConnectionRepository.save(cc);
    }

    private void deactivateChannelSpecificConnection(Long orgId, ChannelName channel) {
        switch (channel) {
            case BOOKING -> bookingConnectionRepository.findByOrganizationId(orgId)
                    .ifPresent(c -> {
                        c.setStatus(BookingConnection.BookingConnectionStatus.INACTIVE);
                        bookingConnectionRepository.save(c);
                    });
            case EXPEDIA -> expediaConnectionRepository.findByOrganizationId(orgId)
                    .forEach(c -> {
                        c.setStatus(ExpediaConnection.ExpediaConnectionStatus.INACTIVE);
                        expediaConnectionRepository.save(c);
                    });
            case HOTELS_COM -> hotelsComConnectionRepository.findByOrganizationId(orgId)
                    .ifPresent(c -> {
                        c.setStatus(HotelsComConnection.HotelsComConnectionStatus.INACTIVE);
                        hotelsComConnectionRepository.save(c);
                    });
            case AGODA -> agodaConnectionRepository.findByOrganizationId(orgId)
                    .ifPresent(c -> {
                        c.setStatus(AgodaConnection.AgodaConnectionStatus.INACTIVE);
                        agodaConnectionRepository.save(c);
                    });
            case HOMEAWAY -> homeAwayConnectionRepository.findByOrganizationId(orgId)
                    .ifPresent(c -> {
                        c.setStatus(HomeAwayConnection.HomeAwayConnectionStatus.INACTIVE);
                        homeAwayConnectionRepository.save(c);
                    });
            default -> log.warn("Pas de desactivation specifique pour le channel {}", channel);
        }
    }

    private void validateSupportedChannel(ChannelName channel) {
        if (!SUPPORTED_CHANNELS.contains(channel)) {
            throw new IllegalArgumentException("Channel non supporte pour la connexion manuelle: " + channel
                    + ". Channels supportes: " + SUPPORTED_CHANNELS);
        }
    }

    private String requireCredential(Map<String, String> creds, String key) {
        String value = creds.get(key);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Credential manquant: " + key);
        }
        return value;
    }

    private ChannelConnectionDto toDto(ChannelConnection cc) {
        return new ChannelConnectionDto(
                cc.getId(),
                cc.getChannel(),
                cc.getStatus() != null ? cc.getStatus().name() : "ACTIVE",
                cc.isActive(),
                cc.getCreatedAt(),
                cc.getLastSyncAt(),
                cc.getLastError(),
                cc.getExternalPropertyId()
        );
    }
}
