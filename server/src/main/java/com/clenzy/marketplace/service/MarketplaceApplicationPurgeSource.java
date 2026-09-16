package com.clenzy.marketplace.service;

import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.service.retention.PurgeSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

/**
 * Politique Baitly : seules les candidatures refusées et notifiées sont éligibles.
 * Le moteur de rétention fournit le seuil configuré (90 jours). Les dossiers rouverts,
 * les comptes prestataires et les litiges sont exclus, puis revérifiés sous verrou
 * avant suppression des justificatifs et de la candidature.
 */
@Component
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
    name = "baitly.marketplace.rejected-application-purge-enabled", havingValue = "true", matchIfMissing = true)
public class MarketplaceApplicationPurgeSource implements PurgeSource {

    private static final Logger log = LoggerFactory.getLogger(MarketplaceApplicationPurgeSource.class);

    /** Doit correspondre a {@code clenzy.retention.purge.targets[].name}. */
    static final String TARGET_NAME = "marketplace-applications";

    private final MarketplaceProviderRepository providerRepository;
    private final MarketplaceApplicationEraser eraser;
    private final ZoneId zoneId;

    @Autowired
    public MarketplaceApplicationPurgeSource(MarketplaceProviderRepository providerRepository,
                                             MarketplaceApplicationEraser eraser) {
        this(providerRepository, eraser, ZoneId.systemDefault());
    }

    /** Constructeur testable (zone explicite). */
    MarketplaceApplicationPurgeSource(MarketplaceProviderRepository providerRepository,
                                      MarketplaceApplicationEraser eraser,
                                      ZoneId zoneId) {
        this.providerRepository = providerRepository;
        this.eraser = eraser;
        this.zoneId = zoneId;
    }

    @Override
    public String targetName() {
        return TARGET_NAME;
    }

    @Override
    @Transactional(readOnly = true)
    public long countExpired(Instant cutoff) {
        return providerRepository.countPurgeableApplications(toLocalDateTime(cutoff));
    }

    @Override
    public int deleteExpiredBatch(Instant cutoff, int limit) {
        if (limit <= 0) {
            return 0;
        }
        List<Long> ids = providerRepository.findPurgeableApplicationIds(
            toLocalDateTime(cutoff), PageRequest.of(0, limit));
        // L'effacement lui-meme vit dans MarketplaceApplicationEraser : la
        // retention et la demande d'effacement doivent supprimer exactement
        // pareil, et deux copies de cet ordre finiraient par diverger.
        return eraser.eraseExpired(ids, toLocalDateTime(cutoff));
    }

    private LocalDateTime toLocalDateTime(Instant cutoff) {
        return LocalDateTime.ofInstant(cutoff, zoneId);
    }
}
