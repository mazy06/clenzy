package com.clenzy.integration.homeaway.service;

import com.clenzy.integration.homeaway.model.HomeAwayConnection;
import com.clenzy.integration.homeaway.repository.HomeAwayConnectionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resolution d'organisation pour le flux webhook HomeAway/Abritel
 * — refactor T-ARCH-01 : plus aucun repository dans les controllers.
 *
 * <p><b>Lookup volontairement SANS validation d'organisation</b> : le webhook
 * est un flux public sans JWT (donc sans TenantContext). L'authentification y
 * est assuree par la signature HMAC {@code X-HomeAway-Signature} validee en
 * amont par le controller, et la connexion resolue porte elle-meme son
 * organizationId — meme convention que {@code PaymentTransactionService} pour
 * les webhooks providers.</p>
 */
@Service
public class HomeAwayConnectionQueryService {

    private final HomeAwayConnectionRepository connectionRepository;

    public HomeAwayConnectionQueryService(HomeAwayConnectionRepository connectionRepository) {
        this.connectionRepository = connectionRepository;
    }

    /** Resout l'organizationId depuis un listing HomeAway (null si non lie). */
    @Transactional(readOnly = true)
    public Long resolveOrganizationId(String listingId) {
        if (listingId == null) return null;
        return connectionRepository.findByListingId(listingId)
                .map(HomeAwayConnection::getOrganizationId)
                .orElse(null);
    }
}
