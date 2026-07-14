package com.clenzy.service;

import com.clenzy.exception.DocumentGenerationException;
import com.clenzy.model.DocumentTemplate;
import com.clenzy.model.DocumentType;
import com.clenzy.model.Intervention;
import com.clenzy.model.Property;
import com.clenzy.model.ProviderExpense;
import com.clenzy.model.ReceivedForm;
import com.clenzy.model.Reservation;
import com.clenzy.model.ServiceRequest;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ProviderExpenseRepository;
import com.clenzy.repository.ReceivedFormRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import org.hibernate.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Previsualisation PDF d'un template : recherche d'une entite existante du type
 * approprie (chargement de contexte par type de reference), resolution des tags
 * via le MEME pipeline que la generation reelle, placeholders pour les tags non
 * resolus, puis rendu + conversion PDF. Aucune persistance, pas d'email, pas de
 * numerotation legale reelle.
 * <p>
 * Extrait de {@link DocumentGeneratorService} (refactor SRP) — comportement
 * strictement identique.
 */
@Service
public class DocumentPreviewService {

    private static final Logger log = LoggerFactory.getLogger(DocumentPreviewService.class);

    private final TagResolverService tagResolverService;
    private final DocumentNumberingService numberingService;
    private final DocumentComplianceService complianceService;
    private final LibreOfficeConversionService conversionService;
    private final TenantContext tenantContext;
    private final EntityManager entityManager;
    private final DocumentTemplateRenderer renderer;
    // Repos pour la preview reelle : on cherche la derniere entite existante
    // de chaque type et on appelle TagResolverService dessus (meme pipeline
    // que la generation reelle). Voir generatePreview().
    private final InterventionRepository interventionRepository;
    private final ReceivedFormRepository receivedFormRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final ReservationRepository reservationRepository;
    private final PropertyRepository propertyRepository;
    private final ProviderExpenseRepository providerExpenseRepository;

    public DocumentPreviewService(
            TagResolverService tagResolverService,
            DocumentNumberingService numberingService,
            DocumentComplianceService complianceService,
            LibreOfficeConversionService conversionService,
            TenantContext tenantContext,
            EntityManager entityManager,
            DocumentTemplateRenderer renderer,
            InterventionRepository interventionRepository,
            ReceivedFormRepository receivedFormRepository,
            ServiceRequestRepository serviceRequestRepository,
            ReservationRepository reservationRepository,
            PropertyRepository propertyRepository,
            ProviderExpenseRepository providerExpenseRepository
    ) {
        this.tagResolverService = tagResolverService;
        this.numberingService = numberingService;
        this.complianceService = complianceService;
        this.conversionService = conversionService;
        this.tenantContext = tenantContext;
        this.entityManager = entityManager;
        this.renderer = renderer;
        this.interventionRepository = interventionRepository;
        this.receivedFormRepository = receivedFormRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.reservationRepository = reservationRepository;
        this.propertyRepository = propertyRepository;
        this.providerExpenseRepository = providerExpenseRepository;
    }

    /**
     * Genere un PDF de previsualisation du template en utilisant le MEME
     * pipeline que la generation reelle (TagResolverService) sur une entite
     * existante la plus recente du type approprie (intervention, devis, etc.).
     * <p>
     * Le filtre Hibernate "organizationFilter" est desactive pour cette requete :
     * la preview est restreinte aux roles SUPER_ADMIN / SUPER_MANAGER (cf.
     * DocumentController @PreAuthorize), qui ont legitimement acces cross-org.
     * <p>
     * <b>Filter safety</b> : le disableFilter est entoure d'un try-finally pour
     * eviter de fuir l'etat de session vers les requetes suivantes sur le meme
     * thread (sinon = data leak cross-tenant).
     */
    public byte[] generatePreview(DocumentTemplate template) {
        Session session = entityManager.unwrap(Session.class);
        // Memorise l'etat actuel pour le restaurer en finally (defensive : si le
        // filter etait deja desactive en amont on ne le re-active pas par erreur).
        boolean wasFilterEnabled = session.getEnabledFilter("organizationFilter") != null;
        try {
            if (wasFilterEnabled) {
                session.disableFilter("organizationFilter");
            }

            byte[] templateContent = renderer.resolveTemplateContent(template);
            Map<String, Object> context = buildPreviewContext(template);

            // Tags de conformite (numero legal factice pour la preview)
            if (numberingService.requiresLegalNumber(template.getDocumentType(),
                                                    tenantContext.getCountryCode())) {
                String previewLegalNumber = "PREVIEW-" + template.getDocumentType().name() + "-0001";
                Map<String, Object> nfTags = complianceService.resolveComplianceTags(
                        template.getDocumentType(), previewLegalNumber);
                context.put("nf", nfTags);
            }

            // Placeholder pour les tags non resolus (evite le crash Freemarker).
            // Variante visible : champ manquant -> "—" pour que la preview montre les zones a remplir.
            renderer.fillMissingTags(template, context, true);

            byte[] filledOdt = renderer.fillTemplate(templateContent, context);
            return conversionService.convertToPdf(filledOdt, template.getOriginalFilename());
        } catch (Exception e) {
            log.error("Erreur preview template id={}: {}", template.getId(), e.getMessage(), e);
            throw new DocumentGenerationException("Impossible de generer la previsualisation : " + e.getMessage());
        } finally {
            // CRITIQUE : re-active le filter pour ne pas contaminer les requetes
            // suivantes sur le meme thread/connexion (cross-tenant data leak).
            if (wasFilterEnabled && session.getEnabledFilter("organizationFilter") == null) {
                session.enableFilter("organizationFilter");
            }
        }
    }

    /**
     * Trouve une entite existante adaptee au documentType et appelle
     * TagResolverService.resolveTagsForDocument dessus — meme chemin que la
     * generation reelle. Cela garantit que les Map/List/Boolean sont produits
     * avec la bonne structure (ex: intervention.lignes est bien une List).
     * <p>
     * Defensive : si TagResolverService leve (donnees corrompues, FK manquante),
     * on log warn et on continue avec un contexte vide — la preview reste
     * generable avec des placeholders via {@link DocumentTemplateRenderer#fillMissingTags}.
     */
    private Map<String, Object> buildPreviewContext(DocumentTemplate template) {
        DocumentType type = template.getDocumentType();
        for (String refType : candidateRefTypes(type)) {
            Long sampleId = findLatestId(refType);
            if (sampleId == null) continue;

            log.debug("Preview template {} ({}): utilisation de {} #{}",
                    template.getName(), type, refType, sampleId);
            try {
                Map<String, Object> ctx = tagResolverService.resolveTagsForDocument(
                        type, sampleId, refType);
                if (ctx != null && !ctx.isEmpty()) {
                    return new LinkedHashMap<>(ctx);
                }
            } catch (Exception ex) {
                log.warn("Preview template {} ({}): resolveTagsForDocument a echoue sur {} #{} : {} — fallback type suivant",
                        template.getName(), type, refType, sampleId, ex.getMessage());
            }
        }
        log.warn("Preview template {} ({}): aucune entite exploitable, contexte vide (placeholders pour tous les tags)",
                template.getName(), type);
        return new LinkedHashMap<>();
    }

    // NB : le remplissage tolerant des tags manquants (placeholders typees) est
    // delegue a DocumentTemplateRenderer.fillMissingTags(..., true) — voir generatePreview().

    /**
     * Ordre de preference des types de reference pour generer un preview
     * en fonction du documentType. Calque sur l'usage reel :
     * - DEVIS : public form → received_form, sinon service_request, sinon intervention
     * - FACTURE / BON_INTERVENTION / etc. : intervention (a des lignes)
     * - MANDAT / AUTORISATION : property
     * - BON_COMMANDE : provider_expense
     */
    private List<String> candidateRefTypes(DocumentType type) {
        return switch (type) {
            case DEVIS -> List.of("received_form", "service_request", "intervention", "reservation");
            case FACTURE, BON_INTERVENTION, VALIDATION_FIN_MISSION,
                 JUSTIFICATIF_PAIEMENT, JUSTIFICATIF_REMBOURSEMENT
                    -> List.of("intervention", "reservation");
            case MANDAT_GESTION, AUTORISATION_TRAVAUX -> List.of("property", "intervention");
            // Devis ménage (3A) : toujours référencé sur un logement.
            case DEVIS_MENAGE -> List.of("property");
            case BON_COMMANDE -> List.of("provider_expense", "intervention");
        };
    }

    /** Recupere l'id de l'entite la plus recente d'un type donne (par id DESC). */
    private Long findLatestId(String refType) {
        Pageable one = PageRequest.of(0, 1, Sort.by(Sort.Direction.DESC, "id"));
        return switch (refType) {
            case "intervention" -> interventionRepository.findAll(one).stream().findFirst()
                    .map(Intervention::getId).orElse(null);
            case "received_form" -> receivedFormRepository.findAll(one).stream().findFirst()
                    .map(ReceivedForm::getId).orElse(null);
            case "service_request" -> serviceRequestRepository.findAll(one).stream().findFirst()
                    .map(ServiceRequest::getId).orElse(null);
            case "reservation" -> reservationRepository.findAll(one).stream().findFirst()
                    .map(Reservation::getId).orElse(null);
            case "property" -> propertyRepository.findAll(one).stream().findFirst()
                    .map(Property::getId).orElse(null);
            case "provider_expense" -> providerExpenseRepository.findAll(one).stream().findFirst()
                    .map(ProviderExpense::getId).orElse(null);
            default -> null;
        };
    }

}
