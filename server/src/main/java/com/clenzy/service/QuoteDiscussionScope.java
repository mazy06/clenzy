package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.ServiceQuote;
import com.clenzy.model.Team;
import com.clenzy.model.User;
import com.clenzy.repository.TeamRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/** Identité de la partie prestataire ; indépendante des affectations ultérieures. */
@Service
public class QuoteDiscussionScope {
    public static final String TEAM_PREFIX = "SERVICE_QUOTE_TEAM_";
    public static final String USER_PREFIX = "SERVICE_QUOTE_USER_";
    public static final String LEGACY = "SERVICE_QUOTE_INTERVENTION";
    private final TeamRepository teams;
    private final com.clenzy.marketplace.repository.MarketplaceQuoteRequestRepository requests;

    public QuoteDiscussionScope(TeamRepository teams,
            com.clenzy.marketplace.repository.MarketplaceQuoteRequestRepository requests) {
        this.teams = teams; this.requests = requests;
    }

    /** Même verrou que la publication différée de la demande : un seul ouvre le fil. */
    public void lockPublication(ServiceQuote quote) {
        if (quote.getMarketplaceRequestId() != null) {
            var request = requests.findForDiscussion(quote.getMarketplaceRequestId()).orElseThrow();
            if (!Objects.equals(request.getRequesterOrganizationId(), quote.getOrganizationId())
                    || !Objects.equals(request.getInterventionId(), quote.getInterventionId())) {
                throw new AccessDeniedException("Origine du devis incohérente");
            }
        }
    }

    public void resolve(ServiceQuote quote, Intervention intervention, User author) {
        List<Team> memberships = teams.findRealTeamsForMember(author.getId());
        Long requested = quote.getProviderTeamId();
        if (requested != null) {
            if (memberships.stream().noneMatch(t -> requested.equals(t.getId()))) {
                throw new AccessDeniedException("Vous ne représentez pas cette équipe");
            }
            return;
        }
        // Une équipe affectée prévaut ; plusieurs appartenances sans contexte ne
        // permettent pas de choisir arbitrairement qui verra la négociation.
        // L'absence d'équipe est aussi un choix figé sur la demande marketplace.
        if (quote.getMarketplaceRequestId() != null) return;
        Long assigned = intervention.getTeamId();
        if (assigned != null && memberships.stream().anyMatch(t -> assigned.equals(t.getId()))) {
            quote.setProviderTeamId(assigned);
        } else if (memberships.size() == 1) {
            quote.setProviderTeamId(memberships.getFirst().getId());
        }
    }

    public static String referenceType(ServiceQuote quote) {
        if (quote.getMarketplaceRequestId() != null) return "MARKETPLACE_QUOTE";
        if (quote.getProviderTeamId() != null) return TEAM_PREFIX + quote.getProviderTeamId();
        if (quote.getProviderUserId() == null) {
            throw new IllegalStateException("Un devis sans auteur ne peut ouvrir une discussion prestataire");
        }
        return USER_PREFIX + quote.getProviderUserId();
    }

    public static Long referenceId(ServiceQuote quote) {
        return quote.getMarketplaceRequestId() != null ? quote.getMarketplaceRequestId() : quote.getInterventionId();
    }

    public Set<String> members(Long teamId) {
        if (teamId == null) return Set.of();
        return teams.findByIdWithMembers(teamId).map(team -> team.getMembers().stream()
                .map(member -> member.getUser().getKeycloakId()).filter(Objects::nonNull)
                .collect(Collectors.toSet())).orElse(Set.of());
    }

    public Set<Long> teamsOf(User user) {
        return teams.findRealTeamsForMember(user.getId()).stream().map(Team::getId)
                .collect(Collectors.toSet());
    }
}
