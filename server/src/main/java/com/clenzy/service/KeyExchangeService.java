package com.clenzy.service;

import com.clenzy.dto.keyexchange.*;
import com.clenzy.model.KeyExchangeCode;
import com.clenzy.model.KeyExchangeCode.CodeStatus;
import com.clenzy.model.KeyExchangeCode.CodeType;
import com.clenzy.model.KeyExchangeEvent;
import com.clenzy.model.KeyExchangeEvent.EventSource;
import com.clenzy.model.KeyExchangeEvent.EventType;
import com.clenzy.model.KeyExchangePoint;
import com.clenzy.model.KeyExchangePoint.GuardianType;
import com.clenzy.model.KeyExchangePoint.PointStatus;
import com.clenzy.model.KeyExchangePoint.Provider;
import com.clenzy.repository.KeyExchangeCodeRepository;
import com.clenzy.repository.KeyExchangeEventRepository;
import com.clenzy.repository.KeyExchangePointRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service metier pour la gestion des echanges de cles.
 * Supporte deux providers : KeyNest (service tiers) et Clenzy KeyVault (solution proprietaire).
 */
@Service
public class KeyExchangeService {

    private static final Logger log = LoggerFactory.getLogger(KeyExchangeService.class);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final KeyExchangePointRepository pointRepository;
    private final KeyExchangeCodeRepository codeRepository;
    private final KeyExchangeEventRepository eventRepository;
    private final PropertyRepository propertyRepository;
    private final TenantContext tenantContext;
    private final KeyVerificationThrottle verificationThrottle;

    public KeyExchangeService(KeyExchangePointRepository pointRepository,
                              KeyExchangeCodeRepository codeRepository,
                              KeyExchangeEventRepository eventRepository,
                              PropertyRepository propertyRepository,
                              TenantContext tenantContext,
                              KeyVerificationThrottle verificationThrottle) {
        this.pointRepository = pointRepository;
        this.codeRepository = codeRepository;
        this.eventRepository = eventRepository;
        this.propertyRepository = propertyRepository;
        this.tenantContext = tenantContext;
        this.verificationThrottle = verificationThrottle;
    }

    // ═══════════════════════════════════════════════════════════════
    // Points d'echange (CRUD)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Liste tous les points d'echange actifs de l'organisation.
     */
    public List<KeyExchangePointDto> getPoints(String userId) {
        return pointRepository.findByStatus(PointStatus.ACTIVE).stream()
                .map(this::toPointDto)
                .collect(Collectors.toList());
    }

    /**
     * Cree un nouveau point d'echange.
     */
    @Transactional
    public KeyExchangePointDto createPoint(String userId, CreateKeyExchangePointDto dto) {
        propertyRepository.findById(dto.getPropertyId())
                .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable: " + dto.getPropertyId()));

        Provider provider;
        try {
            provider = Provider.valueOf(dto.getProvider());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Provider invalide: " + dto.getProvider() + " (KEYNEST ou CLENZY_KEYVAULT)");
        }

        KeyExchangePoint point = new KeyExchangePoint();
        point.setUserId(userId);
        point.setOrganizationId(tenantContext.getRequiredOrganizationId());
        point.setPropertyId(dto.getPropertyId());
        point.setProvider(provider);
        point.setProviderStoreId(dto.getProviderStoreId());
        point.setStoreName(dto.getStoreName());
        point.setStoreAddress(dto.getStoreAddress());
        point.setStorePhone(dto.getStorePhone());
        point.setStoreLat(dto.getStoreLat());
        point.setStoreLng(dto.getStoreLng());
        point.setStoreOpeningHours(dto.getStoreOpeningHours());
        point.setStatus(PointStatus.ACTIVE);

        // Type de gardien (uniquement pour Clenzy KeyVault)
        if (provider == Provider.CLENZY_KEYVAULT) {
            GuardianType guardianType = GuardianType.MERCHANT; // defaut
            if (dto.getGuardianType() != null) {
                try {
                    guardianType = GuardianType.valueOf(dto.getGuardianType());
                } catch (IllegalArgumentException e) {
                    throw new IllegalArgumentException("Type de gardien invalide: " + dto.getGuardianType() + " (MERCHANT ou INDIVIDUAL)");
                }
            }
            point.setGuardianType(guardianType);
        }

        // Token de verification unique pour la page publique (Clenzy KeyVault)
        if (provider == Provider.CLENZY_KEYVAULT) {
            point.setVerificationToken(UUID.randomUUID().toString().replace("-", ""));
        }

        KeyExchangePoint saved = pointRepository.save(point);
        log.info("Point d'echange cree: {} (provider={}, property={}) par user={}",
                saved.getStoreName(), provider, dto.getPropertyId(), userId);

        return toPointDto(saved);
    }

    /**
     * Supprime un point d'echange.
     */
    @Transactional
    public void deletePoint(String userId, Long pointId) {
        KeyExchangePoint point = pointRepository.findByIdAndUserId(pointId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Point d'echange introuvable: " + pointId));

        pointRepository.delete(point);
        log.info("Point d'echange supprime: {} (id={}) par user={}", point.getStoreName(), pointId, userId);
    }

    // ═══════════════════════════════════════════════════════════════
    // Codes d'echange
    // ═══════════════════════════════════════════════════════════════

    /**
     * Liste les codes actifs d'un point.
     */
    public List<KeyExchangeCodeDto> getActiveCodesByPoint(Long pointId) {
        return codeRepository.findByPointIdAndStatus(pointId, CodeStatus.ACTIVE).stream()
                .map(this::toCodeDto)
                .collect(Collectors.toList());
    }

    /**
     * Genere un code d'echange (Clenzy KeyVault : code 6 chiffres interne).
     * Pour KeyNest, un appel API externe est necessaire.
     *
     * TODO [KEYNEST-7] — Connecter la generation de code au vrai API KeyNest
     *   Actuellement le code KeyNest est un placeholder ("KN-" + 6 chiffres).
     *   Une fois les credentials API obtenus, remplacer par :
     *
     *   1. Injecter KeyNestApiService dans ce service
     *   2. Dans le bloc `else` (provider != CLENZY_KEYVAULT) :
     *      a) Si c'est la premiere cle pour ce point :
     *         Map<String, String> result = keyNestApiService.createKeyWithCollectionCode(
     *             point.getProviderStoreId(), "Cle " + point.getStoreName());
     *         code = result.get("collectionCode");
     *         exchangeCode.setProviderCodeId(result.get("keyId"));  // stocker l'ID KeyNest
     *      b) Si une cle existe deja pour ce point :
     *         Map<String, String> result = keyNestApiService.createCollectionCode(existingKeyId);
     *         code = result.get("code");
     *         exchangeCode.setProviderCodeId(result.get("codeId"));
     *   3. Gerer les erreurs API KeyNest (circuit breaker, retries)
     *   4. Si KeyNest est indisponible, laisser le code placeholder + alerter
     */
    @Transactional
    public KeyExchangeCodeDto generateCode(String userId, CreateKeyExchangeCodeDto dto) {
        KeyExchangePoint point = pointRepository.findById(dto.getPointId())
                .orElseThrow(() -> new IllegalArgumentException("Point d'echange introuvable: " + dto.getPointId()));

        CodeType codeType = CodeType.COLLECTION;
        if (dto.getCodeType() != null) {
            try {
                codeType = CodeType.valueOf(dto.getCodeType());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Type de code invalide: " + dto.getCodeType());
            }
        }

        String code;
        if (point.getProvider() == Provider.CLENZY_KEYVAULT) {
            code = generateUniqueCode();
        } else {
            // TODO [KEYNEST-7] — Remplacer ce placeholder par l'appel reel KeyNestApiService
            // Voir le Javadoc de cette methode pour les instructions detaillees.
            // Pour l'instant, on genere un code placeholder tant que l'API n'est pas connectee.
            code = "KN-" + generateUniqueCode();
        }

        KeyExchangeCode exchangeCode = new KeyExchangeCode();
        exchangeCode.setOrganizationId(tenantContext.getRequiredOrganizationId());
        exchangeCode.setPointId(point.getId());
        exchangeCode.setPropertyId(point.getPropertyId());
        exchangeCode.setReservationId(dto.getReservationId());
        exchangeCode.setGuestName(dto.getGuestName());
        exchangeCode.setCode(code);
        exchangeCode.setCodeType(codeType);
        exchangeCode.setStatus(CodeStatus.ACTIVE);
        exchangeCode.setValidFrom(dto.getValidFrom() != null ? dto.getValidFrom() : LocalDateTime.now());
        exchangeCode.setValidUntil(dto.getValidUntil());

        KeyExchangeCode saved = codeRepository.save(exchangeCode);

        // Creer evenement CODE_GENERATED
        createEvent(point.getOrganizationId(), saved.getId(), point.getId(),
                point.getPropertyId(), EventType.CODE_GENERATED,
                dto.getGuestName(), "Code genere: " + code, EventSource.MANUAL);

        log.info("Code d'echange genere: {} (point={}, guest={}) par user={}",
                code, point.getStoreName(), dto.getGuestName(), userId);

        return toCodeDto(saved);
    }

    /**
     * Annule un code d'echange.
     *
     * TODO [KEYNEST-8] — Ajouter l'annulation cote KeyNest
     *   Quand le code est lie a un provider KeyNest (providerCodeId non null),
     *   appeler keyNestApiService.cancelCode(code.getProviderCodeId()) AVANT
     *   de marquer le code comme CANCELLED dans notre base.
     *   Gerer le cas ou l'appel KeyNest echoue (retry ? log + annulation locale quand meme ?)
     */
    @Transactional
    public void cancelCode(String userId, Long codeId) {
        KeyExchangeCode code = codeRepository.findById(codeId)
                .orElseThrow(() -> new IllegalArgumentException("Code introuvable: " + codeId));

        if (code.getStatus() != CodeStatus.ACTIVE) {
            throw new IllegalStateException("Le code n'est pas actif (statut: " + code.getStatus() + ")");
        }

        // TODO [KEYNEST-8] — Appeler keyNestApiService.cancelCode() si provider = KEYNEST
        // if (code.getProviderCodeId() != null) {
        //     keyNestApiService.cancelCode(code.getProviderCodeId());
        // }

        code.setStatus(CodeStatus.CANCELLED);
        codeRepository.save(code);

        createEvent(code.getOrganizationId(), code.getId(), code.getPointId(),
                code.getPropertyId(), EventType.CODE_CANCELLED,
                null, "Code annule par " + userId, EventSource.MANUAL);

        log.info("Code d'echange annule: {} (id={}) par user={}", code.getCode(), codeId, userId);
    }

    // ═══════════════════════════════════════════════════════════════
    // Page publique de verification (Clenzy KeyVault)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Verifie un code via la page publique du commercant.
     * Retourne les infos necessaires a l'affichage.
     */
    public Map<String, Object> verifyCodePublic(String verificationToken, String code) {
        verificationThrottle.assertNotLocked(verificationToken);

        KeyExchangePoint point = pointRepository.findByVerificationToken(verificationToken)
                .orElseThrow(() -> new IllegalArgumentException("Lien de verification invalide"));

        // Message d'erreur unifie (code inexistant ET code d'un autre point) pour
        // ne pas offrir d'oracle d'enumeration. Tout code errone compte comme une
        // tentative de brute-force sur ce token.
        Optional<KeyExchangeCode> codeOpt = codeRepository.findByCode(code);
        if (codeOpt.isEmpty() || !codeOpt.get().getPointId().equals(point.getId())) {
            verificationThrottle.recordFailure(verificationToken);
            throw new IllegalArgumentException("Code invalide");
        }
        KeyExchangeCode exchangeCode = codeOpt.get();
        verificationThrottle.reset(verificationToken);

        boolean isExpired = exchangeCode.getValidUntil() != null
                && exchangeCode.getValidUntil().isBefore(LocalDateTime.now());
        boolean isValid = exchangeCode.getStatus() == CodeStatus.ACTIVE && !isExpired;

        // Ne reveler les infos voyageur (guestName = PII) que si le code est
        // reellement valide.
        if (!isValid) {
            return Map.of(
                    "valid", false,
                    "status", exchangeCode.getStatus().name(),
                    "storeName", point.getStoreName()
            );
        }

        return Map.of(
                "valid", true,
                "guestName", exchangeCode.getGuestName() != null ? exchangeCode.getGuestName() : "",
                "codeType", exchangeCode.getCodeType().name(),
                "status", exchangeCode.getStatus().name(),
                "storeName", point.getStoreName(),
                "validUntil", exchangeCode.getValidUntil() != null ? exchangeCode.getValidUntil().toString() : ""
        );
    }

    /**
     * Confirme un mouvement de cle via la page publique.
     *
     * <p>Machine d'etats stricte (Z4B-SECBUGS-04) — chaque action verifie l'etat
     * du code avant d'enregistrer l'evenement, pour empecher de polluer la piste
     * d'audit avec des mouvements sur des codes annules/expires :</p>
     * <ul>
     *   <li>{@code collected} : ACTIVE + non expire → USED + collectedAt ;</li>
     *   <li>{@code returned}  : ACTIVE (retour direct depuis la page publique —
     *       flux principal des codes DROP_OFF, ou cle rendue sans collecte
     *       prealable enregistree) ou USED (collecte au prealable), pas deja
     *       rendu → returnedAt + passage a USED (le code est consomme).
     *       CANCELLED/EXPIRED refuses. Pas de garde sur validUntil : rendre la
     *       cle apres la fin de validite (checkout tardif) est un flux
     *       legitime ;</li>
     *   <li>{@code deposited} : ACTIVE + non expire → evenement seul.</li>
     * </ul>
     */
    @Transactional
    public void confirmKeyMovement(String verificationToken, String code, String action) {
        verificationThrottle.assertNotLocked(verificationToken);

        KeyExchangePoint point = pointRepository.findByVerificationToken(verificationToken)
                .orElseThrow(() -> new IllegalArgumentException("Lien de verification invalide"));

        Optional<KeyExchangeCode> codeOpt = codeRepository.findByCode(code);
        if (codeOpt.isEmpty() || !codeOpt.get().getPointId().equals(point.getId())) {
            verificationThrottle.recordFailure(verificationToken);
            throw new IllegalArgumentException("Code invalide");
        }
        KeyExchangeCode exchangeCode = codeOpt.get();
        verificationThrottle.reset(verificationToken);

        boolean isExpired = exchangeCode.getValidUntil() != null
                && exchangeCode.getValidUntil().isBefore(LocalDateTime.now());

        EventType eventType;
        switch (action) {
            case "collected" -> {
                // Collecter une cle exige un code actif et non expire : un code
                // annule (resa annulee) ou expire ne doit jamais ouvrir l'acces.
                requireActiveNotExpired(exchangeCode, isExpired, "collecte refusee");
                eventType = EventType.KEY_COLLECTED;
                exchangeCode.setCollectedAt(LocalDateTime.now());
                exchangeCode.setStatus(CodeStatus.USED);
            }
            case "returned" -> {
                // Retour accepte sur un code ACTIVE (retour direct depuis la page
                // publique : la page n'affiche le bouton que si le code est valide,
                // donc ACTIVE — flux principal des codes DROP_OFF) ou USED
                // (collecte au prealable). Un code annule ou marque expire est
                // refuse. Pas de garde sur validUntil : rendre la cle apres la fin
                // de validite (checkout tardif) est un flux legitime.
                if (exchangeCode.getStatus() != CodeStatus.ACTIVE
                        && exchangeCode.getStatus() != CodeStatus.USED) {
                    throw new IllegalStateException(
                            "Code annule ou expire (statut: " + exchangeCode.getStatus() + ") : retour refuse");
                }
                if (exchangeCode.getReturnedAt() != null) {
                    throw new IllegalStateException("Cle deja rendue : retour refuse");
                }
                eventType = EventType.KEY_RETURNED;
                exchangeCode.setReturnedAt(LocalDateTime.now());
                // Le retour consomme le code : un code ACTIVE rendu directement
                // passe a USED pour empecher toute reutilisation (collecte/depot).
                exchangeCode.setStatus(CodeStatus.USED);
            }
            case "deposited" -> {
                requireActiveNotExpired(exchangeCode, isExpired, "depot refuse");
                eventType = EventType.KEY_DEPOSITED;
            }
            default -> throw new IllegalArgumentException("Action invalide: " + action);
        }

        codeRepository.save(exchangeCode);

        createEvent(point.getOrganizationId(), exchangeCode.getId(), point.getId(),
                point.getPropertyId(), eventType,
                exchangeCode.getGuestName(), "Action via page publique: " + action,
                EventSource.PUBLIC_PAGE);

        log.info("Mouvement de cle confirme via page publique: {} (code={}, point={})",
                action, code, point.getStoreName());
    }

    // ═══════════════════════════════════════════════════════════════
    // Historique des evenements
    // ═══════════════════════════════════════════════════════════════

    /**
     * Historique pagine des evenements de l'organisation.
     */
    public Page<KeyExchangeEventDto> getEvents(Long propertyId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);

        Page<KeyExchangeEvent> events;
        if (propertyId != null) {
            events = eventRepository.findByPropertyIdOrderByCreatedAtDesc(propertyId, pageable);
        } else {
            events = eventRepository.findAllByOrderByCreatedAtDesc(pageable);
        }

        return events.map(this::toEventDto);
    }

    // ═══════════════════════════════════════════════════════════════
    // Private helpers
    // ═══════════════════════════════════════════════════════════════

    /**
     * Garde commune de la machine d'etats publique : refuse toute action sur un
     * code non ACTIF (annule, deja utilise) ou expire, avec une erreur explicite.
     * Le message conserve le prefixe "Code inactif ou expire" attendu par la page
     * publique.
     */
    private static void requireActiveNotExpired(KeyExchangeCode exchangeCode, boolean isExpired, String refusalLabel) {
        if (exchangeCode.getStatus() != CodeStatus.ACTIVE || isExpired) {
            throw new IllegalStateException("Code inactif ou expire (statut: " + exchangeCode.getStatus()
                    + ") : " + refusalLabel);
        }
    }

    private String generateUniqueCode() {
        // Code 6 chiffres, unique
        for (int attempt = 0; attempt < 10; attempt++) {
            String code = String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
            if (codeRepository.findByCode(code).isEmpty()) {
                return code;
            }
        }
        // Fallback : code 8 chiffres
        return String.format("%08d", SECURE_RANDOM.nextInt(100_000_000));
    }

    private void createEvent(Long orgId, Long codeId, Long pointId, Long propertyId,
                             EventType type, String actorName, String notes, EventSource source) {
        KeyExchangeEvent event = new KeyExchangeEvent();
        event.setOrganizationId(orgId);
        event.setCodeId(codeId);
        event.setPointId(pointId);
        event.setPropertyId(propertyId);
        event.setEventType(type);
        event.setActorName(actorName);
        event.setNotes(notes);
        event.setSource(source);
        eventRepository.save(event);
    }

    private KeyExchangePointDto toPointDto(KeyExchangePoint point) {
        KeyExchangePointDto dto = new KeyExchangePointDto();
        dto.setId(point.getId());
        dto.setPropertyId(point.getPropertyId());
        dto.setProvider(point.getProvider().name());
        dto.setGuardianType(point.getGuardianType() != null ? point.getGuardianType().name() : null);
        dto.setProviderStoreId(point.getProviderStoreId());
        dto.setStoreName(point.getStoreName());
        dto.setStoreAddress(point.getStoreAddress());
        dto.setStorePhone(point.getStorePhone());
        dto.setStoreLat(point.getStoreLat());
        dto.setStoreLng(point.getStoreLng());
        dto.setStoreOpeningHours(point.getStoreOpeningHours());
        dto.setVerificationToken(point.getVerificationToken());
        dto.setStatus(point.getStatus().name());
        dto.setCreatedAt(point.getCreatedAt());
        dto.setActiveCodesCount(codeRepository.countByPointIdAndStatus(point.getId(), CodeStatus.ACTIVE));

        propertyRepository.findById(point.getPropertyId())
                .ifPresent(p -> dto.setPropertyName(p.getName()));

        return dto;
    }

    private KeyExchangeCodeDto toCodeDto(KeyExchangeCode code) {
        KeyExchangeCodeDto dto = new KeyExchangeCodeDto();
        dto.setId(code.getId());
        dto.setPointId(code.getPointId());
        dto.setPropertyId(code.getPropertyId());
        dto.setReservationId(code.getReservationId());
        dto.setGuestName(code.getGuestName());
        dto.setCode(code.getCode());
        dto.setCodeType(code.getCodeType().name());
        dto.setStatus(code.getStatus().name());
        dto.setValidFrom(code.getValidFrom());
        dto.setValidUntil(code.getValidUntil());
        dto.setCollectedAt(code.getCollectedAt());
        dto.setReturnedAt(code.getReturnedAt());
        dto.setProviderCodeId(code.getProviderCodeId());
        dto.setCreatedAt(code.getCreatedAt());

        pointRepository.findById(code.getPointId())
                .ifPresent(p -> dto.setPointName(p.getStoreName()));

        return dto;
    }

    private KeyExchangeEventDto toEventDto(KeyExchangeEvent event) {
        KeyExchangeEventDto dto = new KeyExchangeEventDto();
        dto.setId(event.getId());
        dto.setCodeId(event.getCodeId());
        dto.setPointId(event.getPointId());
        dto.setPropertyId(event.getPropertyId());
        dto.setEventType(event.getEventType().name());
        dto.setActorName(event.getActorName());
        dto.setNotes(event.getNotes());
        dto.setSource(event.getSource().name());
        dto.setCreatedAt(event.getCreatedAt());

        if (event.getPointId() != null) {
            pointRepository.findById(event.getPointId())
                    .ifPresent(p -> dto.setPointName(p.getStoreName()));
        }
        propertyRepository.findById(event.getPropertyId())
                .ifPresent(p -> dto.setPropertyName(p.getName()));

        return dto;
    }
}
