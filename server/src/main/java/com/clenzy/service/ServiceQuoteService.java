package com.clenzy.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Intervention;
import com.clenzy.model.ProviderAgreedRate;
import com.clenzy.dto.DocumentGenerationDto;
import com.clenzy.dto.GenerateDocumentRequest;
import com.clenzy.model.DocumentType;
import com.clenzy.model.NotificationKey;
import com.clenzy.repository.ProviderAgreedRateRepository;
import java.time.LocalDateTime;
import com.clenzy.model.ServiceQuote;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.repository.ServiceQuoteRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;

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

    private final ServiceQuoteRepository quoteRepository;
    private final InterventionRepository interventionRepository;
    private final UserRepository userRepository;
    private final ProviderAgreedRateRepository agreedRateRepository;
    private final NotificationService notificationService;
    private final Clock clock;
    private final DocumentGeneratorService documentGeneratorService;

    public ServiceQuoteService(ServiceQuoteRepository quoteRepository,
                               InterventionRepository interventionRepository,
                               UserRepository userRepository,
                               ProviderAgreedRateRepository agreedRateRepository,
                               NotificationService notificationService,
                               Clock clock,
                               DocumentGeneratorService documentGeneratorService) {
        this.quoteRepository = quoteRepository;
        this.interventionRepository = interventionRepository;
        this.userRepository = userRepository;
        this.agreedRateRepository = agreedRateRepository;
        this.notificationService = notificationService;
        this.clock = clock;
        this.documentGeneratorService = documentGeneratorService;
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
        ServiceQuote saved = create(orgId, quote);

        // Un devis qui dort dans une liste ne sert a rien : le gestionnaire doit
        // savoir qu'on attend sa reponse. Best-effort — une notification qui
        // echoue ne doit pas annuler le devis.
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
        } catch (Exception e) {
            log.warn("Notification de proposition de tarif echouee (devis {}) : {}",
                    saved.getId(), e.getMessage());
        }
        return saved;
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
     * <p>A l'APPROBATION seulement, et pas a la reception : le modele DEVIS tire
     * son montant de l'intervention ({@code InterventionTagResolver} : tags
     * {@code montant} et {@code total} = cout reel ou estime). Trois devis
     * concurrents rendraient donc trois PDF identiques, portant un montant qui
     * n'est celui d'aucun d'eux. L'approbation vient justement d'aligner
     * {@code estimatedCost} sur le montant retenu : le document est alors
     * exact.</p>
     *
     * <p>Best-effort et sans envoi de mail : un modele absent ou un rendu qui
     * echoue ne doit pas annuler l'approbation, qui reste la decision.</p>
     */
    private void generateQuoteDocument(ServiceQuote quote) {
        if (quote.getInterventionId() == null) {
            return;
        }
        try {
            GenerateDocumentRequest request = new GenerateDocumentRequest(
                    DocumentType.DEVIS.name(), quote.getInterventionId(), "intervention", null, false);
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
    @Transactional
    public ServiceQuote approve(Long id, Long orgId, String approvedBy) {
        final ServiceQuote quote = quoteRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new NotFoundException("Devis introuvable : " + id));
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
        generateQuoteDocument(quote);

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
