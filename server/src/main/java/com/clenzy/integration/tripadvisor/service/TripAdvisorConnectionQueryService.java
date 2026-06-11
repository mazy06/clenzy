package com.clenzy.integration.tripadvisor.service;

import com.clenzy.integration.tripadvisor.model.TripAdvisorConnection;
import com.clenzy.integration.tripadvisor.repository.TripAdvisorConnectionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Resolution d'organisation pour le flux webhook TripAdvisor Vacation Rentals
 * — refactor T-ARCH-01 : plus aucun repository dans les controllers.
 *
 * <p><b>Lookup volontairement SANS validation d'organisation</b> : le webhook
 * est un flux public sans JWT (donc sans TenantContext). L'authentification y
 * est assuree par la signature HMAC {@code X-TripAdvisor-Signature} validee en
 * amont par le controller, et la connexion resolue porte elle-meme son
 * organizationId — meme convention que {@code PaymentTransactionService} pour
 * les webhooks providers.</p>
 */
@Service
public class TripAdvisorConnectionQueryService {

    private final TripAdvisorConnectionRepository connectionRepository;

    public TripAdvisorConnectionQueryService(TripAdvisorConnectionRepository connectionRepository) {
        this.connectionRepository = connectionRepository;
    }

    /** Resout l'organizationId depuis un partner_id TripAdvisor (vide si non lie). */
    @Transactional(readOnly = true)
    public Optional<Long> resolveOrganizationId(String partnerId) {
        return connectionRepository.findByPartnerId(partnerId)
                .map(TripAdvisorConnection::getOrganizationId);
    }
}
