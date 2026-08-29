package com.clenzy.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionType;
import com.clenzy.model.ProviderAgreedRate;
import com.clenzy.dto.DocumentGenerationDto;
import com.clenzy.dto.GenerateDocumentRequest;
import com.clenzy.model.DocumentType;
import com.clenzy.dto.QuoteLineDto;
import com.clenzy.model.ContactMessageCategory;
import com.clenzy.model.ContactMessagePriority;
import com.clenzy.model.ContactThread;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.Property;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.TransactionStatus;
import com.clenzy.model.UserRole;
import com.clenzy.repository.ProviderAgreedRateRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import com.clenzy.model.ServiceQuote;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.repository.ServiceQuoteRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.clenzy.model.UserRole;
import com.clenzy.util.JwtRoleExtractor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Clock;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Devis prestataires (M4, vague M-B). L'approbation est la décision qui compte :
 * CAS RECEIVED → APPROVED (unique partiel DB : jamais deux devis approuvés sur la
 * même intervention), les concurrents sont écartés, et le montant approuvé devient
 * l'{@code estimatedCost} de l'intervention — la source que re-résolvent les cartes
 * aval (retenue de caution, accord travaux).
 */
@Service
public class ServiceQuoteService {

    private static final Logger log = LoggerFactory.getLogger(ServiceQuoteService.class);
    /** Les dates du devis sont des types java.time : le module est requis. */
    private static final com.fasterxml.jackson.databind.ObjectMapper RECAP_MAPPER =
            new com.fasterxml.jackson.databind.ObjectMapper()
                    .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule())
                    .disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private final ServiceQuoteRepository quoteRepository;
    private final InterventionRepository interventionRepository;
    private final UserRepository userRepository;
    private final ProviderAgreedRateRepository agreedRateRepository;
    private final NotificationService notificationService;
    private final Clock clock;
    private final DocumentGeneratorService documentGeneratorService;
    private final ContactThreadService contactThreadService;
    private final ServiceQuotePublisher publisher;
    private final PlatformSettingsService platformSettingsService;
    private final com.clenzy.repository.PaymentTransactionRepository paymentTransactionRepository;
    private final com.clenzy.repository.DocumentGenerationRepository documentGenerationRepository;
    private final com.clenzy.repository.OrganizationRepository organizationRepository;
    private final com.clenzy.service.agent.supervision.SupervisionTriggerService supervisionTriggerService;

    public ServiceQuoteService(ServiceQuoteRepository quoteRepository,
                               InterventionRepository interventionRepository,
                               UserRepository userRepository,
                               ProviderAgreedRateRepository agreedRateRepository,
                               NotificationService notificationService,
                               Clock clock,
                               DocumentGeneratorService documentGeneratorService,
                               ContactThreadService contactThreadService,
                               ServiceQuotePublisher publisher,
                               PlatformSettingsService platformSettingsService,
                               com.clenzy.repository.PaymentTransactionRepository paymentTransactionRepository,
                               com.clenzy.repository.DocumentGenerationRepository documentGenerationRepository,
                               com.clenzy.repository.OrganizationRepository organizationRepository,
                               com.clenzy.service.agent.supervision.SupervisionTriggerService supervisionTriggerService) {
        this.quoteRepository = quoteRepository;
        this.interventionRepository = interventionRepository;
        this.userRepository = userRepository;
        this.agreedRateRepository = agreedRateRepository;
        this.notificationService = notificationService;
        this.clock = clock;
        this.documentGeneratorService = documentGeneratorService;
        this.contactThreadService = contactThreadService;
        this.publisher = publisher;
        this.platformSettingsService = platformSettingsService;
        this.paymentTransactionRepository = paymentTransactionRepository;
        this.documentGenerationRepository = documentGenerationRepository;
        this.organizationRepository = organizationRepository;
        this.supervisionTriggerService = supervisionTriggerService;
    }

    @Transactional(readOnly = true)
    public List<ServiceQuote> listForIntervention(Long interventionId, Long orgId) {
        return quoteRepository.findByInterventionIdAndOrganizationIdOrderByAmountAsc(interventionId, orgId);
    }

    /**
     * Les devis SOUMIS par un intervenant.
     *
     * <p>L'auteur vient du JWT, jamais d'un parametre : accepter un
     * {@code providerUserId} en requete laisserait n'importe quel compte lire
     * les devis — donc les prix — d'un concurrent.</p>
     */
    @Transactional(readOnly = true)
    public List<ServiceQuote> listMine(String keycloakId, Long orgId) {
        User me = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new NotFoundException("Utilisateur introuvable"));
        return quoteRepository.findByProviderUserIdAndOrganizationIdOrderByCreatedAtDesc(me.getId(), orgId);
    }

    /**
     * Mes devis, avec de quoi les reconnaitre et savoir ou en est l'argent.
     *
     * <p>Le reglement se lit en deux temps : l'acompte, trace par une
     * transaction aboutie portant la mention DEPOSIT, puis le solde, porte par
     * le statut de paiement de l'intervention.</p>
     */
    @Transactional(readOnly = true)
    public List<com.clenzy.controller.ServiceQuoteController.MyQuoteDto> listMineDetailed(
            String keycloakId, Long orgId) {
        return listMine(keycloakId, orgId).stream().map(quote -> {
            Intervention intervention = quote.getInterventionId() != null
                    ? interventionRepository.findById(quote.getInterventionId()).orElse(null)
                    : null;
            Property property = intervention != null ? intervention.getProperty() : null;
            return new com.clenzy.controller.ServiceQuoteController.MyQuoteDto(
                    quote.getId(), quote.getInterventionId(),
                    intervention != null ? intervention.getTitle() : null,
                    quoteReference(quote),
                    property != null ? property.getName() : null,
                    property != null ? property.getAddress() : null,
                    property != null && property.getOwner() != null
                            ? property.getOwner().getFullName() : null,
                    agencyName(orgId),
                    intervention != null ? intervention.getType() : null,
                    intervention != null && intervention.getScheduledDate() != null
                            ? intervention.getScheduledDate().toString() : null,
                    intervention != null && intervention.getStatus() != null
                            ? intervention.getStatus().name() : null,
                    quote.getAmount(), quote.getCurrency(), quote.getValidUntil(),
                    quote.getDescription(), quote.getStatus().name(),
                    quote.getDepositAmount(),
                    resolvePaymentState(quote, intervention, orgId));
        }).toList();
    }

    /**
     * Reference lisible du devis.
     *
     * <p>Le numero legal du PDF quand il existe — c'est celui que le
     * proprietaire lira sur le document — sinon un repli sur l'identifiant, qui
     * reste citable au telephone.</p>
     */
    private String quoteReference(ServiceQuote quote) {
        if (quote.getDocumentRef() != null) {
            try {
                String legalNumber = documentGenerationRepository
                        .findById(Long.valueOf(quote.getDocumentRef()))
                        .map(com.clenzy.model.DocumentGeneration::getLegalNumber)
                        .orElse(null);
                if (legalNumber != null && !legalNumber.isBlank()) return legalNumber;
            } catch (NumberFormatException ignored) {
                // `documentRef` est un champ libre : un contenu non numerique
                // n'est pas une generation.
            }
        }
        return "DEV-" + quote.getId();
    }

    /** Nom de la conciergerie qui gere le bien. */
    private String agencyName(Long orgId) {
        return organizationRepository.findById(orgId)
                .map(com.clenzy.model.Organization::getName)
                .orElse(null);
    }

    private String resolvePaymentState(ServiceQuote quote, Intervention intervention, Long orgId) {
        if (intervention != null && intervention.getPaymentStatus() == PaymentStatus.PAID) {
            return "PAID";
        }
        if (quote.getDepositAmount() == null || quote.getInterventionId() == null) {
            return "UNPAID";
        }
        // La mention DEPOSIT vit dans la cle d'idempotence : c'est elle qui
        // distingue l'acompte du reglement complet sur la meme intervention.
        boolean depositPaid = paymentTransactionRepository
                .findByOrganizationIdAndSourceTypeAndSourceId(orgId, "INTERVENTION", quote.getInterventionId())
                .stream()
                .anyMatch(tx -> tx.getStatus() == TransactionStatus.COMPLETED
                        && tx.getIdempotencyKey() != null
                        && tx.getIdempotencyKey().contains("-DEPOSIT"));
        return depositPaid ? "DEPOSIT_PAID" : "UNPAID";
    }

    /**
     * Devis soumis PAR un intervenant : l'auteur est resolu depuis le JWT et
     * son nom prevaut sur celui du corps de requete — sinon n'importe qui
     * pourrait deposer un devis au nom d'un autre.
     */
    @Transactional
    public ServiceQuote submitAsProvider(Long orgId, ServiceQuote quote, String keycloakId) {
        User me = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new NotFoundException("Utilisateur introuvable"));
        quote.setProviderUserId(me.getId());
        quote.setProviderName(me.getFullName());
        quote.setProviderEmail(me.getEmail());
        applyMaintenanceDeposit(quote);
        ServiceQuote saved = create(orgId, quote);

        // PDF, discussion et notifications sont des effets APRES COMMIT. Places
        // dans la transaction, la moindre erreur la marquait rollback-only : le
        // devis lui-meme repartait alors en 500 alors qu'il etait valide
        // (regle audit n°2).
        final ServiceQuote persisted = saved;
        afterCommit(() -> publisher.publish(persisted, me,
                (q, p) -> publishQuote(q, p, orgId)));
        return saved;
    }

    /** Enregistre une action a executer une fois la transaction validee. */
    private void afterCommit(Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            action.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        action.run();
                    }
                });
    }

    /** Effets externes d'un devis soumis : document, discussion, notifications. */
    private void publishQuote(ServiceQuote saved, User me, Long orgId) {
        generateQuoteDocument(saved);
        try {
            String amount = saved.getAmount() != null
                    ? saved.getAmount().stripTrailingZeros().toPlainString() : "?";
            notificationService.notifyAdminsAndManagersByOrgId(orgId,
                    NotificationKey.INTERVENTION_ASSIGNED_TO_USER,
                    "Tarif propose par un intervenant",
                    me.getFullName() + " propose " + amount + " EUR pour l'intervention #"
                            + saved.getInterventionId() + ". A approuver.",
                    "/interventions/" + saved.getInterventionId());
            notifyPropertyOwner(saved, me.getFullName(), amount);
            openQuoteDiscussion(saved, me);
        } catch (Exception e) {
            log.warn("Notification de proposition de tarif echouee (devis {}) : {}",
                    saved.getId(), e.getMessage());
        }
    }

    /**
     * Mes tarifs CONVENUS, par logement.
     *
     * <p>C'est ce que l'ecran du terrain compare a ses propres tarifs : tant que
     * les deux coincident, l'accord tient et aucun devis n'est a refaire.</p>
     */
    @Transactional(readOnly = true)
    public List<ProviderAgreedRate> listMyAgreedRates(String keycloakId, Long orgId) {
        User me = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new NotFoundException("Utilisateur introuvable"));
        return agreedRateRepository.findByOrganizationIdAndProviderUserId(orgId, me.getId());
    }

    /**
     * Annonce l'approbation dans la discussion du devis.
     *
     * <p>Le proprietaire cliquait « Accepter » et il ne se passait rien de
     * visible : ni accuse de reception, ni indication de la suite. La reponse
     * vient du PRESTATAIRE — c'est lui qui s'engage a intervenir — et porte
     * l'acompte a regler quand il y en a un.</p>
     */
    private void announceApproval(ServiceQuote quote, Long orgId) {
        if (quote.getInterventionId() == null) return;
        ContactThread thread = contactThreadService
                .findByReference(orgId, "SERVICE_QUOTE_INTERVENTION", quote.getInterventionId())
                .orElse(null);
        if (thread == null) return;

        User provider = quote.getProviderUserId() != null
                ? userRepository.findById(quote.getProviderUserId()).orElse(null) : null;
        if (provider == null || provider.getKeycloakId() == null) return;

        boolean hasDeposit = quote.getDepositAmount() != null
                && quote.getDepositAmount().compareTo(BigDecimal.ZERO) > 0;

        StringBuilder reply = new StringBuilder("Merci pour votre validation. ");
        reply.append(hasDeposit
                ? "Je bloque la date une fois l'acompte regle."
                : "Je vous confirme mon intervention ; le reglement se fera une fois le travail termine.");

        try {
            contactThreadService.post(thread, provider.getKeycloakId(), null,
                    reply.toString(), ContactMessagePriority.MEDIUM,
                    hasDeposit ? depositCard(quote) : null);
        } catch (Exception e) {
            log.warn("Reponse automatique impossible sur le devis {} : {}",
                    quote.getId(), e.getMessage());
        }
    }

    /** Carte de reglement de l'acompte, payable par Stripe depuis la discussion. */
    private String depositCard(ServiceQuote quote) {
        Map<String, Object> card = new LinkedHashMap<>();
        card.put("kind", "QUOTE_DEPOSIT");
        card.put("quoteId", quote.getId());
        card.put("interventionId", quote.getInterventionId());
        card.put("amount", quote.getDepositAmount());
        card.put("currency", quote.getCurrency() != null ? quote.getCurrency() : "EUR");
        card.put("percent", quote.getDepositPercent());
        card.put("totalAmount", quote.getAmount());
        try {
            return RECAP_MAPPER.writeValueAsString(card);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Fige l'acompte exigible a la validation.
     *
     * <p>Le menage et la lingerie se paient au travail fait : rien a avancer.
     * Une maintenance peut demander du materiel ou immobiliser une journee —
     * d'ou un acompte, dont la plateforme fixe le taux. Le prestataire ne le
     * choisit pas : chacun fixerait le sien, et le proprietaire ne saurait plus
     * a quoi s'attendre.</p>
     *
     * <p>Le taux est copie sur le devis, pas seulement reference : le reglage
     * peut evoluer, un devis deja soumis ne change plus.</p>
     */
    private void applyMaintenanceDeposit(ServiceQuote quote) {
        if (quote.getInterventionId() == null || quote.getAmount() == null) return;
        Intervention intervention = interventionRepository.findById(quote.getInterventionId())
                .orElse(null);
        if (intervention == null || intervention.getType() == null) return;

        InterventionType type;
        try {
            type = InterventionType.valueOf(intervention.getType());
        } catch (IllegalArgumentException e) {
            return;
        }
        if (!type.isMaintenance()) return;

        BigDecimal percent = platformSettingsService.getOrDefault().getMaintenanceDepositPercent();
        if (percent == null || percent.compareTo(BigDecimal.ZERO) <= 0) return;

        quote.setDepositPercent(percent);
        quote.setDepositAmount(quote.getAmount()
                .multiply(percent)
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
    }

    /**
     * Ouvre la discussion du devis, avec le proprietaire ET la conciergerie.
     *
     * <p>Le devis partait en deux notifications separees : chacun voyait passer
     * un montant sans pouvoir en discuter avec l'autre. Un fil de groupe les
     * reunit autour du meme recapitulatif — et le meme fil sert aux devis
     * suivants sur la meme intervention.</p>
     */
    private void openQuoteDiscussion(ServiceQuote quote, User provider) {
        if (quote.getInterventionId() == null) return;
        Intervention intervention = interventionRepository.findById(quote.getInterventionId()).orElse(null);
        if (intervention == null) return;

        Set<String> participants = new LinkedHashSet<>();
        if (intervention.getProperty() != null && intervention.getProperty().getOwner() != null) {
            String ownerKeycloakId = intervention.getProperty().getOwner().getKeycloakId();
            if (ownerKeycloakId != null) participants.add(ownerKeycloakId);
        }
        userRepository.findByRoleIn(
                        List.of(UserRole.SUPER_ADMIN, UserRole.SUPER_MANAGER), quote.getOrganizationId())
                .stream().map(User::getKeycloakId).filter(Objects::nonNull)
                .forEach(participants::add);

        // Sans destinataire, le fil n'aurait que son auteur.
        if (participants.isEmpty()) return;

        String propertyName = intervention.getProperty() != null
                ? intervention.getProperty().getName() : "";
        String subject = "Devis — " + intervention.getTitle()
                + (propertyName.isBlank() ? "" : " (" + propertyName + ")");

        ContactThread thread = contactThreadService.openThread(
                quote.getOrganizationId(), subject, ContactMessageCategory.MAINTENANCE,
                provider.getKeycloakId(), "SERVICE_QUOTE_INTERVENTION", quote.getInterventionId(),
                participants);

        contactThreadService.post(thread, provider.getKeycloakId(), subject,
                quoteRecap(quote, intervention, provider), ContactMessagePriority.MEDIUM,
                quoteCard(quote, intervention, provider));
    }

    /**
     * Carte du devis rendue sous le message : le logement, le montant, le PDF a
     * ouvrir et les deux gestes de decision. Sans elle, le destinataire devait
     * quitter la discussion pour agir.
     */
    private String quoteCard(ServiceQuote quote, Intervention intervention, User provider) {
        Map<String, Object> card = new LinkedHashMap<>();
        card.put("kind", "SERVICE_QUOTE");
        card.put("quoteId", quote.getId());
        card.put("interventionId", intervention.getId());
        card.put("interventionTitle", intervention.getTitle());
        card.put("interventionType", intervention.getType());
        card.put("propertyName", intervention.getProperty() != null
                ? intervention.getProperty().getName() : null);
        card.put("propertyAddress", intervention.getProperty() != null
                ? intervention.getProperty().getAddress() : null);
        card.put("scheduledDate", intervention.getScheduledDate());
        card.put("providerName", provider.getFullName());
        card.put("amount", quote.getAmount());
        card.put("currency", quote.getCurrency() != null ? quote.getCurrency() : "EUR");
        card.put("validUntil", quote.getValidUntil());
        card.put("earliestStartDate", quote.getEarliestStartDate());
        card.put("lines", parseQuoteLines(quote.getLines()));
        card.put("depositPercent", quote.getDepositPercent());
        card.put("depositAmount", quote.getDepositAmount());
        // Le PDF est deja genere a ce stade : la carte en porte l'adresse.
        try {
            card.put("documentGenerationId", quote.getDocumentRef() != null
                    ? Long.valueOf(quote.getDocumentRef()) : null);
        } catch (NumberFormatException e) {
            card.put("documentGenerationId", null);
        }
        try {
            return RECAP_MAPPER.writeValueAsString(card);
        } catch (Exception e) {
            log.warn("Carte du devis {} non serialisable : {}", quote.getId(), e.getMessage());
            return null;
        }
    }

    /**
     * Le mot d'accompagnement du devis.
     *
     * <p>Il repetait le montant, le detail ligne a ligne et les dates — que la
     * carte affiche juste en dessous, en mieux. Le meme contenu deux fois ne
     * renseigne pas davantage, il fait douter de ce qu'on lit. Le message porte
     * donc ce que la carte ne dira jamais : une phrase d'un intervenant, et sa
     * note si elle apporte un contexte que les chiffres ne disent pas.</p>
     */
    private String quoteRecap(ServiceQuote quote, Intervention intervention, User provider) {
        StringBuilder message = new StringBuilder("Bonjour, voici mon devis pour cette intervention.");

        // Le mot libre de l'intervenant, s'il n'est pas juste la liste des
        // prestations que la carte detaille deja.
        String note = quote.getDescription();
        List<QuoteLineDto> lines = parseQuoteLines(quote.getLines());
        String linesJoined = lines.stream().map(QuoteLineDto::label)
                .collect(java.util.stream.Collectors.joining(" + "));
        if (note != null && !note.isBlank() && !note.trim().equals(linesJoined)) {
            message.append("\n\n").append(note.trim());
        }

        message.append("\n\nJe reste disponible si vous souhaitez en discuter.");
        return message.toString();
    }

    private List<QuoteLineDto> parseQuoteLines(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return RECAP_MAPPER.readValue(json,
                    new com.fasterxml.jackson.core.type.TypeReference<List<QuoteLineDto>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    /** Le proprietaire du logement est partie prenante du prix : il est prevenu aussi. */
    private void notifyPropertyOwner(ServiceQuote quote, String providerName, String amount) {
        if (quote.getInterventionId() == null) return;
        Intervention intervention = interventionRepository.findById(quote.getInterventionId()).orElse(null);
        if (intervention == null || intervention.getProperty() == null
                || intervention.getProperty().getOwner() == null) {
            return;
        }
        notificationService.notify(intervention.getProperty().getOwner().getKeycloakId(),
                NotificationKey.INTERVENTION_ASSIGNED_TO_USER,
                "Tarif propose pour une intervention",
                providerName + " propose " + amount + " EUR pour l'intervention sur "
                        + intervention.getProperty().getName() + ".",
                "/interventions/" + quote.getInterventionId());
    }

    @Transactional
    public ServiceQuote create(Long orgId, ServiceQuote quote) {
        // L'intervention rattachée doit appartenir à l'org (findById contourne le
        // filtre Hibernate — règle audit n°3) ; le logement du devis est le sien.
        final Intervention intervention = requireOwnedIntervention(quote.getInterventionId(), orgId);
        quote.setId(null);
        quote.setOrganizationId(orgId);
        quote.setPropertyId(intervention.getProperty().getId());
        quote.setStatus(ServiceQuote.Status.RECEIVED);
        return quoteRepository.save(quote);
    }

    /**
     * Produit le PDF du devis et retient sa generation sur le devis.
     *
     * <p>Un devis n'existait que comme trois nombres dans une liste : rien a
     * ouvrir, rien a transmettre au proprietaire. Le moteur de documents sait
     * deja rendre un DEVIS pour une intervention — il ne lui manquait que
     * d'etre appele.</p>
     *
     * <p>Genere DES LA SOUMISSION : c'est le document qu'on transmet pour
     * decision, il n'aurait aucun sens d'attendre l'approbation qu'il sert a
     * obtenir. Le rendu passe par {@code ReferenceType.SERVICE_QUOTE} et non
     * par l'intervention : les tags {@code montant} et {@code total} d'une
     * intervention portent SON cout, si bien que trois devis concurrents
     * auraient rendu trois PDF identiques affichant un montant qui n'est celui
     * d'aucun d'eux (cf. {@code ServiceQuoteTagResolver}).</p>
     *
     * <p>Best-effort et sans envoi de mail : un modele absent ou un rendu qui
     * echoue ne doit pas annuler le devis, qui reste la donnee.</p>
     */
    private void generateQuoteDocument(ServiceQuote quote) {
        if (quote.getId() == null) {
            return;
        }
        try {
            GenerateDocumentRequest request = new GenerateDocumentRequest(
                    DocumentType.DEVIS_PRESTATAIRE.name(), quote.getId(), "service_quote", null, false);
            DocumentGenerationDto generation = documentGeneratorService.generateDocument(request, null);
            if (generation != null && generation.id() != null) {
                quote.setDocumentRef(String.valueOf(generation.id()));
                quoteRepository.save(quote);
            }
        } catch (Exception e) {
            log.warn("Devis {} : generation du PDF impossible ({}) — le devis reste enregistre",
                    quote.getId(), e.getMessage());
        }
    }

    @Transactional
    public void delete(Long id, Long orgId) {
        final ServiceQuote quote = quoteRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new NotFoundException("Devis introuvable : " + id));
        if (quote.getStatus() == ServiceQuote.Status.APPROVED) {
            throw new IllegalStateException("Un devis approuvé ne se supprime pas — il se remplace");
        }
        quoteRepository.delete(quote);
    }

    /**
     * Approuve le devis : CAS RECEIVED → APPROVED, concurrents écartés, montant
     * reporté sur l'intervention. Échec explicite si le devis n'est plus RECEIVED
     * (déjà approuvé/écarté entre-temps — la carte peut être périmée).
     */
    /**
     * Qui tranche sur un devis.
     *
     * <p>Le controller n'exigeait que {@code isAuthenticated()} : tout membre de
     * l'organisation pouvait approuver n'importe quel devis — y compris
     * l'intervenant, sur le sien. Or accepter l'assignation et decider du PRIX
     * sont deux choses : le second appartient a la conciergerie et au
     * proprietaire du logement (regle audit n°2, validation d'ownership).</p>
     */
    private void assertCanDecide(ServiceQuote quote, Jwt jwt) {
        UserRole role = JwtRoleExtractor.extractUserRole(jwt);
        if (role != null && role.isPlatformStaff()) {
            return;
        }
        // Le proprietaire tranche sur SON bien, pas sur celui d'un autre.
        if (role == UserRole.HOST && quote.getInterventionId() != null && jwt != null) {
            Intervention intervention = interventionRepository.findById(quote.getInterventionId())
                    .orElse(null);
            if (intervention != null && intervention.getProperty() != null
                    && intervention.getProperty().getOwner() != null
                    && jwt.getSubject().equals(intervention.getProperty().getOwner().getKeycloakId())) {
                return;
            }
        }
        throw new AccessDeniedException(
                "Seuls la conciergerie et le proprietaire du logement decident d'un devis");
    }

    /**
     * Ecarte le devis sans en retenir un autre.
     *
     * <p>Le refus n'existait pas : seule la suppression, qui efface la trace de
     * ce qui avait ete propose. Un devis ecarte reste lisible — c'est
     * l'historique de la negociation.</p>
     */
    @Transactional
    public ServiceQuote reject(Long id, Long orgId, Jwt jwt) {
        final ServiceQuote quote = quoteRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new NotFoundException("Devis introuvable : " + id));
        assertCanDecide(quote, jwt);
        if (quote.getStatus() != ServiceQuote.Status.RECEIVED) {
            throw new IllegalStateException("Devis déjà " + quote.getStatus() + " — refus impossible");
        }
        quote.setStatus(ServiceQuote.Status.REJECTED);
        return quoteRepository.save(quote);
    }

    @Transactional
    public ServiceQuote approve(Long id, Long orgId, String approvedBy, Jwt jwt) {
        final ServiceQuote quote = quoteRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new NotFoundException("Devis introuvable : " + id));
        assertCanDecide(quote, jwt);
        return applyApproval(quote, id, orgId, approvedBy);
    }

    /**
     * Approbation par la constellation (carte HITL « Approuver un devis »).
     *
     * <p>Methode distincte, et non un {@code jwt} nul qui vaudrait passe-droit :
     * ce chemin n'a pas de porteur, sa legitimite vient de la carte qu'un
     * humain a appliquee.</p>
     */
    @Transactional
    public ServiceQuote approveFromSupervision(Long id, Long orgId, String appliedBy) {
        final ServiceQuote quote = quoteRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new NotFoundException("Devis introuvable : " + id));
        return applyApproval(quote, id, orgId, appliedBy);
    }

    private ServiceQuote applyApproval(ServiceQuote quote, Long id, Long orgId, String approvedBy) {
        if (quoteRepository.markApproved(id, orgId, approvedBy, clock.instant()) == 0) {
            throw new IllegalStateException("Devis déjà " + quote.getStatus()
                    + " — approbation impossible");
        }
        if (quote.getInterventionId() != null) {
            quoteRepository.rejectSiblings(quote.getInterventionId(), orgId, id);
            final Intervention intervention = requireOwnedIntervention(quote.getInterventionId(), orgId);
            intervention.setEstimatedCost(quote.getAmount());
            interventionRepository.save(intervention);
        }
        // L'accord se memorise : c'est lui qui evite de redemander un devis a
        // chaque mission suivante sur le meme logement, tant que l'intervenant
        // ne change pas son tarif.
        if (quote.getProviderUserId() != null && quote.getPropertyId() != null) {
            ProviderAgreedRate agreed = agreedRateRepository
                    .findByOrganizationIdAndProviderUserIdAndPropertyId(
                            orgId, quote.getProviderUserId(), quote.getPropertyId())
                    .orElseGet(ProviderAgreedRate::new);
            agreed.setOrganizationId(orgId);
            agreed.setProviderUserId(quote.getProviderUserId());
            agreed.setPropertyId(quote.getPropertyId());
            agreed.setAmount(quote.getAmount());
            agreed.setCurrency(quote.getCurrency() != null ? quote.getCurrency() : "EUR");
            agreed.setQuoteId(quote.getId());
            agreed.setUpdatedAt(LocalDateTime.now());
            if (agreed.getId() == null) {
                agreed.setAgreedAt(LocalDateTime.now());
            }
            agreedRateRepository.save(agreed);
        }

        log.info("Devis {} approuvé (org={}, intervention={}, montant={})",
                id, orgId, quote.getInterventionId(), quote.getAmount());

        // Un acompte approuve mais non encaisse bloque le chantier sans que rien
        // ne le signale cote gestion : on reveille la supervision sur le logement
        // pour que la carte « acompte a regler » remonte au prochain cycle.
        supervisionTriggerService.markDirtyAfterCommit(orgId, quote.getPropertyId());

        // Effets APRES commit : ecrire dans la discussion pendant la
        // transaction d'approbation la remettrait en cause si l'ecriture
        // echoue (regle audit n°2).
        final ServiceQuote approved = quote;
        afterCommit(() -> publisher.publish(approved, null,
                (q, ignored) -> announceApproval(q, orgId)));
        return quoteRepository.findByIdAndOrganizationId(id, orgId).orElse(quote);
    }

    private Intervention requireOwnedIntervention(Long interventionId, Long orgId) {
        if (interventionId == null) {
            throw new IllegalStateException("Devis sans intervention rattachée");
        }
        final Intervention intervention = interventionRepository.findById(interventionId)
                .orElseThrow(() -> new NotFoundException("Intervention introuvable : " + interventionId));
        if (intervention.getOrganizationId() == null
                || !intervention.getOrganizationId().equals(orgId)) {
            throw new NotFoundException("Intervention introuvable pour cette organisation");
        }
        return intervention;
    }
}
