package com.clenzy.service;

import com.clenzy.dto.OwnerConstellationPublicDto;
import com.clenzy.dto.OwnerConstellationPublicDto.ActivityLineDto;
import com.clenzy.dto.OwnerConstellationPublicDto.PropertyAgentActivityDto;
import com.clenzy.dto.OwnerDashboardDto;
import com.clenzy.dto.OwnerPortalLinkDto;
import com.clenzy.model.Organization;
import com.clenzy.model.OwnerPortalToken;
import com.clenzy.model.Property;
import com.clenzy.model.SupervisionActivity;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.OwnerPortalTokenRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.SupervisionActivityRepository;
import com.clenzy.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Constellation Proprietaire (campagne X9 v1) : liens publics en LECTURE SEULE
 * que la conciergerie partage a ses proprietaires — transparence IA white-label
 * (« ce que les agents ont fait pour VOTRE bien »), adossee au tableau de bord
 * proprietaire existant ({@link OwnerPortalService}).
 *
 * <p><b>Securite</b> : le token UUID est l'unique credential (pattern livret
 * d'accueil). La vue publique est entierement derivee de l'org et du
 * proprietaire portes par le token — aucun parametre client n'influence le
 * scoping. Les biens sont filtres org + proprietaire (HP-02 : findByOwnerId
 * n'est pas org-filtre, le filtre explicite est obligatoire).</p>
 */
@Service
public class OwnerConstellationService {

    private static final Logger log = LoggerFactory.getLogger(OwnerConstellationService.class);

    private static final int DEFAULT_VALIDITY_DAYS = 365;
    private static final int MAX_VALIDITY_DAYS = 730;
    private static final int RECENT_LINES_PER_PROPERTY = 10;
    private static final int ACTIVITY_WINDOW_DAYS = 30;

    private final OwnerPortalTokenRepository tokenRepository;
    private final OwnerPortalService ownerPortalService;
    private final PropertyRepository propertyRepository;
    private final SupervisionActivityRepository activityRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;

    public OwnerConstellationService(OwnerPortalTokenRepository tokenRepository,
                                     OwnerPortalService ownerPortalService,
                                     PropertyRepository propertyRepository,
                                     SupervisionActivityRepository activityRepository,
                                     OrganizationRepository organizationRepository,
                                     UserRepository userRepository) {
        this.tokenRepository = tokenRepository;
        this.ownerPortalService = ownerPortalService;
        this.propertyRepository = propertyRepository;
        this.activityRepository = activityRepository;
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
    }

    /**
     * Genere un lien pour un proprietaire de l'organisation courante.
     * Refuse si le proprietaire n'a aucun bien dans l'org (pas de lien vide,
     * et surtout pas de lien cross-org).
     */
    @Transactional
    public OwnerPortalLinkDto createLink(Long organizationId, Long ownerId,
                                         Integer validityDays, String frontendUrl) {
        if (ownerPropertiesInOrg(ownerId, organizationId).isEmpty()) {
            throw new AccessDeniedException(
                    "Ce proprietaire n'a aucun bien dans votre organisation");
        }
        int days = validityDays == null
                ? DEFAULT_VALIDITY_DAYS
                : Math.min(Math.max(validityDays, 1), MAX_VALIDITY_DAYS);
        OwnerPortalToken token = new OwnerPortalToken(organizationId, ownerId,
                LocalDateTime.now().plusDays(days));
        tokenRepository.save(token);
        log.info("[OWNER-CONSTELLATION] Lien genere : org={} owner={} expire={}",
                organizationId, ownerId, token.getExpiresAt());
        return toLinkDto(token, frontendUrl);
    }

    /** Liens existants d'un proprietaire (gestion conciergerie). */
    @Transactional(readOnly = true)
    public List<OwnerPortalLinkDto> listLinks(Long organizationId, Long ownerId, String frontendUrl) {
        return tokenRepository.findByOrganizationIdAndOwnerIdOrderByCreatedAtDesc(organizationId, ownerId)
                .stream()
                .map(t -> toLinkDto(t, frontendUrl))
                .toList();
    }

    /** Revoque un lien de l'organisation courante (validation d'appartenance explicite). */
    @Transactional
    public void revokeLink(Long organizationId, Long tokenId) {
        OwnerPortalToken token = tokenRepository.findById(tokenId)
                .orElseThrow(() -> new IllegalArgumentException("Lien introuvable : " + tokenId));
        if (!token.getOrganizationId().equals(organizationId)) {
            throw new AccessDeniedException("Ce lien n'appartient pas a votre organisation");
        }
        token.setRevoked(true);
        tokenRepository.save(token);
        log.info("[OWNER-CONSTELLATION] Lien revoque : org={} id={}", organizationId, tokenId);
    }

    /**
     * Vue publique lecture seule. Empty si token inconnu, expire ou revoque —
     * le controller repond 404 sans distinguer les cas (pas d'oracle).
     */
    @Transactional(readOnly = true)
    public Optional<OwnerConstellationPublicDto> getPublicView(UUID token) {
        OwnerPortalToken portalToken = tokenRepository.findByToken(token).orElse(null);
        if (portalToken == null || !portalToken.isCurrentlyValid()) {
            return Optional.empty();
        }
        Long orgId = portalToken.getOrganizationId();
        Long ownerId = portalToken.getOwnerId();

        Organization organization = organizationRepository.findById(orgId).orElse(null);
        String conciergerieName = organization != null ? nullSafe(organization.getName()) : "";
        String ownerDisplayName = userRepository.findById(ownerId)
                .map(u -> (nullSafe(u.getFirstName()) + " " + nullSafe(u.getLastName())).trim())
                .orElse("");

        OwnerDashboardDto dashboard = ownerPortalService.getDashboard(ownerId, orgId);

        Instant since = Instant.now().minus(ACTIVITY_WINDOW_DAYS, ChronoUnit.DAYS);
        List<PropertyAgentActivityDto> agentActivity = ownerPropertiesInOrg(ownerId, orgId).stream()
                .map(property -> buildPropertyActivity(orgId, property, since))
                .toList();

        return Optional.of(new OwnerConstellationPublicDto(
                conciergerieName, ownerDisplayName,
                organization != null ? organization.getBrandingLogoUrl() : null,
                organization != null ? organization.getBrandingPrimaryColor() : null,
                dashboard, agentActivity));
    }

    /** Branding white-label courant de l'org (X9-b). */
    @Transactional(readOnly = true)
    public Map<String, String> getBranding(Long organizationId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new IllegalArgumentException("Organisation introuvable : " + organizationId));
        Map<String, String> branding = new java.util.LinkedHashMap<>();
        branding.put("logoUrl", organization.getBrandingLogoUrl());
        branding.put("primaryColor", organization.getBrandingPrimaryColor());
        return branding;
    }

    /**
     * Met a jour le branding white-label (X9-b). Logo : HTTPS uniquement
     * (jamais de http/data/javascript sur une page publique) ; couleur : hex
     * #RRGGBB strict. Vide/null = retire.
     */
    @Transactional
    public Map<String, String> updateBranding(Long organizationId, String logoUrl, String primaryColor) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new IllegalArgumentException("Organisation introuvable : " + organizationId));

        String cleanedLogo = logoUrl == null || logoUrl.isBlank() ? null : logoUrl.trim();
        if (cleanedLogo != null) {
            if (!cleanedLogo.startsWith("https://")) {
                throw new IllegalArgumentException("L'URL du logo doit etre en HTTPS");
            }
            if (cleanedLogo.length() > 500) {
                throw new IllegalArgumentException("URL du logo trop longue (max 500 caracteres)");
            }
        }
        String cleanedColor = primaryColor == null || primaryColor.isBlank() ? null : primaryColor.trim();
        if (cleanedColor != null && !cleanedColor.matches("#[0-9A-Fa-f]{6}")) {
            throw new IllegalArgumentException("Couleur invalide : format attendu #RRGGBB");
        }

        organization.setBrandingLogoUrl(cleanedLogo);
        organization.setBrandingPrimaryColor(cleanedColor);
        organizationRepository.save(organization);
        log.info("[OWNER-CONSTELLATION] Branding mis a jour : org={} logo={} couleur={}",
                organizationId, cleanedLogo != null, cleanedColor);
        return getBranding(organizationId);
    }

    private PropertyAgentActivityDto buildPropertyActivity(Long orgId, Property property, Instant since) {
        long actions = activityRepository.countByOrganizationIdAndPropertyIdAndKindAndCreatedAtAfter(
                orgId, property.getId(), SupervisionActivity.KIND_ACT, since);
        long suggestions = activityRepository.countByOrganizationIdAndPropertyIdAndKindAndCreatedAtAfter(
                orgId, property.getId(), SupervisionActivity.KIND_SUGGEST, since);
        List<ActivityLineDto> recent = activityRepository
                .findByOrganizationIdAndPropertyIdOrderByCreatedAtDesc(
                        orgId, property.getId(), PageRequest.of(0, RECENT_LINES_PER_PROPERTY))
                .stream()
                .map(a -> new ActivityLineDto(a.getCreatedAt(), a.getModuleKey(), a.getKind(), a.getSummary()))
                .toList();
        return new PropertyAgentActivityDto(property.getId(), property.getName(),
                actions, suggestions, recent);
    }

    /** Biens du proprietaire DANS l'org (HP-02 : findByOwnerId n'est pas org-filtre). */
    private List<Property> ownerPropertiesInOrg(Long ownerId, Long organizationId) {
        return propertyRepository.findByOwnerId(ownerId).stream()
                .filter(p -> organizationId != null && organizationId.equals(p.getOrganizationId()))
                .toList();
    }

    private OwnerPortalLinkDto toLinkDto(OwnerPortalToken token, String frontendUrl) {
        return new OwnerPortalLinkDto(
                token.getId(),
                frontendUrl + "/owner-view/" + token.getToken(),
                token.getExpiresAt(),
                token.isRevoked(),
                token.getCreatedAt());
    }

    private static String nullSafe(String value) {
        return value == null ? "" : value;
    }
}
