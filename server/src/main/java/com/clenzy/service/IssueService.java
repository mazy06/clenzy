package com.clenzy.service;

import com.clenzy.dto.IssueDtos.CreateIssueRequest;
import com.clenzy.dto.IssueDtos.DismissIssueRequest;
import com.clenzy.dto.IssueDtos.IssueDto;
import com.clenzy.dto.IssueDtos.QualifyIssueRequest;
import com.clenzy.dto.PricingConfigDto;
import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Intervention;
import com.clenzy.model.Issue;
import com.clenzy.model.Issue.IssueSeverity;
import com.clenzy.model.Issue.IssueStatus;
import com.clenzy.model.IssuePhoto;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.Priority;
import com.clenzy.model.Property;
import com.clenzy.model.ServiceType;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.IssuePhotoRepository;
import com.clenzy.repository.IssueRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.ArrayList;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Anomalies terrain (Moteur Ménage 3C / P10) : le signalement du terrain devient
 * un ticket de premier ordre, qualifiable puis convertible en demande de
 * maintenance pré-chiffrée.
 *
 * <p>Chiffrage suggéré : correspondance de la catégorie avec le catalogue travaux
 * de l'org ({@link PricingConfigService#getTravaux()}) — d'abord par
 * interventionType/label exact (normalisé), puis par domaine. Sans correspondance,
 * {@code suggestedCost} reste null (chiffrage manuel à la qualification).</p>
 */
@Service
@Transactional
public class IssueService {

    private static final Logger log = LoggerFactory.getLogger(IssueService.class);

    private final IssueRepository issueRepository;
    private final IssuePhotoRepository issuePhotoRepository;
    private final InterventionRepository interventionRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final PricingConfigService pricingConfigService;
    private final ServiceRequestService serviceRequestService;
    private final NotificationService notificationService;
    private final OrganizationAccessGuard accessGuard;
    private final TenantContext tenantContext;

    public IssueService(IssueRepository issueRepository,
                        IssuePhotoRepository issuePhotoRepository,
                        InterventionRepository interventionRepository,
                        PropertyRepository propertyRepository,
                        UserRepository userRepository,
                        PricingConfigService pricingConfigService,
                        ServiceRequestService serviceRequestService,
                        NotificationService notificationService,
                        OrganizationAccessGuard accessGuard,
                        TenantContext tenantContext) {
        this.issueRepository = issueRepository;
        this.issuePhotoRepository = issuePhotoRepository;
        this.interventionRepository = interventionRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.pricingConfigService = pricingConfigService;
        this.serviceRequestService = serviceRequestService;
        this.notificationService = notificationService;
        this.accessGuard = accessGuard;
        this.tenantContext = tenantContext;
    }

    // ── Création ─────────────────────────────────────────────────────────────

    /**
     * Crée une anomalie. Le signaleur est TOUJOURS résolu depuis le JWT.
     * Si {@code sourceInterventionId} est fourni, l'ownership org de
     * l'intervention est validé et le logement en est dérivé.
     */
    public IssueDto create(CreateIssueRequest request, String reporterKeycloakId) {
        User reporter = requireUser(reporterKeycloakId);
        Property property = resolveProperty(request);
        accessGuard.requireSameOrganization(property.getOrganizationId(), "Logement " + property.getId());

        Issue issue = new Issue();
        issue.setOrganizationId(property.getOrganizationId());
        issue.setPropertyId(property.getId());
        issue.setSourceInterventionId(request.sourceInterventionId());
        issue.setReportedBy(reporter.getId());
        issue.setTitle(request.title());
        issue.setDescription(request.description());
        issue.setCategory(request.category());
        issue.setSeverity(request.severity() != null ? request.severity() : IssueSeverity.MEDIUM);
        issue.setSuggestedCost(suggestCostFromCatalog(request.category()));
        issue = issueRepository.save(issue);

        notifyReported(issue, property);
        return toDto(issue, property.getName(), reporter.getFullName(), List.of());
    }

    private Property resolveProperty(CreateIssueRequest request) {
        if (request.sourceInterventionId() != null) {
            Intervention intervention = interventionRepository.findById(request.sourceInterventionId())
                    .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));
            // findById contourne le filtre Hibernate → ownership org explicite (règle audit n°3).
            accessGuard.requireSameOrganization(intervention.getOrganizationId(),
                    "Intervention " + intervention.getId());
            if (intervention.getProperty() != null) {
                return intervention.getProperty();
            }
        }
        if (request.propertyId() == null) {
            throw new IllegalArgumentException("propertyId ou sourceInterventionId requis");
        }
        return propertyRepository.findById(request.propertyId())
                .orElseThrow(() -> new NotFoundException("Logement non trouvé"));
    }

    // ── Photos ───────────────────────────────────────────────────────────────

    /** Au-dela, le signalement documente moins qu'il n'encombre. */
    private static final int MAX_PHOTOS_PER_ISSUE = 6;
    private static final long MAX_PHOTO_BYTES = 5L * 1024 * 1024;
    private static final Set<String> ALLOWED_PHOTO_TYPES =
            Set.of("image/jpeg", "image/png", "image/webp", "image/gif");

    /**
     * Joint des photos a un signalement. Le terrain photographie l'anomalie au
     * moment ou il la constate — c'est la seule occasion.
     */
    public IssueDto addPhotos(Long issueId, List<MultipartFile> files, String uploaderKeycloakId) {
        Issue issue = requireIssue(issueId);
        User uploader = requireUser(uploaderKeycloakId);

        long existing = issuePhotoRepository.countByIssueId(issueId);
        if (existing + files.size() > MAX_PHOTOS_PER_ISSUE) {
            throw new IllegalArgumentException(
                    "Maximum " + MAX_PHOTOS_PER_ISSUE + " photos par signalement (deja " + existing + ").");
        }

        for (MultipartFile file : files) {
            if (file.isEmpty()) {
                continue;
            }
            if (file.getSize() > MAX_PHOTO_BYTES) {
                throw new IllegalArgumentException("Chaque photo doit peser moins de 5 Mo.");
            }
            String contentType = file.getContentType();
            if (contentType == null || !ALLOWED_PHOTO_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
                throw new IllegalArgumentException("Formats acceptes : JPEG, PNG, WEBP, GIF.");
            }
            IssuePhoto photo = new IssuePhoto();
            photo.setIssueId(issue.getId());
            photo.setOrganizationId(issue.getOrganizationId());
            photo.setOriginalFilename(file.getOriginalFilename());
            photo.setContentType(contentType);
            photo.setFileSize(file.getSize());
            photo.setUploadedById(uploader.getId());
            try {
                photo.setData(file.getBytes());
            } catch (java.io.IOException e) {
                throw new IllegalArgumentException("Lecture du fichier impossible : " + e.getMessage(), e);
            }
            issuePhotoRepository.save(photo);
        }

        return toDtoWithLookups(issue);
    }

    /**
     * Binaire d'une photo. Le signalement porte l'organisation : la photo est
     * chargee par identifiant, donc l'appartenance est verifiee explicitement
     * (regle audit n°3).
     *
     * @return [octets, contentType]
     */
    @Transactional(readOnly = true)
    public Object[] streamPhoto(Long issueId, Long photoId) {
        IssuePhoto photo = issuePhotoRepository.findById(photoId)
                .orElseThrow(() -> new NotFoundException("Photo non trouvee"));
        if (!Objects.equals(photo.getIssueId(), issueId)) {
            throw new NotFoundException("Photo non trouvee");
        }
        accessGuard.requireSameOrganization(photo.getOrganizationId(), "Photo " + photoId);
        if (photo.getData() == null) {
            return null;
        }
        return new Object[] { photo.getData(), photo.getContentType() };
    }

    // ── Lecture ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<IssueDto> list(IssueStatus status, Long propertyId) {
        return list(status, propertyId, null);
    }

    /**
     * Variante « mes signalements » (mobile pro) : {@code reporterKeycloakId}
     * non-null restreint aux anomalies signalées par CE user (toujours org-scopé).
     */
    @Transactional(readOnly = true)
    public List<IssueDto> list(IssueStatus status, Long propertyId, String reporterKeycloakId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Long reportedBy = reporterKeycloakId != null ? requireUser(reporterKeycloakId).getId() : null;
        List<Issue> issues = issueRepository.findByOrgWithFilters(orgId, status, propertyId, reportedBy);

        Map<Long, String> propertyNames = propertyRepository.findAllById(
                        issues.stream().map(Issue::getPropertyId).filter(Objects::nonNull).distinct().toList())
                .stream().collect(Collectors.toMap(Property::getId, Property::getName));
        Map<Long, String> reporterNames = userRepository.findAllById(
                        issues.stream().map(Issue::getReportedBy).filter(Objects::nonNull).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, User::getFullName));

        Map<Long, List<String>> photosByIssue = photoUrlsByIssue(
                issues.stream().map(Issue::getId).toList());

        return issues.stream()
                .map(issue -> toDto(issue,
                        propertyNames.get(issue.getPropertyId()),
                        reporterNames.get(issue.getReportedBy()),
                        photosByIssue.getOrDefault(issue.getId(), List.of())))
                .toList();
    }

    @Transactional(readOnly = true)
    public IssueDto get(Long id) {
        Issue issue = requireIssue(id);
        return toDtoWithLookups(issue);
    }

    // ── Qualification / conversion / rejet ──────────────────────────────────

    /**
     * Le gestionnaire ajuste catégorie/sévérité/chiffrage → statut QUALIFIED.
     * Un {@code suggestedCost} explicite prime ; sinon une nouvelle catégorie
     * re-déclenche la suggestion catalogue.
     */
    public IssueDto qualify(Long id, QualifyIssueRequest request) {
        Issue issue = requireIssue(id);
        requireStatusIn(issue, EnumSet.of(IssueStatus.OPEN, IssueStatus.QUALIFIED));

        if (request.category() != null) {
            issue.setCategory(request.category());
        }
        if (request.severity() != null) {
            issue.setSeverity(request.severity());
        }
        if (request.suggestedCost() != null) {
            issue.setSuggestedCost(request.suggestedCost().setScale(2, RoundingMode.HALF_UP));
        } else if (request.category() != null) {
            BigDecimal suggested = suggestCostFromCatalog(request.category());
            if (suggested != null) {
                issue.setSuggestedCost(suggested);
            }
        }
        issue.setStatus(IssueStatus.QUALIFIED);
        issue = issueRepository.save(issue);
        return toDtoWithLookups(issue);
    }

    /**
     * Convertit l'anomalie en ServiceRequest MAINTENANCE pré-chiffrée
     * ({@code estimatedCost} = {@code suggestedCost}) via le flux de création
     * existant — la SR entre ensuite dans le flux normal validation/paiement.
     * Le statut est réclamé par UPDATE conditionnel (pas de double conversion
     * concurrente) ; un échec de création de SR annule tout (même transaction).
     */
    public IssueDto convert(Long id, String converterKeycloakId) {
        Issue issue = requireIssue(id);
        int claimed = issueRepository.transitionStatus(id, IssueStatus.CONVERTED,
                EnumSet.of(IssueStatus.OPEN, IssueStatus.QUALIFIED));
        if (claimed == 0) {
            throw new IllegalStateException(
                    "Conversion impossible depuis le statut " + issue.getStatus());
        }
        User converter = requireUser(converterKeycloakId);

        ServiceRequestDto srDto = new ServiceRequestDto();
        srDto.title = issue.getTitle();
        srDto.description = buildServiceRequestDescription(issue);
        srDto.serviceType = resolveMaintenanceType(issue);
        srDto.priority = toPriority(issue.getSeverity());
        srDto.urgent = issue.getSeverity() == IssueSeverity.CRITICAL;
        srDto.desiredDate = LocalDateTime.now().plusDays(1);
        srDto.propertyId = issue.getPropertyId();
        srDto.userId = converter.getId();
        srDto.estimatedCost = issue.getSuggestedCost();
        ServiceRequestDto created = serviceRequestService.create(srDto);

        issue.setStatus(IssueStatus.CONVERTED);
        issue.setConvertedServiceRequestId(created.id);
        issue = issueRepository.save(issue);

        notifyConverted(issue);
        return toDtoWithLookups(issue);
    }

    public IssueDto dismiss(Long id, DismissIssueRequest request) {
        Issue issue = requireIssue(id);
        requireStatusIn(issue, EnumSet.of(IssueStatus.OPEN, IssueStatus.QUALIFIED));
        issue.setStatus(IssueStatus.DISMISSED);
        issue.setDismissReason(request != null ? request.reason() : null);
        issue = issueRepository.save(issue);
        return toDtoWithLookups(issue);
    }

    // ── Chiffrage suggéré (catalogue travaux) ────────────────────────────────

    /**
     * Correspondance catégorie ↔ catalogue travaux : 1er passage sur
     * interventionType/label exact (normalisé accents/casse/underscores),
     * 2e passage sur le domaine (ex. « Plomberie »). Null si aucun match.
     */
    BigDecimal suggestCostFromCatalog(String category) {
        String needle = normalize(category);
        if (needle.isEmpty()) {
            return null;
        }
        List<PricingConfigDto.ServicePriceConfig> catalog = pricingConfigService.getTravaux();
        return catalog.stream()
                .filter(item -> item.isEnabled() && item.getBasePrice() != null)
                .filter(item -> needle.equals(normalize(item.getInterventionType()))
                        || needle.equals(normalize(item.getLabel())))
                .findFirst()
                .or(() -> catalog.stream()
                        .filter(item -> item.isEnabled() && item.getBasePrice() != null)
                        .filter(item -> needle.equals(normalize(item.getDomain())))
                        .findFirst())
                .map(item -> BigDecimal.valueOf(item.getBasePrice()).setScale(2, RoundingMode.HALF_UP))
                .orElse(null);
    }

    private static String normalize(String value) {
        if (value == null) {
            return "";
        }
        String stripped = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return stripped.toLowerCase(Locale.ROOT).replaceAll("[_\\s]+", " ").trim();
    }

    // ── Helpers privés ───────────────────────────────────────────────────────

    private Issue requireIssue(Long id) {
        Issue issue = issueRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Anomalie non trouvée"));
        // findById contourne le filtre Hibernate → ownership org explicite (règle audit n°3).
        accessGuard.requireSameOrganization(issue.getOrganizationId(), "Anomalie " + id);
        return issue;
    }

    private User requireUser(String keycloakId) {
        return userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new NotFoundException("Utilisateur non trouvé"));
    }

    private static void requireStatusIn(Issue issue, EnumSet<IssueStatus> allowed) {
        if (!allowed.contains(issue.getStatus())) {
            throw new IllegalStateException(
                    "Transition impossible depuis le statut " + issue.getStatus());
        }
    }

    /**
     * Type de maintenance de la SR : la catégorie si elle correspond à un
     * {@link ServiceType} de maintenance, sinon réparation d'urgence pour les
     * sévérités hautes, maintenance préventive sinon.
     */
    private static ServiceType resolveMaintenanceType(Issue issue) {
        if (issue.getCategory() != null) {
            try {
                ServiceType candidate = ServiceType.valueOf(issue.getCategory().trim().toUpperCase(Locale.ROOT));
                if (candidate.isMaintenanceService()) {
                    return candidate;
                }
            } catch (IllegalArgumentException ignored) {
                // Catégorie libre — repli sur la sévérité.
            }
        }
        return issue.getSeverity() == IssueSeverity.CRITICAL || issue.getSeverity() == IssueSeverity.HIGH
                ? ServiceType.EMERGENCY_REPAIR
                : ServiceType.PREVENTIVE_MAINTENANCE;
    }

    private static Priority toPriority(IssueSeverity severity) {
        return switch (severity) {
            case LOW -> Priority.LOW;
            case MEDIUM -> Priority.NORMAL;
            case HIGH -> Priority.HIGH;
            case CRITICAL -> Priority.CRITICAL;
        };
    }

    private static String buildServiceRequestDescription(Issue issue) {
        StringBuilder sb = new StringBuilder();
        if (issue.getDescription() != null && !issue.getDescription().isBlank()) {
            sb.append(issue.getDescription()).append("\n\n");
        }
        sb.append("Créée depuis l'anomalie terrain #").append(issue.getId());
        if (issue.getSourceInterventionId() != null) {
            sb.append(" (constatée pendant l'intervention #")
              .append(issue.getSourceInterventionId()).append(")");
        }
        return sb.toString();
    }

    // ── Notifications (in-app + push via NotificationService) ───────────────

    private void notifyReported(Issue issue, Property property) {
        String severityLabel = issue.getSeverity().name();
        String message = "Anomalie signalée sur " + property.getName() + " : "
                + issue.getTitle() + " (" + severityLabel + ")";
        String actionUrl = "/interventions?tab=issues&highlight=" + issue.getId();
        try {
            notificationService.notifyAdminsAndManagers(
                    NotificationKey.ISSUE_REPORTED, "Anomalie terrain signalée", message, actionUrl);
            if (property.getOwner() != null) {
                notificationService.notify(property.getOwner().getKeycloakId(),
                        NotificationKey.ISSUE_REPORTED, "Anomalie terrain signalée", message, actionUrl);
            }
        } catch (Exception e) {
            log.warn("Notification error ISSUE_REPORTED (issue={}): {}", issue.getId(), e.getMessage());
        }
    }

    private void notifyConverted(Issue issue) {
        String cost = issue.getSuggestedCost() != null
                ? issue.getSuggestedCost().toPlainString() + " €"
                : "à chiffrer";
        String message = "Anomalie « " + issue.getTitle()
                + " » convertie en demande de maintenance — coût estimé " + cost;
        String actionUrl = "/service-requests/" + issue.getConvertedServiceRequestId();
        try {
            Property property = propertyRepository.findById(issue.getPropertyId()).orElse(null);
            if (property != null && property.getOwner() != null) {
                notificationService.notify(property.getOwner().getKeycloakId(),
                        NotificationKey.ISSUE_CONVERTED, "Anomalie convertie en maintenance",
                        message, actionUrl);
            }
        } catch (Exception e) {
            log.warn("Notification error ISSUE_CONVERTED (issue={}): {}", issue.getId(), e.getMessage());
        }
    }

    // ── Mapping DTO ──────────────────────────────────────────────────────────

    private IssueDto toDtoWithLookups(Issue issue) {
        String propertyName = propertyRepository.findById(issue.getPropertyId())
                .map(Property::getName).orElse(null);
        String reporterName = issue.getReportedBy() != null
                ? userRepository.findById(issue.getReportedBy()).map(User::getFullName).orElse(null)
                : null;
        return toDto(issue, propertyName, reporterName, photoUrls(issue.getId()));
    }

    /** Idem en lot, pour ne pas requeter une fois par signalement. */
    private Map<Long, List<String>> photoUrlsByIssue(List<Long> issueIds) {
        if (issueIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<String>> byIssue = new java.util.HashMap<>();
        for (Object[] pair : issuePhotoRepository.findIdPairsByIssueIds(issueIds)) {
            Long issueId = (Long) pair[0];
            Long photoId = (Long) pair[1];
            byIssue.computeIfAbsent(issueId, key -> new ArrayList<>())
                    .add("/api/issues/" + issueId + "/photos/" + photoId + "/data");
        }
        return byIssue;
    }

    /** Adresses de lecture des photos — jamais leur binaire. */
    private List<String> photoUrls(Long issueId) {
        return issuePhotoRepository.findIdsByIssueId(issueId).stream()
                .map(photoId -> "/api/issues/" + issueId + "/photos/" + photoId + "/data")
                .collect(Collectors.toList());
    }

    private static IssueDto toDto(Issue issue, String propertyName, String reporterName,
                                  List<String> photoUrls) {
        return new IssueDto(
                issue.getId(),
                issue.getPropertyId(),
                propertyName,
                issue.getSourceInterventionId(),
                issue.getReportedBy(),
                reporterName,
                issue.getTitle(),
                issue.getDescription(),
                issue.getCategory(),
                issue.getSeverity(),
                issue.getStatus(),
                issue.getSuggestedCost(),
                issue.getConvertedServiceRequestId(),
                issue.getDismissReason(),
                photoUrls,
                issue.getCreatedAt(),
                issue.getUpdatedAt());
    }
}
