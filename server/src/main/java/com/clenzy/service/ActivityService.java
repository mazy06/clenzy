package com.clenzy.service;

import com.clenzy.dto.ActivityConfigDto;
import com.clenzy.dto.ActivityDto;
import com.clenzy.integration.activities.ActivityCatalogClient;
import com.clenzy.integration.activities.ActivitySearchQuery;
import com.clenzy.model.ActivityAffiliateConfig;
import com.clenzy.model.ActivityProvider;
import com.clenzy.model.Property;
import com.clenzy.model.WelcomeGuide;
import com.clenzy.model.WelcomeGuideToken;
import com.clenzy.repository.ActivityAffiliateConfigRepository;
import com.clenzy.repository.WelcomeGuideTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Orchestration des activites : agrege les providers actifs d'une org et expose
 * la recherche pour le livret public + la gestion de config cote hote.
 * Provider-agnostique : chaque {@link ActivityCatalogClient} se branche ici.
 */
@Service
public class ActivityService {

    private static final Logger log = LoggerFactory.getLogger(ActivityService.class);

    private final WelcomeGuideTokenRepository tokenRepository;
    private final ActivityAffiliateConfigRepository configRepository;
    private final Map<ActivityProvider, ActivityCatalogClient> clients;

    public ActivityService(WelcomeGuideTokenRepository tokenRepository,
                            ActivityAffiliateConfigRepository configRepository,
                            List<ActivityCatalogClient> clientList) {
        this.tokenRepository = tokenRepository;
        this.configRepository = configRepository;
        this.clients = new EnumMap<>(ActivityProvider.class);
        for (ActivityCatalogClient client : clientList) {
            this.clients.put(client.provider(), client);
        }
    }

    /** Activites pour le livret public (token valide → providers actifs de l'org). */
    @Transactional(readOnly = true)
    public List<ActivityDto> searchForGuide(UUID token, int limit) {
        return tokenRepository.findByToken(token)
            .filter(WelcomeGuideToken::isCurrentlyValid)
            .map(t -> searchForToken(t, limit))
            .orElseGet(List::of);
    }

    private List<ActivityDto> searchForToken(WelcomeGuideToken t, int limit) {
        WelcomeGuide guide = t.getGuide();
        Property property = guide != null ? guide.getProperty() : null;
        if (guide == null || property == null) {
            return List.of();
        }
        ActivitySearchQuery query = new ActivitySearchQuery(
            property.getLatitude() != null ? property.getLatitude().doubleValue() : null,
            property.getLongitude() != null ? property.getLongitude().doubleValue() : null,
            property.getCity(), guide.getLanguage(), limit);

        List<ActivityDto> results = new ArrayList<>();
        for (ActivityAffiliateConfig config : configRepository.findByOrganizationIdAndEnabledTrue(guide.getOrganizationId())) {
            ActivityCatalogClient client = clients.get(config.getProvider());
            if (client == null) {
                continue;
            }
            try {
                results.addAll(client.search(query, config));
            } catch (Exception e) {
                log.warn("Activity search failed provider={} org={}: {}",
                    config.getProvider(), guide.getOrganizationId(), e.getMessage());
            }
        }
        return results;
    }

    @Transactional(readOnly = true)
    public List<ActivityConfigDto> listConfigs(Long orgId) {
        return configRepository.findByOrganizationId(orgId).stream()
            .map(ActivityConfigDto::from)
            .toList();
    }

    @Transactional
    public ActivityConfigDto upsertConfig(Long orgId, ActivityProvider provider,
                                           String apiKey, String affiliateId, boolean enabled) {
        ActivityAffiliateConfig config = configRepository.findByOrganizationIdAndProvider(orgId, provider)
            .orElseGet(() -> {
                ActivityAffiliateConfig created = new ActivityAffiliateConfig();
                created.setOrganizationId(orgId);
                created.setProvider(provider);
                return created;
            });
        // Cle vide => on conserve l'existante (l'UI n'affiche jamais la cle).
        if (apiKey != null && !apiKey.isBlank()) {
            config.setApiKey(apiKey);
        }
        config.setAffiliateId(affiliateId);
        config.setEnabled(enabled);
        return ActivityConfigDto.from(configRepository.save(config));
    }
}
