package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.QuoteRequestStatus;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.marketplace.repository.MarketplaceQuoteRequestRepository;
import com.clenzy.model.*;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.ContactThreadService;
import com.clenzy.service.QuoteDiscussionScope;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

/** Le statut publié est enregistré avec le message : une panne laisse la demande à reprendre. */
@Service
public class MarketplaceQuoteDiscussionPublisher {
    public static final String REFERENCE = "MARKETPLACE_QUOTE";
    private final MarketplaceQuoteRequestRepository requests;
    private final MarketplaceProviderRepository providers;
    private final UserRepository users;
    private final PropertyRepository properties;
    private final ContactThreadService threads;
    private final QuoteDiscussionScope scope;
    private final ObjectMapper json;

    public MarketplaceQuoteDiscussionPublisher(MarketplaceQuoteRequestRepository requests,
            MarketplaceProviderRepository providers, UserRepository users, PropertyRepository properties,
            ContactThreadService threads, QuoteDiscussionScope scope, ObjectMapper json) {
        this.requests = requests; this.providers = providers; this.users = users;
        this.properties = properties; this.threads = threads; this.scope = scope; this.json = json;
    }

    @Transactional(rollbackFor = Exception.class)
    public void publish(Long id) throws JsonProcessingException {
        var request = requests.findForDiscussion(id).orElse(null);
        if (request == null || request.getDiscussionPublishedStatus() == request.getStatus()) return;
        var provider = providers.findById(request.getProviderId()).orElseThrow();
        User professional = provider.getUserId() == null ? null : users.findById(provider.getUserId()).orElse(null);
        User customer = users.findById(request.getRequestedByUserId()).orElse(null);
        if (professional == null || customer == null || professional.getKeycloakId() == null
                || customer.getKeycloakId() == null) throw new IllegalStateException("Participants indisponibles");
        Set<String> participants = new LinkedHashSet<>(scope.members(request.getProviderTeamId()));
        participants.add(professional.getKeycloakId());
        participants.add(customer.getKeycloakId());
        Property property = request.getPropertyId() == null ? null : properties
                .findByIdWithOwner(request.getPropertyId(), request.getRequesterOrganizationId()).orElse(null);
        if (property != null && property.getOwner() != null && property.getOwner().getKeycloakId() != null)
            participants.add(property.getOwner().getKeycloakId());
        users.findByRoleIn(List.of(UserRole.SUPER_ADMIN, UserRole.SUPER_MANAGER), request.getRequesterOrganizationId())
                .stream().map(User::getKeycloakId).filter(Objects::nonNull).forEach(participants::add);
        var thread = threads.openThread(request.getRequesterOrganizationId(), request.getTitle(),
                ContactMessageCategory.MAINTENANCE, customer.getKeycloakId(), REFERENCE, id, participants);
        boolean quoted = request.getStatus() == QuoteRequestStatus.QUOTED;
        Map<String, Object> payload = new LinkedHashMap<>();
        if (request.getQuotedAmount() != null) {
            payload.put("kind", "SERVICE_QUOTE");
            payload.put("marketplaceRequestId", id);
            payload.put("quoteId", id);
            payload.put("interventionTitle", request.getTitle());
            payload.put("providerName", provider.getDisplayName());
            payload.put("propertyName", property == null ? null : property.getName());
            payload.put("amount", request.getQuotedAmount());
            payload.put("currency", request.getQuotedCurrency());
            payload.put("validUntil", request.getQuoteValidUntil() == null ? null : request.getQuoteValidUntil().toString());
        }
        String body = switch (request.getStatus()) {
            case SENT -> "Demande de devis : " + request.getTitle() + "\n" + Objects.toString(request.getMessage(), "");
            case QUOTED -> "Demande : " + Objects.toString(request.getMessage(), request.getTitle())
                    + "\nProposition de devis : " + Objects.toString(request.getQuoteMessage(), "");
            case ACCEPTED -> request.getPropertyId() == null
                    ? "Le devis a été accepté comme accord commercial, sans mission planifiée."
                    : "Le devis a été accepté. Consultez la mission pour suivre sa confirmation et son exécution.";
            case DECLINED -> "Le devis a été refusé.";
            case TURNED_DOWN -> "Le prestataire ne donne pas suite à cette demande.";
            case WITHDRAWN -> "La demande a été retirée.";
            case EXPIRED -> "Le devis a expiré.";
        };
        threads.post(thread, quoted || request.getStatus() == QuoteRequestStatus.TURNED_DOWN
                        ? professional.getKeycloakId() : customer.getKeycloakId(), null,
                body, ContactMessagePriority.MEDIUM, payload.isEmpty() ? null : json.writeValueAsString(payload));
        request.setDiscussionPublishedStatus(request.getStatus());
        requests.save(request);
    }
}
