package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.model.MarketplaceQuoteRequest;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.InterventionType;
import com.clenzy.model.Property;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.model.User;
import com.clenzy.model.ServiceQuote;
import com.clenzy.service.ServiceQuoteService;
import com.clenzy.util.JwtRoleExtractor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Optional;

/** Création d'une mission commerciale et contrôles communs des décisions marketplace. */
@Service
public class MarketplaceQuoteMissionFactory {
    private static final Logger log = LoggerFactory.getLogger(MarketplaceQuoteMissionFactory.class);
    private static final LocalTime DEFAULT_START = LocalTime.of(9, 0);
    private final InterventionRepository interventionRepository;
    private final PropertyRepository propertyRepository;
    private final MarketplaceProviderRepository providerRepository;
    private final UserRepository userRepository;
    private final com.clenzy.marketplace.repository.MarketplaceQuoteRequestRepository requests;
    private final Clock clock;
    private final MarketplaceGeographicEligibility geography;
    private final com.clenzy.service.InterventionAllocationGuard allocationGuard;
    private final MarketplaceExposureService exposure;

    public MarketplaceQuoteMissionFactory(InterventionRepository interventionRepository,
            PropertyRepository propertyRepository, MarketplaceProviderRepository providerRepository,
            UserRepository userRepository,
            com.clenzy.marketplace.repository.MarketplaceQuoteRequestRepository requests, Clock clock,
            com.clenzy.service.InterventionAllocationGuard allocationGuard, MarketplaceExposureService exposure, MarketplaceGeographicEligibility geography) {
        this.geography = geography;
        this.exposure = exposure;
        this.allocationGuard = allocationGuard;
        this.interventionRepository = interventionRepository; this.propertyRepository = propertyRepository;
        this.providerRepository = providerRepository; this.userRepository = userRepository;
        this.requests = requests; this.clock = clock;
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public MarketplaceQuoteRequest lock(Long id, Long orgId) {
        var request = requests.findForDiscussion(id).orElseThrow();
        if (orgId == null || !orgId.equals(request.getRequesterOrganizationId())) throw new AccessDeniedException("Organisation incorrecte");
        return request;
    }

    public ServiceQuote draft(MarketplaceQuoteRequest request) {
        var provider = providerRepository.findById(request.getProviderId()).orElseThrow();
        if (provider.getUserId() == null) throw new IllegalStateException("Compte prestataire indisponible");
        var author = userRepository.findById(provider.getUserId()).orElseThrow();
        var quote = new ServiceQuote();
        quote.setMarketplaceRequestId(request.getId());
        quote.setOrganizationId(request.getRequesterOrganizationId());
        quote.setPropertyId(request.getPropertyId());
        quote.setProviderUserId(author.getId()); quote.setProviderTeamId(request.getProviderTeamId());
        quote.setProviderName(provider.getDisplayName()); quote.setProviderEmail(author.getEmail());
        quote.setAmount(request.getQuotedAmount()); quote.setCurrency(request.getQuotedCurrency());
        quote.setValidUntil(request.getQuoteValidUntil());
        quote.setDescription(abbreviate(request.getQuoteMessage(), 1000));
        return quote;
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public Optional<Long> decide(ServiceQuote quote, Long orgId, boolean approve, String reason) {
        var request = lock(quote.getMarketplaceRequestId(), orgId);
        if (request.getStatus() != com.clenzy.marketplace.model.QuoteRequestStatus.QUOTED)
            throw new MarketplaceQuoteService.QuoteAlreadySettledException();
        String cleanedReason = MarketplaceQuoteText.optional(reason, 500, "Motif");
        if (approve && request.isExpiredOn(java.time.LocalDate.now(clock)))
            throw new IllegalStateException("Ce devis a expiré");
        // Contrôle avant la décision, même sans logement ou avec une mission déjà liée.
        if (approve) {
            geography.requireCoverage(request.getProviderId(), request.getPropertyId(), orgId);
        geography.requireService(request.getProviderId(), request.getPropertyId(), orgId, request.getCategoryCode(), request.getServiceItemCode(), request.getDesiredDate());
            User provider = requireActiveProvider(request);
            requireMatchingAgreement(quote, request, provider);
            if (request.getCategoryCode() != null || request.getServiceItemCode() != null) {
                var profile = providerRepository.findById(request.getProviderId()).orElseThrow();
                MarketplaceOfferEligibility.requireOfferedService(profile, request.getCategoryCode(), request.getServiceItemCode());
            }
        }
        var target = approve ? com.clenzy.marketplace.model.QuoteRequestStatus.ACCEPTED
                : com.clenzy.marketplace.model.QuoteRequestStatus.DECLINED;
        if (requests.decideIfStillQuoted(request.getId(), orgId, target, cleanedReason, LocalDateTime.now(clock)) != 1)
            throw new MarketplaceQuoteService.QuoteAlreadySettledException();
        return approve ? createFrom(request) : Optional.empty();
    }

    public void assertCanDecide(MarketplaceQuoteRequest quote, Long orgId, Jwt jwt) {
        if (orgId == null || !orgId.equals(quote.getRequesterOrganizationId())) throw new AccessDeniedException("Organisation incorrecte");
        if (jwt == null || jwt.getSubject() == null) throw new AccessDeniedException("Compte non résolu");
        var role = JwtRoleExtractor.extractUserRole(jwt);
        if (role != null && role.isPlatformStaff()) return;
        if (quote.getPropertyId() != null) {
            Property property = propertyRepository.findByIdWithOwner(quote.getPropertyId(), orgId).orElse(null);
            if (property != null && property.getOwner() != null
                    && jwt.getSubject().equals(property.getOwner().getKeycloakId())) return;
        } else {
            User requester = userRepository.findByKeycloakId(jwt.getSubject()).orElse(null);
            if (requester != null && requester.getId().equals(quote.getRequestedByUserId())) return;
        }
        throw new AccessDeniedException("Seuls le propriétaire concerné et la conciergerie peuvent décider");
    }

    /**
     * Cree l'intervention issue d'un devis accepte.
     *
     * @return l'identifiant de l'intervention, ou vide si la demande ne portait
     *         sur aucun logement
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public Optional<Long> createFrom(MarketplaceQuoteRequest quote) {
        if (quote.getInterventionId() != null) return Optional.of(quote.getInterventionId());
        if (quote.getPropertyId() == null) {
            log.info("Devis {} accepte sans logement : accord commercial, sans intervention",
                quote.getId());
            return Optional.empty();
        }

        // Relu avec la borne d'organisation, meme si la demande l'a deja
        // validee a sa creation : un logement peut avoir change de main entre
        // les deux, et `findById` ne passe par aucun filtre.
        Property property = propertyRepository
            .findByIdWithOwner(quote.getPropertyId(), quote.getRequesterOrganizationId())
            .orElse(null);
        if (property == null) {
            throw new AccessDeniedException("Le logement n'appartient plus à cette organisation");
        }

        geography.requireCoverage(quote.getProviderId(), quote.getPropertyId(), quote.getRequesterOrganizationId());
        geography.requireService(quote.getProviderId(), quote.getPropertyId(), quote.getRequesterOrganizationId(), quote.getCategoryCode(), quote.getServiceItemCode(), quote.getDesiredDate());
        User assignee = requireActiveProvider(quote);
        User requester = quote.getRequestedByUserId() == null ? null
                : userRepository.findById(quote.getRequestedByUserId()).orElse(null);
        if (requester == null) throw new IllegalStateException("Demandeur introuvable");

        var intervention = new Intervention();
        intervention.setOrganizationId(quote.getRequesterOrganizationId());
        intervention.setProperty(property);
        intervention.setRequestor(requester);
        // Le devis engage l'équipe ou l'indépendant choisi, pas forcément son auteur.
        if (quote.getProviderTeamId() != null) {
            intervention.proposeAssignment(null, quote.getProviderTeamId());
        } else {
            intervention.proposeAssignment(assignee, null);
        }
        intervention.setTitle(quote.getTitle());
        intervention.setDescription(buildDescription(quote));
        intervention.setType(resolveType(quote));
        intervention.setPriority("NORMAL");
        // PENDING et non AWAITING_VALIDATION : la validation vient d'avoir lieu,
        // c'est l'acceptation du devis.
        intervention.setStatus(InterventionStatus.PENDING);
        LocalDateTime scheduledStart = resolveStart(quote);
        intervention.setStartTime(scheduledStart);
        intervention.setScheduledDate(scheduledStart);
        if (quote.getRequestedDurationMinutes() != null) {
            intervention.setEndTime(scheduledStart.plusMinutes(quote.getRequestedDurationMinutes()));
            // Le verrou d'attribution existant réserve des heures entières : arrondi supérieur,
            // jamais une réservation plus courte que le créneau demandé.
            intervention.setEstimatedDurationHours(Math.ceilDiv(quote.getRequestedDurationMinutes(), 60));
        }
        // Le montant accepte est CONSERVE : c'est l'accord entre les deux
        // parties, pas une estimation interne.
        intervention.setEstimatedCost(quote.getQuotedAmount());
        intervention.setCurrency(quote.getQuotedCurrency() == null ? "EUR" : quote.getQuotedCurrency());

        allocationGuard.requireAvailable(intervention, quote.getServiceItemCode()!=null ? "ITEM:"+quote.getServiceItemCode() : quote.getCategoryCode()!=null ? "CATEGORY:"+quote.getCategoryCode() : "TYPE:OTHER");
        Intervention saved = interventionRepository.save(intervention);
        if (requests.attachIntervention(quote.getId(), saved.getId(), LocalDateTime.now(clock)) != 1)
            throw new MarketplaceQuoteService.QuoteAlreadySettledException();

        log.info("Devis {} : intervention {} creee sur le logement {}",
            quote.getId(), saved.getId(), property.getId());
        return Optional.of(saved.getId());
    }

    private User requireActiveProvider(MarketplaceQuoteRequest request) {
        MarketplaceProvider provider = providerRepository.findById(request.getProviderId())
                .orElseThrow(() -> new IllegalStateException("Prestataire introuvable"));
        if (provider.getStatus() != com.clenzy.marketplace.model.ProviderStatus.ACTIVE) {
            throw new IllegalStateException("Ce prestataire n'est plus actif ; la commande ne peut pas être confirmée");
        }
        if (!exposure.isVisibleTo(provider, request.getRequesterOrganizationId())) {
            throw new IllegalStateException("Ce prestataire n'est plus disponible pour cette organisation ; la commande ne peut pas être confirmée");
        }
        if (provider.getUserId() == null) throw new IllegalStateException("Le prestataire doit activer son compte avant la commande");
        return userRepository.findById(provider.getUserId())
                .orElseThrow(() -> new IllegalStateException("Compte prestataire introuvable"));
    }

    /** La création et l'approbation ne doivent pas appliquer deux accords différents. */
    private void requireMatchingAgreement(ServiceQuote quote, MarketplaceQuoteRequest request, User provider) {
        if (!java.util.Objects.equals(quote.getOrganizationId(), request.getRequesterOrganizationId())
                || !java.util.Objects.equals(quote.getPropertyId(), request.getPropertyId())
                || !java.util.Objects.equals(quote.getInterventionId(), request.getInterventionId())
                || !java.util.Objects.equals(quote.getProviderUserId(), provider.getId())
                || !java.util.Objects.equals(quote.getProviderTeamId(), request.getProviderTeamId())
                || !java.util.Objects.equals(quote.getCurrency(), request.getQuotedCurrency())
                || !java.util.Objects.equals(quote.getValidUntil(), request.getQuoteValidUntil())
                || quote.getAmount() == null || request.getQuotedAmount() == null
                || quote.getAmount().compareTo(request.getQuotedAmount()) != 0) {
            throw new IllegalStateException("Le devis et la demande ne correspondent plus ; l'accord doit être vérifié avant acceptation");
        }
    }

    /**
     * Rappelle d'ou vient l'intervention.
     *
     * <p>Six mois plus tard, une ligne a 340 € sans origine est impossible a
     * justifier. Le nom du prestataire et son message y figurent donc.</p>
     */
    private String buildDescription(MarketplaceQuoteRequest quote) {
        String providerName = providerRepository.findById(quote.getProviderId())
            .map(MarketplaceProvider::getDisplayName)
            .orElse("prestataire #" + quote.getProviderId());

        StringBuilder description = new StringBuilder();
        description.append("Devis accepté — ").append(providerName)
            .append(" (demande n° ").append(quote.getId()).append(").");
        if (quote.getMessage() != null && !quote.getMessage().isBlank()) {
            description.append("\n\nDemande : ").append(quote.getMessage());
        }
        if (quote.getQuoteMessage() != null && !quote.getQuoteMessage().isBlank()) {
            description.append("\n\nRéponse du prestataire : ").append(quote.getQuoteMessage());
        }
        // Le texte complet reste dans la demande ; la mission conserve son origine.
        return abbreviate(description.toString(), 500);
    }

    private static String abbreviate(String value, int maximum) {
        return value == null || value.length() <= maximum ? value : value.substring(0, maximum - 1) + "…";
    }

    /**
     * Type d'intervention issu de la prestation, ou du métier pour une demande sans prestation.
     *
     * <p>Repli sur {@code OTHER} plutot que de deviner : un type faux fausse le
     * planning et les statistiques, un type « autre » se corrige en un clic.</p>
     */
    private String resolveType(MarketplaceQuoteRequest quote) {
        if (quote.getServiceItemCode() != null && !quote.getServiceItemCode().isBlank()) {
            return ProviderCategoryMapper.interventionTypeForServiceItemCode(quote.getServiceItemCode()).name();
        }
        String category = quote.getCategoryCode();
        if (category == null) return "OTHER";
        // Les valeurs rendues sont celles d'InterventionType, verifiees une a
        // une : « MAINTENANCE » et « LAUNDRY » n'y existent pas, et une valeur
        // inconnue retomberait de toute facon sur OTHER — mais en silence, ce
        // qui est exactement le genre d'ecart qu'on ne remarque jamais.
        return switch (category) {
            case "CLEANING" -> InterventionType.CLEANING.name();
            case "MAINTENANCE" -> InterventionType.PREVENTIVE_MAINTENANCE.name();
            case "LOCKSMITH" -> InterventionType.EMERGENCY_REPAIR.name();
            case "POOL" -> InterventionType.EXTERIOR_CLEANING.name();
            case "EXTERIOR" -> InterventionType.GARDENING.name();
            case "REGULATORY" -> InterventionType.DISINFECTION.name();
            // Blanchisserie et linge n'ont pas de type d'intervention : ils
            // existent comme metier, pas comme travail sur un logement.
            default -> InterventionType.OTHER.name();
        };
    }

    private LocalDateTime resolveStart(MarketplaceQuoteRequest quote) {
        if (quote.getDesiredDate() != null) {
            return quote.getDesiredDate().atTime(quote.getRequestedStartTime() == null ? DEFAULT_START : quote.getRequestedStartTime());
        }
        // Sans date souhaitee, l'intervention part du moment de l'accord : une
        // date nulle est refusee par le schema, et une date arbitraire dans le
        // futur serait un engagement que personne n'a pris.
        return LocalDateTime.now(clock);
    }
}
