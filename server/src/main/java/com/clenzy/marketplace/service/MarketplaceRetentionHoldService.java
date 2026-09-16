package com.clenzy.marketplace.service;

import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.LocalDateTime;

/** Un litige suspend l'effacement jusqu'à une décision explicite, même après la date de revue. */
@Service
@Transactional
public class MarketplaceRetentionHoldService {
    private final MarketplaceProviderRepository providers;
    private final MarketplaceDecisionJournal journal;
    private final Clock clock;

    public MarketplaceRetentionHoldService(MarketplaceProviderRepository providers,
            MarketplaceDecisionJournal journal, Clock clock) {
        this.providers = providers; this.journal = journal; this.clock = clock;
    }

    public record View(String reason, LocalDateTime reviewAt, String actor, boolean reviewOverdue) {}

    @Transactional(readOnly = true)
    public View view(Long id) {
        return view(providers.findById(id).orElseThrow(() -> new NotFoundException("Candidature introuvable")));
    }

    public View update(Long id, String reason, LocalDateTime reviewAt, String actor) {
        var provider = providers.findForErasure(id).orElseThrow(() -> new NotFoundException("Candidature introuvable"));
        String normalized = reason == null ? null : reason.trim();
        if (normalized != null && (normalized.isBlank() || normalized.length() > 1000
                || reviewAt == null || !reviewAt.isAfter(LocalDateTime.now(clock))))
            throw new IllegalArgumentException("Le litige exige un motif et une date future de réexamen");
        if (actor == null || actor.isBlank() || actor.length() > 120)
            throw new IllegalArgumentException("Identité du gestionnaire requise");
        boolean held = provider.getRetentionHoldReason() != null;
        provider.setRetentionHoldReason(normalized);
        provider.setRetentionHoldReviewAt(normalized == null ? null : reviewAt);
        provider.setRetentionHoldActor(normalized == null ? null : actor);
        journal.record(id, "RETENTION_HOLD", held ? "HELD" : "NONE", normalized == null ? "RELEASED" : "HELD", actor);
        return view(provider);
    }

    private View view(com.clenzy.marketplace.model.MarketplaceProvider provider) {
        var review = provider.getRetentionHoldReviewAt();
        return new View(provider.getRetentionHoldReason(), review, provider.getRetentionHoldActor(),
                review != null && !review.isAfter(LocalDateTime.now(clock)));
    }
}
