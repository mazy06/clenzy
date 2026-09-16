package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.*;
import com.clenzy.model.InterventionStatus;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Objects;

@Service
@Transactional
public class MarketplaceReviewService {
    private final MarketplaceQuoteMissionFactory access;
    private final MarketplaceReviewRepository reviews;
    private final MarketplaceProviderRepository providers;
    private final InterventionRepository interventions;
    private final ProviderAccountResolver accounts;
    private final TeamRepository teams;
    private final TenantContext tenant;
    private final Clock clock;
    public MarketplaceReviewService(MarketplaceQuoteMissionFactory access, MarketplaceReviewRepository reviews,
            MarketplaceProviderRepository providers, InterventionRepository interventions,
            ProviderAccountResolver accounts, TeamRepository teams, TenantContext tenant, Clock clock) {
        this.access = access; this.reviews = reviews; this.providers = providers; this.interventions = interventions;
        this.accounts = accounts; this.teams = teams; this.tenant = tenant; this.clock = clock;
    }
    public record View(boolean canReview, Integer rating, String feedback, LocalDateTime createdAt) {}

    public View get(Long id, Jwt jwt) {
        var quote = authorized(id, jwt);
        var existing = reviews.findById(id).orElse(null);
        if (existing != null) return view(existing);
        var provider = providers.findById(quote.getProviderId()).orElseThrow();
        Long author = accounts.userIdOf(jwt.getSubject());
        boolean eligible = quote.getStatus() == QuoteRequestStatus.ACCEPTED && quote.getInterventionId() != null
                && !selfReview(quote, provider, author)
                && interventions.findForReview(quote.getInterventionId(), tenant.getRequiredOrganizationId())
                    .map(i -> i.getStatus() == InterventionStatus.COMPLETED && sameAssignee(quote, provider, i)).orElse(false);
        return new View(eligible, null, null, null);
    }

    public View submit(Long id, int rating, String feedback, Jwt jwt) {
        var quote = authorized(id, jwt);
        if (rating < 1 || rating > 5) throw new IllegalArgumentException("La note doit être comprise entre 1 et 5");
        String cleaned = MarketplaceQuoteText.optional(feedback, 1000, "Commentaire");
        var existing = reviews.findById(id).orElse(null);
        if (existing != null) {
            if (existing.getRating() == rating && Objects.equals(existing.getFeedback(), cleaned)) return view(existing);
            throw new IllegalStateException("Un avis a déjà été enregistré pour cette mission");
        }
        if (quote.getStatus() != QuoteRequestStatus.ACCEPTED || quote.getInterventionId() == null)
            throw new IllegalStateException("Une mission issue d’un devis accepté est requise");
        var intervention = interventions.findForReview(quote.getInterventionId(), tenant.getRequiredOrganizationId()).orElseThrow();
        if (intervention.getStatus() != InterventionStatus.COMPLETED)
            throw new IllegalStateException("La mission doit être terminée avant de laisser un avis");
        var provider = providers.findForRating(quote.getProviderId()).orElseThrow();
        if (!sameAssignee(quote, provider, intervention))
            throw new IllegalStateException("L’attribution de la mission ne correspond plus au devis");
        Long author = accounts.userIdOf(jwt.getSubject());
        if (selfReview(quote, provider, author)) throw new AccessDeniedException("Un prestataire ne peut pas évaluer sa propre prestation");
        var review = reviews.saveAndFlush(new MarketplaceReview(id, provider.getId(), intervention.getId(),
                tenant.getRequiredOrganizationId(), author, rating, cleaned, LocalDateTime.now(clock)));
        // Le verrou de fiche sérialise aussi les avis portant sur deux missions distinctes.
        var summary = reviews.summarize(provider.getId());
        provider.setRatingAvg(BigDecimal.valueOf(summary.getAverage()).setScale(2, RoundingMode.HALF_UP));
        provider.setRatingCount(Math.toIntExact(summary.getTotal()));
        return view(review);
    }

    private MarketplaceQuoteRequest authorized(Long id, Jwt jwt) {
        var quote = access.lock(id, tenant.getRequiredOrganizationId());
        access.assertCanDecide(quote, tenant.getRequiredOrganizationId(), jwt);
        return quote;
    }
    private boolean selfReview(MarketplaceQuoteRequest quote, MarketplaceProvider provider, Long author) {
        if (Objects.equals(provider.getUserId(), author)) return true;
        return quote.getProviderTeamId() != null && teams.findRealTeamsForMember(author).stream()
                .anyMatch(team -> Objects.equals(team.getId(), quote.getProviderTeamId()));
    }
    private View view(MarketplaceReview review) {
        return new View(false, review.getRating(), review.getFeedback(), review.getCreatedAt());
    }
    private boolean sameAssignee(MarketplaceQuoteRequest quote, MarketplaceProvider provider, com.clenzy.model.Intervention intervention) {
        return quote.getProviderTeamId() != null
                ? "team".equals(intervention.getAssignedToType()) && quote.getProviderTeamId().equals(intervention.getAssignedToId())
                : "user".equals(intervention.getAssignedToType()) && Objects.equals(provider.getUserId(), intervention.getAssignedToId());
    }
}
