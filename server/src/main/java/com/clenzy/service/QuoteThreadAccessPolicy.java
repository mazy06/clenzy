package com.clenzy.service;

import com.clenzy.model.ContactThread;
import com.clenzy.model.Intervention;
import com.clenzy.model.User;
import com.clenzy.repository.ContactThreadParticipantRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/** Complète la participation au fil par le périmètre métier actuel. */
@Service
public class QuoteThreadAccessPolicy {
    private final InterventionRepository interventions;
    private final UserRepository users;
    private final ContactThreadParticipantRepository participants;
    private final QuoteDiscussionScope scope;
    private final com.clenzy.marketplace.repository.MarketplaceQuoteRequestRepository marketplaceRequests;
    private final com.clenzy.marketplace.repository.MarketplaceProviderRepository marketplaceProviders;
    private final com.clenzy.repository.PropertyRepository properties;

    public QuoteThreadAccessPolicy(InterventionRepository interventions, UserRepository users,
                                  ContactThreadParticipantRepository participants, QuoteDiscussionScope scope,
                                  com.clenzy.marketplace.repository.MarketplaceQuoteRequestRepository marketplaceRequests,
                                  com.clenzy.marketplace.repository.MarketplaceProviderRepository marketplaceProviders,
                                  com.clenzy.repository.PropertyRepository properties) {
        this.marketplaceRequests = marketplaceRequests;
        this.marketplaceProviders = marketplaceProviders;
        this.properties = properties;
        this.interventions = interventions;
        this.users = users;
        this.participants = participants;
        this.scope = scope;
    }

    public boolean canAccess(ContactThread thread, String keycloakId) {
        String type = thread.getReferenceType();
        if (com.clenzy.marketplace.service.MarketplaceQuoteDiscussionPublisher.REFERENCE.equals(type)) {
            return canAccessMarketplace(thread, keycloakId);
        }
        if (type == null || !type.startsWith("SERVICE_QUOTE_")) return true;
        User user = users.findByKeycloakId(keycloakId).orElse(null);
        Intervention intervention = thread.getReferenceId() == null ? null
                : interventions.findById(thread.getReferenceId()).orElse(null);
        if (user == null || intervention == null
                || !Objects.equals(thread.getOrganizationId(), intervention.getOrganizationId())) return false;
        if (isCustomer(user, intervention)) return true;
        if (type.startsWith(QuoteDiscussionScope.TEAM_PREFIX)) {
            Long teamId = suffixId(type, QuoteDiscussionScope.TEAM_PREFIX);
            return teamId != null && scope.teamsOf(user).contains(teamId);
        }
        if (type.startsWith(QuoteDiscussionScope.USER_PREFIX)) {
            return Objects.equals(user.getId(), suffixId(type, QuoteDiscussionScope.USER_PREFIX));
        }
        if (!QuoteDiscussionScope.LEGACY.equals(type)) return false;
        return legacyProvidersShareAnIdentity(thread, intervention, user);
    }

    private boolean canAccessMarketplace(ContactThread thread, String keycloakId) {
        User user = users.findByKeycloakId(keycloakId).orElse(null);
        var request = thread.getReferenceId() == null ? null
                : marketplaceRequests.findById(thread.getReferenceId()).orElse(null);
        if (user == null || request == null
                || !Objects.equals(thread.getOrganizationId(), request.getRequesterOrganizationId())) return false;
        if (Objects.equals(user.getOrganizationId(), request.getRequesterOrganizationId())
                && (Objects.equals(user.getId(), request.getRequestedByUserId())
                    || user.getRole() != null && user.getRole().isPlatformStaff())) return true;
        if (request.getPropertyId() != null) {
            var property = properties.findByIdWithOwner(request.getPropertyId(), request.getRequesterOrganizationId()).orElse(null);
            if (property != null && property.getOwner() != null
                    && Objects.equals(property.getOwner().getId(), user.getId())) return true;
        }
        if (request.getProviderTeamId() != null) return scope.teamsOf(user).contains(request.getProviderTeamId());
        var provider = marketplaceProviders.findById(request.getProviderId()).orElse(null);
        return provider != null && Objects.equals(provider.getUserId(), user.getId());
    }

    private boolean legacyProvidersShareAnIdentity(ContactThread thread, Intervention intervention, User user) {
        List<User> historicalParticipants = participants.findByThreadId(thread.getId()).stream()
                .map(p -> users.findByKeycloakId(p.getKeycloakId()).orElse(null))
                .toList();
        // Une identité disparue empêche de démontrer que l'historique est commun.
        if (historicalParticipants.contains(null)) return false;
        List<User> providers = historicalParticipants.stream()
                .filter(u -> !isCustomer(u, intervention)).toList();
        if (providers.size() == 1) return Objects.equals(providers.getFirst().getId(), user.getId());
        if (providers.isEmpty()) return false;
        Set<Long> commonTeams = new HashSet<>(scope.teamsOf(user));
        for (User provider : providers) commonTeams.retainAll(scope.teamsOf(provider));
        // Un ancien fil mélangeant des concurrents reste conservé pour le client,
        // mais n'est plus diffusé aux prestataires. Les nouveaux fils sont isolés.
        return !commonTeams.isEmpty();
    }

    private boolean isCustomer(User user, Intervention intervention) {
        if (user.getRole() != null && user.getRole().isPlatformStaff()
                && Objects.equals(user.getOrganizationId(), intervention.getOrganizationId())) return true;
        return intervention.getProperty() != null && intervention.getProperty().getOwner() != null
                && Objects.equals(user.getId(), intervention.getProperty().getOwner().getId());
    }

    private Long suffixId(String value, String prefix) {
        try { return Long.valueOf(value.substring(prefix.length())); }
        catch (NumberFormatException e) { return null; }
    }
}
