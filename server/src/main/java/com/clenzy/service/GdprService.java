package com.clenzy.service;

import com.clenzy.dto.GdprConsentUpdateDto;
import com.clenzy.dto.GdprExportDto;
import com.clenzy.model.*;
import com.clenzy.repository.AuditLogRepository;
import com.clenzy.repository.GdprConsentRepository;
import com.clenzy.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service RGPD — Gere la conformite au Reglement General sur la Protection des Donnees.
 *
 * Fonctionnalites :
 * - Export des donnees personnelles (Article 15 droit d'acces + Article 20 portabilite)
 * - Anonymisation irreversible (Article 17 droit a l'effacement)
 * - Gestion des consentements (Article 7)
 * - Registre des traitements (Article 30)
 */
@Service
public class GdprService {

    private static final Logger log = LoggerFactory.getLogger(GdprService.class);

    private final UserRepository userRepository;
    private final GdprConsentRepository gdprConsentRepository;
    private final AuditLogRepository auditLogRepository;
    private final AuditLogService auditLogService;

    public GdprService(UserRepository userRepository,
                       GdprConsentRepository gdprConsentRepository,
                       AuditLogRepository auditLogRepository,
                       AuditLogService auditLogService) {
        this.userRepository = userRepository;
        this.gdprConsentRepository = gdprConsentRepository;
        this.auditLogRepository = auditLogRepository;
        this.auditLogService = auditLogService;
    }

    // ═══════════════════════════════════════════════════════════════════
    // 1. EXPORT DES DONNEES — Article 15 (acces) + Article 20 (portabilite)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Exporte toutes les donnees personnelles d'un utilisateur.
     * Le format est structure en JSON pour permettre la portabilite.
     */
    @Transactional(readOnly = true)
    public GdprExportDto exportUserData(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable: " + userId));

        GdprExportDto export = new GdprExportDto();
        export.setExportDate(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

        // Section 1: Donnees personnelles
        export.setPersonalData(buildUserSection(user));

        // Section 2: Proprietes
        export.setProperties(buildPropertySections(user));

        // Section 3: Consentements
        export.setConsents(buildConsentSections(userId));

        // Section 4: Historique d'activite (50 derniers logs)
        export.setActivityLog(buildAuditSections(user.getKeycloakId()));

        // Audit de l'export lui-meme
        auditLogService.logAction(AuditAction.EXPORT, "User", String.valueOf(userId),
                null, null, "Export RGPD des donnees personnelles", AuditSource.WEB);

        log.info("Export RGPD genere pour l'utilisateur {}", userId);
        return export;
    }

    private GdprExportDto.UserDataSection buildUserSection(User user) {
        GdprExportDto.UserDataSection section = new GdprExportDto.UserDataSection();
        section.setId(user.getId());
        section.setFirstName(user.getFirstName());
        section.setLastName(user.getLastName());
        section.setEmail(user.getEmail());
        section.setPhoneNumber(user.getPhoneNumber());
        section.setRole(user.getRole().name());
        section.setStatus(user.getStatus().name());
        section.setProfilePictureUrl(user.getProfilePictureUrl());
        section.setEmailVerified(user.isEmailVerified());
        section.setPhoneVerified(user.isPhoneVerified());
        section.setLastLogin(user.getLastLogin());
        section.setCreatedAt(user.getCreatedAt());
        return section;
    }

    private List<GdprExportDto.PropertyDataSection> buildPropertySections(User user) {
        return user.getProperties().stream()
                .map(property -> {
                    GdprExportDto.PropertyDataSection section = new GdprExportDto.PropertyDataSection();
                    section.setId(property.getId());
                    section.setName(property.getName());
                    section.setAddress(property.getAddress());
                    section.setCity(property.getCity());
                    section.setPostalCode(property.getPostalCode());
                    section.setCountry(property.getCountry());
                    section.setCreatedAt(property.getCreatedAt());
                    return section;
                })
                .collect(Collectors.toList());
    }

    private List<GdprExportDto.ConsentDataSection> buildConsentSections(Long userId) {
        return gdprConsentRepository.findByUserId(userId).stream()
                .map(consent -> {
                    GdprExportDto.ConsentDataSection section = new GdprExportDto.ConsentDataSection();
                    section.setConsentType(consent.getConsentType().name());
                    section.setGranted(consent.isGranted());
                    section.setVersion(consent.getVersion());
                    section.setGrantedAt(consent.getGrantedAt());
                    section.setRevokedAt(consent.getRevokedAt());
                    return section;
                })
                .collect(Collectors.toList());
    }

    private List<GdprExportDto.AuditDataSection> buildAuditSections(String keycloakId) {
        if (keycloakId == null) {
            return Collections.emptyList();
        }
        Page<AuditLog> auditLogs = auditLogRepository.findByUserIdOrderByTimestampDesc(
                keycloakId, PageRequest.of(0, 50));
        return auditLogs.getContent().stream()
                .map(auditLog -> {
                    GdprExportDto.AuditDataSection section = new GdprExportDto.AuditDataSection();
                    section.setAction(auditLog.getAction().name());
                    section.setEntityType(auditLog.getEntityType());
                    section.setEntityId(auditLog.getEntityId());
                    section.setDetails(auditLog.getDetails());
                    section.setTimestamp(auditLog.getTimestamp().toString());
                    return section;
                })
                .collect(Collectors.toList());
    }

    // ═══════════════════════════════════════════════════════════════════
    // 2. ANONYMISATION — Article 17 (droit a l'effacement)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Anonymise irreversiblement les donnees personnelles d'un utilisateur.
     * Remplace toutes les PII par des valeurs generiques.
     * L'utilisateur reste en base (pour integrite referentielle) mais n'est plus identifiable.
     *
     * ATTENTION : Action IRREVERSIBLE.
     */
    @Transactional
    public void anonymizeUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable: " + userId));

        // Verifier que l'utilisateur n'est pas deja anonymise
        if ("Anonyme".equals(user.getFirstName()) && user.getStatus() == UserStatus.DELETED) {
            log.warn("L'utilisateur {} est deja anonymise", userId);
            return;
        }

        String oldEmail = user.getEmail();

        // Anonymisation des champs PII
        String anonymousId = "anon_" + UUID.randomUUID().toString().substring(0, 8);
        user.setFirstName("Anonyme");
        user.setLastName("Utilisateur");
        user.setEmail(anonymousId + "@anonymized.clenzy.fr");
        user.setPassword("ANONYMIZED");
        user.setPhoneNumber(null);
        user.setProfilePictureUrl(null);
        user.setCognitoUserId(null);
        user.setKeycloakId(null);
        user.setStatus(UserStatus.DELETED);
        user.setEmailVerified(false);
        user.setPhoneVerified(false);

        userRepository.save(user);

        // Supprimer les consentements (plus necessaires)
        gdprConsentRepository.deleteByUserId(userId);

        // Audit (avec l'ancien email pour tracabilite juridique)
        auditLogService.logAction(AuditAction.DELETE, "User", String.valueOf(userId),
                "email=" + oldEmail, "ANONYMIZED",
                "Anonymisation RGPD irreversible (Article 17)", AuditSource.SYSTEM);

        log.info("Utilisateur {} anonymise avec succes (RGPD Article 17)", userId);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 3. GESTION DES CONSENTEMENTS — Article 7
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Retourne l'etat actuel des consentements d'un utilisateur.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getConsentStatus(Long userId) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", userId);

        Map<String, Object> consents = new LinkedHashMap<>();
        for (GdprConsent.ConsentType type : GdprConsent.ConsentType.values()) {
            Optional<GdprConsent> latest = gdprConsentRepository
                    .findTopByUserIdAndConsentTypeOrderByVersionDesc(userId, type);

            Map<String, Object> consentInfo = new LinkedHashMap<>();
            if (latest.isPresent()) {
                GdprConsent consent = latest.get();
                consentInfo.put("granted", consent.isGranted());
                consentInfo.put("version", consent.getVersion());
                consentInfo.put("grantedAt", consent.getGrantedAt());
                consentInfo.put("revokedAt", consent.getRevokedAt());
            } else {
                consentInfo.put("granted", false);
                consentInfo.put("version", 0);
                consentInfo.put("grantedAt", null);
                consentInfo.put("revokedAt", null);
            }
            consents.put(type.name(), consentInfo);
        }

        result.put("consents", consents);
        return result;
    }

    /**
     * Met a jour les consentements d'un utilisateur.
     * Chaque modification cree une nouvelle version (historique complet).
     */
    @Transactional
    public void updateConsents(Long userId, GdprConsentUpdateDto dto, String ipAddress) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable: " + userId));

        if (dto.getConsents() == null || dto.getConsents().isEmpty()) {
            return;
        }

        for (Map.Entry<String, Boolean> entry : dto.getConsents().entrySet()) {
            GdprConsent.ConsentType consentType;
            try {
                consentType = GdprConsent.ConsentType.valueOf(entry.getKey());
            } catch (IllegalArgumentException e) {
                log.warn("Type de consentement inconnu: {}", entry.getKey());
                continue;
            }

            boolean granted = entry.getValue();

            // Trouver la derniere version pour ce type
            Optional<GdprConsent> latestOpt = gdprConsentRepository
                    .findTopByUserIdAndConsentTypeOrderByVersionDesc(userId, consentType);

            int newVersion = latestOpt.map(c -> c.getVersion() + 1).orElse(1);

            // Creer une nouvelle entree (historique versionne)
            GdprConsent consent = new GdprConsent(user, consentType, granted, ipAddress);
            consent.setVersion(newVersion);

            if (!granted) {
                consent.setRevokedAt(LocalDateTime.now());
            }

            gdprConsentRepository.save(consent);

            log.info("Consentement {} mis a jour pour utilisateur {} : granted={}, version={}",
                    consentType, userId, granted, newVersion);
        }

        // Audit
        auditLogService.logAction(AuditAction.UPDATE, "GdprConsent", String.valueOf(userId),
                null, dto.getConsents().toString(),
                "Mise a jour des consentements RGPD", AuditSource.WEB);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4. REGISTRE DES TRAITEMENTS — Article 30
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Retourne le registre des categories de donnees personnelles traitees par Clenzy.
     * Exigence de transparence du RGPD.
     */
    public List<Map<String, String>> getDataCategories() {
        List<Map<String, String>> categories = new ArrayList<>();

        categories.add(Map.of(
                "category", "Identite",
                "data", "Nom, prenom, email, telephone",
                "purpose", "Gestion du compte utilisateur et communication",
                "legalBasis", "Execution du contrat (Article 6.1.b)",
                "retention", "Duree du compte + 3 ans apres suppression"
        ));

        categories.add(Map.of(
                "category", "Authentification",
                "data", "Mot de passe (hashé), identifiant Keycloak",
                "purpose", "Securisation de l'acces au compte",
                "legalBasis", "Execution du contrat (Article 6.1.b)",
                "retention", "Duree du compte"
        ));

        categories.add(Map.of(
                "category", "Proprietes",
                "data", "Adresses, descriptions, photos des logements",
                "purpose", "Gestion locative et coordination des interventions",
                "legalBasis", "Execution du contrat (Article 6.1.b)",
                "retention", "Duree du compte + 3 ans apres suppression"
        ));

        categories.add(Map.of(
                "category", "Reservations",
                "data", "Dates, noms des voyageurs, montants",
                "purpose", "Planification des interventions de menage",
                "legalBasis", "Execution du contrat (Article 6.1.b)",
                "retention", "5 ans (obligations comptables)"
        ));

        categories.add(Map.of(
                "category", "Paiements",
                "data", "Montants, references Stripe (pas de numeros de carte)",
                "purpose", "Facturation et suivi comptable",
                "legalBasis", "Obligation legale (Article 6.1.c)",
                "retention", "10 ans (obligations fiscales)"
        ));

        categories.add(Map.of(
                "category", "Integration Airbnb",
                "data", "Tokens OAuth chiffres, identifiants listings",
                "purpose", "Synchronisation automatique des reservations",
                "legalBasis", "Consentement explicite (Article 6.1.a)",
                "retention", "Jusqu'a revocation de la connexion"
        ));

        categories.add(Map.of(
                "category", "Logs d'audit",
                "data", "Actions, adresses IP, User-Agent",
                "purpose", "Securite et tracabilite (exigence Airbnb Partner)",
                "legalBasis", "Interet legitime (Article 6.1.f)",
                "retention", "2 ans"
        ));

        categories.add(Map.of(
                "category", "Consentements",
                "data", "Historique des consentements, horodatage, adresse IP",
                "purpose", "Preuve de conformite RGPD",
                "legalBasis", "Obligation legale (Article 6.1.c)",
                "retention", "5 ans apres revocation"
        ));

        return categories;
    }
}
