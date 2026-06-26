package com.clenzy.service;

import com.clenzy.config.GuideConfig;
import com.clenzy.dto.WelcomeGuidePublicDto;
import com.clenzy.dto.WelcomeGuideRequest;
import com.clenzy.exception.WelcomeGuideAlreadyExistsException;
import com.clenzy.integration.activities.AffiliateLinkDecorator;
import com.clenzy.service.access.AccessCodeResolverService;
import com.clenzy.service.access.StayTimes;
import com.clenzy.service.PhotoStorageService;
import com.clenzy.model.*;
import com.clenzy.repository.ActivityAffiliateConfigRepository;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.WelcomeGuideEntryRepository;
import com.clenzy.repository.WelcomeGuideEventRepository;
import com.clenzy.repository.WelcomeGuideRepository;
import com.clenzy.repository.WelcomeGuideTokenRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.hibernate.Hibernate;
import org.springframework.data.domain.Sort;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Service
public class WelcomeGuideService {

    private static final Logger log = LoggerFactory.getLogger(WelcomeGuideService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final WelcomeGuideRepository guideRepository;
    private final WelcomeGuideTokenRepository tokenRepository;
    private final WelcomeGuideEntryRepository entryRepository;
    private final WelcomeGuideEventRepository eventRepository;
    private final PropertyRepository propertyRepository;
    private final ReservationRepository reservationRepository;
    private final CheckInInstructionsRepository checkInInstructionsRepository;
    private final GuideConfig guideConfig;
    private final AccessCodeResolverService accessCodeResolverService;
    private final OnlineCheckInService onlineCheckInService;
    private final PhotoStorageService photoStorageService;
    private final PropertyPhotoRepository propertyPhotoRepository;
    private final ActivityAffiliateConfigRepository activityAffiliateConfigRepository;
    private final com.clenzy.service.access.GuestUnlockService guestUnlockService;
    private final MessageTemplateService messageTemplateService;
    private final GuestDeclarationService guestDeclarationService;
    private final Map<ActivityProvider, AffiliateLinkDecorator> linkDecorators;

    public WelcomeGuideService(WelcomeGuideRepository guideRepository,
                                WelcomeGuideTokenRepository tokenRepository,
                                WelcomeGuideEntryRepository entryRepository,
                                WelcomeGuideEventRepository eventRepository,
                                PropertyRepository propertyRepository,
                                ReservationRepository reservationRepository,
                                CheckInInstructionsRepository checkInInstructionsRepository,
                                GuideConfig guideConfig,
                                AccessCodeResolverService accessCodeResolverService,
                                OnlineCheckInService onlineCheckInService,
                                PhotoStorageService photoStorageService,
                                PropertyPhotoRepository propertyPhotoRepository,
                                ActivityAffiliateConfigRepository activityAffiliateConfigRepository,
                                com.clenzy.service.access.GuestUnlockService guestUnlockService,
                                MessageTemplateService messageTemplateService,
                                GuestDeclarationService guestDeclarationService,
                                List<AffiliateLinkDecorator> linkDecorators) {
        this.guideRepository = guideRepository;
        this.tokenRepository = tokenRepository;
        this.entryRepository = entryRepository;
        this.eventRepository = eventRepository;
        this.propertyRepository = propertyRepository;
        this.reservationRepository = reservationRepository;
        this.checkInInstructionsRepository = checkInInstructionsRepository;
        this.guideConfig = guideConfig;
        this.accessCodeResolverService = accessCodeResolverService;
        this.onlineCheckInService = onlineCheckInService;
        this.photoStorageService = photoStorageService;
        this.propertyPhotoRepository = propertyPhotoRepository;
        this.activityAffiliateConfigRepository = activityAffiliateConfigRepository;
        this.guestUnlockService = guestUnlockService;
        this.messageTemplateService = messageTemplateService;
        this.guestDeclarationService = guestDeclarationService;
        this.linkDecorators = new EnumMap<>(ActivityProvider.class);
        for (AffiliateLinkDecorator decorator : linkDecorators) {
            this.linkDecorators.put(decorator.provider(), decorator);
        }
    }

    @Transactional
    public WelcomeGuide createGuide(Long orgId, WelcomeGuideRequest req, boolean overwrite) {
        Property property = propertyRepository.findById(req.propertyId())
            .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable: " + req.propertyId()));

        // L'organisation du livret = celle de son logement. Plus correct (un livret
        // appartient a l'org du bien) et fonctionne pour le staff plateforme dont le
        // contexte org est null. Repli sur le contexte org si le logement n'en a pas.
        Long resolvedOrgId = property.getOrganizationId() != null ? property.getOrganizationId() : orgId;
        if (resolvedOrgId == null) {
            throw new IllegalStateException(
                "Impossible de determiner l'organisation du livret : le logement #"
                + property.getId() + " n'a pas d'organisation.");
        }

        // Le livret est rattaché à une réservation : séjour actif OU prochaine à venir.
        // Sans réservation pertinente → livret non créable (règle métier).
        Reservation reservation = reservationRepository
            .findCurrentOrNextByPropertyId(property.getId(), LocalDate.now(), resolvedOrgId)
            .stream().findFirst()
            .orElseThrow(() -> new IllegalStateException(
                "Aucune réservation en cours ou à venir pour ce logement : livret non créable."));

        // Un seul livret par réservation : sinon, confirmation d'écrasement requise (409).
        WelcomeGuide existing = guideRepository.findByReservationId(reservation.getId()).orElse(null);
        if (existing != null) {
            if (!overwrite) {
                throw new WelcomeGuideAlreadyExistsException(existing.getId(), reservation.getId());
            }
            deleteGuide(existing.getId(), resolvedOrgId); // révoque tokens/enfants + supprime l'ancien
        }

        WelcomeGuide guide = new WelcomeGuide();
        guide.setOrganizationId(resolvedOrgId);
        guide.setProperty(property);
        guide.setReservation(reservation);
        guide.setTitle(req.title());
        guide.setLanguage(req.language() != null ? req.language() : "fr");
        guide.setSections(req.sections() != null ? req.sections() : "[]");
        if (req.pois() != null) guide.setPois(req.pois());
        if (req.curatedActivities() != null) guide.setCuratedActivities(req.curatedActivities());
        if (req.brandingColor() != null) guide.setBrandingColor(req.brandingColor());
        if (req.theme() != null && !req.theme().isBlank()) guide.setTheme(req.theme());
        if (req.heroPhotoIds() != null) guide.setHeroPhotoIds(req.heroPhotoIds()); // '[]' = pas de hero
        if (req.welcomeMessage() != null) guide.setWelcomeMessage(req.welcomeMessage().isBlank() ? null : req.welcomeMessage());
        if (req.hostNames() != null) guide.setHostNames(req.hostNames().isBlank() ? null : req.hostNames());
        if (req.logoUrl() != null) guide.setLogoUrl(req.logoUrl());
        if (req.chatbotEnabled() != null) guide.setChatbotEnabled(req.chatbotEnabled());
        if (req.guestbookEnabled() != null) guide.setGuestbookEnabled(req.guestbookEnabled());
        if (req.activitiesEnabled() != null) guide.setActivitiesEnabled(req.activitiesEnabled());
        if (req.upsellsEnabled() != null) guide.setUpsellsEnabled(req.upsellsEnabled());
        guide.setUpsellOfferIds(req.upsellOfferIds()); // null = afficher tous les services applicables

        WelcomeGuide saved = guideRepository.save(guide);
        Hibernate.initialize(saved.getProperty()); // mapping DTO hors session (open-in-view=false)
        Hibernate.initialize(saved.getReservation());
        return saved;
    }

    /** Met a jour un livret. Le logement et la langue ne sont pas modifiables apres creation (ignores). */
    @Transactional
    public WelcomeGuide updateGuide(Long guideId, Long orgId, WelcomeGuideRequest req) {
        WelcomeGuide guide = loadGuide(guideId, orgId);
        boolean wasPublished = guide.isPublished();

        if (req.title() != null) guide.setTitle(req.title());
        if (req.sections() != null) guide.setSections(req.sections());
        if (req.pois() != null) guide.setPois(req.pois());
        if (req.curatedActivities() != null) guide.setCuratedActivities(req.curatedActivities());
        if (req.brandingColor() != null) guide.setBrandingColor(req.brandingColor());
        if (req.theme() != null && !req.theme().isBlank()) guide.setTheme(req.theme());
        if (req.heroPhotoIds() != null) guide.setHeroPhotoIds(req.heroPhotoIds()); // '[]' = pas de hero
        if (req.welcomeMessage() != null) guide.setWelcomeMessage(req.welcomeMessage().isBlank() ? null : req.welcomeMessage());
        if (req.hostNames() != null) guide.setHostNames(req.hostNames().isBlank() ? null : req.hostNames());
        if (req.logoUrl() != null) guide.setLogoUrl(req.logoUrl());
        if (req.published() != null) guide.setPublished(req.published());
        if (req.chatbotEnabled() != null) guide.setChatbotEnabled(req.chatbotEnabled());
        if (req.guestbookEnabled() != null) guide.setGuestbookEnabled(req.guestbookEnabled());
        if (req.activitiesEnabled() != null) guide.setActivitiesEnabled(req.activitiesEnabled());
        if (req.upsellsEnabled() != null) guide.setUpsellsEnabled(req.upsellsEnabled());
        guide.setUpsellOfferIds(req.upsellOfferIds()); // null = afficher tous les services applicables

        WelcomeGuide saved = guideRepository.save(guide);

        // Generalisation de la migration 0230 : a la PREMIERE publication d'un livret, on garantit
        // que le template CHECK_IN actif de l'org reference {guideLink} (sinon l'email de bienvenue
        // n'inclurait jamais le lien du livret). Idempotent et org-scope cote MessageTemplateService.
        // Borne a la transition non-publie -> publie pour ne pas re-traiter a chaque sauvegarde.
        if (!wasPublished && saved.isPublished()) {
            messageTemplateService.ensureGuideLinkTag(saved.getOrganizationId());
        }

        Hibernate.initialize(saved.getProperty()); // mapping DTO hors session (open-in-view=false)
        Hibernate.initialize(saved.getReservation()); // idem : le DTO serialise la reservation rattachee (ReservationRef)
        return saved;
    }

    @Transactional(readOnly = true)
    public Optional<WelcomeGuide> getById(Long id, Long orgId) {
        // Staff plateforme (org de contexte null) : accès cross-org par id.
        Optional<WelcomeGuide> guide = orgId != null
            ? guideRepository.findByIdAndOrganizationId(id, orgId)
            : guideRepository.findById(id);
        // Initialise property dans la session : le DTO l'utilise et open-in-view=false
        // (sinon LazyInitializationException lors du mapping dans le controller).
        guide.ifPresent(g -> {
            Hibernate.initialize(g.getProperty());
            Hibernate.initialize(g.getReservation());
        });
        return guide;
    }

    @Transactional(readOnly = true)
    public List<WelcomeGuide> getAll(Long orgId) {
        // Staff plateforme (org de contexte null) : vue cross-org de tous les livrets.
        List<WelcomeGuide> guides = orgId != null
            ? guideRepository.findByOrganizationIdOrderByCreatedAtDesc(orgId)
            : guideRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"));
        // Initialise property dans la session (open-in-view=false) pour le mapping DTO.
        guides.forEach(g -> {
            Hibernate.initialize(g.getProperty());
            Hibernate.initialize(g.getReservation());
        });
        return guides;
    }

    /**
     * Donnees auto-remplies d'un logement pour l'apercu cote hote (editeur de livret) :
     * memes sources que le payload guest (Property + CheckInInstructions), sans token.
     * HOST : strictement son org ; staff plateforme (orgId null) : cross-org. Vide si
     * logement introuvable ou hors org.
     */
    @Transactional(readOnly = true)
    public Optional<WelcomeGuidePublicDto.PreviewData> getPropertyPreviewData(Long propertyId, Long orgId) {
        return propertyRepository.findById(propertyId)
            .filter(p -> orgId == null || orgId.equals(p.getOrganizationId()))
            .map(p -> {
                CheckInInstructions ci = checkInInstructionsRepository.findByPropertyId(p.getId()).orElse(null);
                Long resolvedOrgId = p.getOrganizationId() != null ? p.getOrganizationId() : orgId;
                Reservation current = resolvedOrgId == null ? null
                    : reservationRepository.findCurrentOrNextByPropertyId(p.getId(), LocalDate.now(), resolvedOrgId)
                        .stream().findFirst().orElse(null);
                return WelcomeGuidePublicDto.previewFrom(p, ci, current);
            });
    }

    /**
     * Charge un livret en respectant le scope organisation. Pour le staff plateforme
     * (orgId null), accès cross-org par id. Lève si introuvable.
     */
    private WelcomeGuide loadGuide(Long guideId, Long orgId) {
        return (orgId != null
                ? guideRepository.findByIdAndOrganizationId(guideId, orgId)
                : guideRepository.findById(guideId))
            .orElseThrow(() -> new IllegalArgumentException("Guide introuvable: " + guideId));
    }

    public List<WelcomeGuide> getByProperty(Long propertyId, Long orgId) {
        return guideRepository.findByPropertyIdAndOrganizationId(propertyId, orgId);
    }

    @Transactional
    public WelcomeGuideToken generateToken(Long guideId, Long orgId, Reservation reservation) {
        WelcomeGuide guide = loadGuide(guideId, orgId);
        // Sans réservation explicite (bouton de partage hôte : lien / QR / share), on cible la
        // réservation COURANTE ou prochaine du logement, et NON la réservation figée à la création
        // du livret. Sinon, dès que ce séjour initial est terminé, tout lien partagé reste rattaché
        // à une réservation révolue : sa fenêtre de validité (checkOut + graceDays) est déjà passée,
        // le token est « mort-né » et la page guest répond 404 « Lien indisponible ».
        Reservation boundReservation = reservation != null ? reservation : resolveCurrentReservation(guide);

        WelcomeGuideToken token = new WelcomeGuideToken();
        // L'org du token = celle du livret (non-null), pas le contexte (null pour le staff plateforme).
        token.setOrganizationId(guide.getOrganizationId());
        token.setGuide(guide);
        token.setReservation(boundReservation);
        token.setToken(UUID.randomUUID());
        applyValidityWindow(token, boundReservation);

        return tokenRepository.save(token);
    }

    /**
     * Réservation à laquelle borner un token généré sans réservation explicite : la réservation
     * courante ou prochaine du logement (checkOut &gt;= aujourd'hui, non annulée), résolue dans le
     * fuseau du logement (le passage d'un jour à l'autre suit l'heure locale, pas celle du serveur).
     * Repli sur la réservation rattachée au livret si aucune réservation à venir (ex. inter-séjours).
     */
    private Reservation resolveCurrentReservation(WelcomeGuide guide) {
        if (guide.getProperty() == null || guide.getOrganizationId() == null) {
            return guide.getReservation();
        }
        LocalDate today = LocalDate.now(StayTimes.zoneOf(guide.getProperty()));
        return reservationRepository
            .findCurrentOrNextByPropertyId(guide.getProperty().getId(), today, guide.getOrganizationId())
            .stream().findFirst()
            .orElse(guide.getReservation());
    }

    /**
     * Borne la validite du token sur la fenetre de la reservation : accessible
     * {@code leadDays} avant l'arrivee, jusqu'a {@code graceDays} apres le depart.
     * Sans reservation (apercu hote), fenetre par defaut {@code manualTtlDays}.
     */
    private void applyValidityWindow(WelcomeGuideToken token, Reservation reservation) {
        if (reservation != null && reservation.getCheckIn() != null && reservation.getCheckOut() != null) {
            token.setValidFrom(reservation.getCheckIn().atStartOfDay().minusDays(guideConfig.getLeadDays()));
            token.setExpiresAt(reservation.getCheckOut().atTime(LocalTime.MAX).plusDays(guideConfig.getGraceDays()));
        } else {
            LocalDateTime now = LocalDateTime.now();
            token.setValidFrom(now);
            token.setExpiresAt(now.plusDays(guideConfig.getManualTtlDays()));
        }
    }

    /**
     * Resout le lien du livret pour une reservation : trouve le livret publie du
     * logement (preference langue du guest, sinon premier publie), reutilise un
     * token valide existant ou en cree un borne a la reservation. Vide si aucun
     * livret publie. Utilise par la diffusion automatique (action SEND_GUIDE) et
     * la resolution du tag {@code guideLink}.
     */
    @Transactional
    public Optional<String> linkForReservation(Reservation reservation) {
        if (reservation == null || reservation.getProperty() == null || reservation.getOrganizationId() == null) {
            return Optional.empty();
        }
        WelcomeGuide guide = guideRepository.findByReservationId(reservation.getId())
            .filter(WelcomeGuide::isPublished)
            .orElseGet(() -> resolvePublishedGuide(
                reservation.getProperty().getId(), reservation.getOrganizationId(), guestLanguage(reservation)));
        if (guide == null) {
            return Optional.empty();
        }
        WelcomeGuideToken token = reuseOrCreateToken(guide, reservation, reservation.getOrganizationId());
        return Optional.of(generateGuideLink(token));
    }

    /**
     * Lien de demande d'avis : token valide jusqu'a {@code check-out + reviewWindowDays}
     * (le sejour est termine quand on sollicite l'avis). Cree un token dedie car le token
     * de sejour a deja expire a ce moment. Vide si aucun livret publie.
     */
    @Transactional
    public Optional<String> reviewLinkForReservation(Reservation reservation) {
        if (reservation == null || reservation.getProperty() == null || reservation.getOrganizationId() == null) {
            return Optional.empty();
        }
        WelcomeGuide guide = guideRepository.findByReservationId(reservation.getId())
            .filter(WelcomeGuide::isPublished)
            .orElseGet(() -> resolvePublishedGuide(
                reservation.getProperty().getId(), reservation.getOrganizationId(), guestLanguage(reservation)));
        if (guide == null) {
            return Optional.empty();
        }
        WelcomeGuideToken token = new WelcomeGuideToken();
        token.setOrganizationId(reservation.getOrganizationId());
        token.setGuide(guide);
        token.setReservation(reservation);
        token.setToken(UUID.randomUUID());
        LocalDateTime now = LocalDateTime.now();
        token.setValidFrom(now);
        LocalDateTime base = reservation.getCheckOut() != null
            ? reservation.getCheckOut().atTime(LocalTime.MAX) : now;
        token.setExpiresAt(base.plusDays(guideConfig.getReviewWindowDays()));
        return Optional.of(generateGuideLink(tokenRepository.save(token)));
    }

    /**
     * Vrai si un livret PUBLIÉ existe pour cette réservation (lié à la résa ou au logement).
     * Lecture seule — ne crée aucun token. Sert de condition au gating du code d'accès dans
     * les emails : on ne masque le code que si le voyageur a un canal (le livret) pour le
     * récupérer à l'heure du check-in.
     */
    @Transactional(readOnly = true)
    public boolean hasPublishedGuideFor(Reservation reservation) {
        if (reservation == null || reservation.getProperty() == null || reservation.getOrganizationId() == null) {
            return false;
        }
        if (guideRepository.findByReservationId(reservation.getId())
                .filter(WelcomeGuide::isPublished).isPresent()) {
            return true;
        }
        return resolvePublishedGuide(
                reservation.getProperty().getId(), reservation.getOrganizationId(), guestLanguage(reservation)) != null;
    }

    private String guestLanguage(Reservation reservation) {
        return reservation.getGuest() != null && reservation.getGuest().getLanguage() != null
            ? reservation.getGuest().getLanguage() : "fr";
    }

    private WelcomeGuide resolvePublishedGuide(Long propertyId, Long orgId, String language) {
        WelcomeGuide byLang = guideRepository.findByPropertyIdAndLanguage(propertyId, language)
            .filter(g -> g.isPublished() && orgId.equals(g.getOrganizationId()))
            .orElse(null);
        if (byLang != null) {
            return byLang;
        }
        return guideRepository.findByPropertyIdAndOrganizationId(propertyId, orgId).stream()
            .filter(WelcomeGuide::isPublished)
            .findFirst()
            .orElse(null);
    }

    private WelcomeGuideToken reuseOrCreateToken(WelcomeGuide guide, Reservation reservation, Long orgId) {
        LocalDateTime now = LocalDateTime.now();
        Optional<WelcomeGuideToken> reusable = tokenRepository.findByReservationId(reservation.getId()).stream()
            .filter(t -> !t.isRevoked())
            .filter(t -> t.getGuide() != null && guide.getId().equals(t.getGuide().getId()))
            .filter(t -> t.getExpiresAt() == null || t.getExpiresAt().isAfter(now))
            .findFirst();
        if (reusable.isPresent()) {
            return reusable.get();
        }
        WelcomeGuideToken token = new WelcomeGuideToken();
        token.setOrganizationId(orgId);
        token.setGuide(guide);
        token.setReservation(reservation);
        token.setToken(UUID.randomUUID());
        applyValidityWindow(token, reservation);
        return tokenRepository.save(token);
    }

    /**
     * Resout le livret public a partir d'un token : verifie la fenetre de validite
     * + revocation + reservation non annulee, refuse les livrets non publies, puis
     * assemble le payload auto-rempli (Property + CheckInInstructions + Reservation).
     */
    @Transactional(readOnly = true)
    public Optional<WelcomeGuidePublicDto> getPublicGuidePayload(UUID token) {
        return tokenRepository.findByToken(token)
            .filter(WelcomeGuideToken::isCurrentlyValid)
            .flatMap(this::buildPublicPayload);
    }

    /**
     * Résout, à partir d'un token de livret valide (non révoqué, dans sa fenêtre, livret publié),
     * l'id de la réservation effective bornée par ce token (réservation du token, sinon celle du
     * livret). Le token EST la clé d'autorisation : aucun id de réservation n'est accepté du client.
     * Vide si token invalide / livret non publié / réservation absente.
     */
    @Transactional(readOnly = true)
    public Optional<Long> resolveReservationId(UUID token) {
        return tokenRepository.findByToken(token)
            .filter(WelcomeGuideToken::isCurrentlyValid)
            .map(t -> {
                WelcomeGuide guide = t.getGuide();
                if (guide == null || !guide.isPublished()) {
                    return null;
                }
                Reservation reservation = t.getReservation() != null ? t.getReservation() : guide.getReservation();
                return reservation != null ? reservation.getId() : null;
            })
            .filter(Objects::nonNull);
    }

    /**
     * Sert une photo d'indication d'acces pour un token guest valide. Verifie que la cle
     * appartient bien aux {@code arrivalPhotos} des instructions du logement du livret
     * (token-scope), puis recupere le binaire via {@link PhotoStorageService}. Vide si token
     * invalide / livret non publie / cle inconnue / avant l'heure de check-in.
     */
    @Transactional(readOnly = true)
    public Optional<byte[]> getAccessPhotoBytes(UUID token, String key) {
        if (key == null || key.isBlank()) {
            return Optional.empty();
        }
        return tokenRepository.findByToken(token)
            .filter(WelcomeGuideToken::isCurrentlyValid)
            .map(WelcomeGuideToken::getGuide)
            .filter(g -> g != null && g.isPublished() && g.getProperty() != null)
            // Meme regle anti entree anticipee que le code d'acces du payload : la fenetre
            // du token s'ouvre leadDays AVANT l'arrivee, mais les photos d'indication
            // d'acces (boite a cle, digicode photographie...) ne sont servies qu'a partir
            // de l'heure de check-in.
            .filter(g -> StayTimes.isAfterCheckIn(g.getReservation(), g.getProperty()))
            .flatMap(g -> checkInInstructionsRepository.findByPropertyId(g.getProperty().getId()))
            .filter(ci -> ci.getArrivalPhotos() != null
                && ci.getArrivalPhotos().contains("\"" + key + "\""))
            .map(ci -> photoStorageService.retrieve(key));
    }

    /** Contexte du chatbot guest : org (résolution IA), langue, et contenu du livret sérialisé. */
    @Transactional(readOnly = true)
    public Optional<GuestChatContext> getChatContext(UUID token) {
        return tokenRepository.findByToken(token)
            .filter(WelcomeGuideToken::isCurrentlyValid)
            .flatMap(t -> {
                WelcomeGuide guide = t.getGuide();
                if (guide == null || !guide.isPublished() || !guide.isChatbotEnabled()) {
                    return Optional.empty();
                }
                return buildPublicPayload(t).map(dto ->
                    new GuestChatContext(guide.getOrganizationId(), guide.getLanguage(), serializeForChat(dto)));
            });
    }

    /** Données nécessaires au chatbot guest pour répondre de façon grounded. */
    public record GuestChatContext(Long orgId, String language, String content) {}

    private String serializeForChat(WelcomeGuidePublicDto d) {
        StringBuilder sb = new StringBuilder();
        appendLine(sb, "Titre", d.title());
        WelcomeGuidePublicDto.PropertyInfo p = d.property();
        if (p != null) {
            appendLine(sb, "Logement", joinNonBlank(p.name(), p.address(), p.postalCode(), p.city(), p.country()));
        }
        WelcomeGuidePublicDto.StayInfo s = d.stay();
        if (s != null) {
            appendLine(sb, "Arrivée", joinNonBlank(asStr(s.checkIn()), s.checkInTime()));
            appendLine(sb, "Départ", joinNonBlank(asStr(s.checkOut()), s.checkOutTime()));
        }
        WelcomeGuidePublicDto.PracticalInfo pr = d.practical();
        if (pr != null) {
            appendLine(sb, "Wi-Fi (réseau)", pr.wifiName());
            appendLine(sb, "Wi-Fi (mot de passe)", pr.wifiPassword());
            appendLine(sb, "Code d'accès", pr.accessCode());
            appendLine(sb, "Instructions d'arrivée", pr.arrivalInstructions());
            appendLine(sb, "Instructions de départ", pr.departureInstructions());
            appendLine(sb, "Parking", pr.parkingInfo());
            appendLine(sb, "Règlement intérieur", pr.houseRules());
            appendLine(sb, "Numéro utile", pr.emergencyContact());
            appendLine(sb, "Informations complémentaires", pr.additionalNotes());
        }
        appendLine(sb, "Sections (JSON)", d.sections());
        return sb.toString();
    }

    private static void appendLine(StringBuilder sb, String label, String value) {
        if (value != null && !value.isBlank()) {
            sb.append(label).append(" : ").append(value.trim()).append('\n');
        }
    }

    private static String asStr(Object o) {
        return o == null ? "" : o.toString();
    }

    private static String joinNonBlank(String... parts) {
        StringBuilder b = new StringBuilder();
        for (String part : parts) {
            if (part != null && !part.isBlank()) {
                if (b.length() > 0) {
                    b.append(' ');
                }
                b.append(part.trim());
            }
        }
        return b.toString();
    }

    private Optional<WelcomeGuidePublicDto> buildPublicPayload(WelcomeGuideToken t) {
        WelcomeGuide guide = t.getGuide();
        if (guide == null || !guide.isPublished()) {
            return Optional.empty();
        }
        // Disponibilité : on se base sur la réservation portée par CE token (un lien partagé ou un
        // email cible une réservation précise), avec repli sur la réservation rattachée au livret.
        // Sinon un token valide pour le séjour courant afficherait « réservation révolue » à cause de
        // l'ancienne réservation figée à la création du livret. Orphelin (aucune résa) ou réservation
        // révolue (départ passé) → écran « non disponible » côté voyageur (pas de 404 brut).
        Reservation reservation = t.getReservation() != null ? t.getReservation() : guide.getReservation();
        if (reservation == null) {
            return Optional.of(WelcomeGuidePublicDto.unavailable(guide, "NO_RESERVATION"));
        }
        if (reservation.getCheckOut() != null && reservation.getCheckOut().isBefore(LocalDate.now())) {
            return Optional.of(WelcomeGuidePublicDto.unavailable(guide, "EXPIRED"));
        }
        Property property = guide.getProperty();
        CheckInInstructions ci = (property != null)
            ? checkInInstructionsRepository.findByPropertyId(property.getId()).orElse(null)
            : null;
        // Digicode dynamique (serrure connectee) deja persiste pour ce sejour — sinon code statique.
        String dynamicAccessCode = reservation != null
            ? accessCodeResolverService.existingAccessCode(reservation.getId()).orElse(null)
            : null;
        // Check-in en ligne lie au sejour (lecture seule — affiche s'il existe).
        WelcomeGuidePublicDto.CheckInInfo checkIn = reservation != null
            ? onlineCheckInService.getByReservation(reservation.getId(), guide.getOrganizationId())
                .map(c -> new WelcomeGuidePublicDto.CheckInInfo(
                    onlineCheckInService.generateCheckInLink(c), c.getStatus().name()))
                .orElse(null)
            : null;
        List<String> heroImageUrls = resolveHeroImageUrls(guide, t.getToken());
        // Le code d'acces n'est revele qu'a partir de l'heure de check-in (anti entree anticipee).
        boolean accessCodeUnlocked = isAccessCodeUnlocked(reservation, property);
        // Bouton « Ouvrir la porte » : opt-in logement + serrure pilotable + fenetre STRICTE du
        // sejour (apres le check-out, le bouton disparait — et l'action serait refusee de toute facon).
        boolean guestUnlockAvailable = ci != null && ci.isGuestUnlockEnabled()
            && reservation != null
            && StayTimes.isDuringStay(reservation, property)
            && property != null && guestUnlockService.hasRemoteUnlockableLock(property.getId());
        WelcomeGuidePublicDto dto =
            WelcomeGuidePublicDto.from(guide, property, ci, reservation, dynamicAccessCode, checkIn,
                heroImageUrls, accessCodeUnlocked, guestUnlockAvailable);
        // Collecte réglementaire (fiche de police) : gating uniquement si le service est activé pour
        // la propriété ET que des données manquent. Résolu serveur depuis la réservation du token.
        dto = dto.withDataCollection(guestDeclarationService.computeRequirements(reservation.getId()));
        if (!accessCodeUnlocked) {
            dto = maskArrivalAccessDetails(dto);
        }
        // Injecte les ID d'affiliation (Klook, GetYourGuide, ...) dans les liens des activites curatees.
        String decorated = decorateAffiliateLinks(dto.curatedActivities(), guide.getOrganizationId());
        return Optional.of(decorated.equals(dto.curatedActivities()) ? dto : dto.withCuratedActivities(decorated));
    }

    /**
     * Avant l'heure de check-in, les instructions d'arrivee et les photos d'indication
     * d'acces sont masquees comme le code d'acces : l'hote y place souvent l'emplacement
     * de la boite a cle ou le digicode en texte libre, ce qui contournerait la regle
     * anti entree anticipee si elles restaient servies pendant la fenetre lead du token.
     * S'applique a tous les chemins derives du payload (livret public, chatbot guest).
     */
    private WelcomeGuidePublicDto maskArrivalAccessDetails(WelcomeGuidePublicDto dto) {
        WelcomeGuidePublicDto.PracticalInfo practical = dto.practical();
        if (practical == null) {
            return dto;
        }
        WelcomeGuidePublicDto.PracticalInfo masked = new WelcomeGuidePublicDto.PracticalInfo(
            practical.wifiName(),
            practical.wifiPassword(),
            practical.accessCode(),
            practical.parkingInfo(),
            null,                                  // arrivalInstructions : revelees au check-in
            practical.departureInstructions(),
            practical.houseRules(),
            practical.emergencyContact(),
            practical.additionalNotes(),
            "[]",                                  // arrivalPhotos : revelees au check-in
            practical.extraCodes(),
            practical.accessCodeLocked(),
            practical.guestUnlockAvailable());
        return new WelcomeGuidePublicDto(
            dto.title(), dto.language(), dto.brandingColor(), dto.theme(), dto.heroImageUrls(),
            dto.welcomeMessage(), dto.hostNames(), dto.logoUrl(), dto.sections(), dto.pois(),
            dto.curatedActivities(), dto.property(), masked, dto.stay(), dto.checkIn(),
            dto.dataCollection(), dto.chatbotEnabled(), dto.guestbookEnabled(), dto.activitiesEnabled(),
            dto.upsellsEnabled(), dto.available(), dto.unavailableReason());
    }

    /**
     * Le code d'acces ne doit etre revele qu'a partir de l'heure de check-in (date d'arrivee
     * + heure d'arrivee, dans le fuseau horaire du logement) pour eviter qu'un voyageur entre
     * avant l'heure. Avant ce moment, le payload masque le code (le front affiche un cadenas).
     * Sans date de reservation, aucune restriction (rien sur quoi se baser).
     */
    private boolean isAccessCodeUnlocked(Reservation reservation, Property property) {
        return StayTimes.isAfterCheckIn(reservation, property);
    }

    /**
     * Reecrit les {@code bookingUrl} des activites curatees pour y ajouter l'ID d'affiliation de
     * l'org pour chaque provider connecte+actif (ex. {@code aid} Klook, {@code partner_id}
     * GetYourGuide), afin que l'hote touche sa commission. Chaque {@link AffiliateLinkDecorator} ne
     * modifie que les URL de son domaine → les decorateurs s'appliquent en chaine sans interferer.
     * No-op si aucun provider connecte/avec ID affilie ; defensif si JSON illisible (sert l'original).
     */
    private String decorateAffiliateLinks(String curatedActivitiesJson, Long orgId) {
        if (curatedActivitiesJson == null || curatedActivitiesJson.isBlank() || orgId == null) {
            return curatedActivitiesJson;
        }
        List<Map.Entry<AffiliateLinkDecorator, String>> active = new ArrayList<>();
        for (ActivityAffiliateConfig config : activityAffiliateConfigRepository.findByOrganizationIdAndEnabledTrue(orgId)) {
            AffiliateLinkDecorator decorator = linkDecorators.get(config.getProvider());
            String affiliateId = config.getAffiliateId();
            if (decorator != null && affiliateId != null && !affiliateId.isBlank()) {
                active.add(Map.entry(decorator, affiliateId));
            }
        }
        if (active.isEmpty()) {
            return curatedActivitiesJson; // aucun provider d'affiliation connecte
        }
        try {
            List<Map<String, Object>> activities =
                MAPPER.readValue(curatedActivitiesJson, new TypeReference<List<Map<String, Object>>>() {});
            boolean changed = false;
            for (Map<String, Object> activity : activities) {
                if (activity.get("bookingUrl") instanceof String url) {
                    String wrapped = url;
                    for (Map.Entry<AffiliateLinkDecorator, String> entry : active) {
                        wrapped = entry.getKey().wrap(wrapped, entry.getValue());
                    }
                    if (!wrapped.equals(url)) {
                        activity.put("bookingUrl", wrapped);
                        changed = true;
                    }
                }
            }
            return changed ? MAPPER.writeValueAsString(activities) : curatedActivitiesJson;
        } catch (Exception e) {
            log.warn("Affiliate link decoration failed (org={}): {}", orgId, e.getMessage());
            return curatedActivitiesJson;
        }
    }

    /**
     * Resout les URLs des photos de couverture (hero) pour le carrousel guest. Pour chaque
     * id de {@code hero_photo_ids} : {@code externalUrl} direct (photo importee Channex/Airbnb)
     * sinon chemin passthrough token-scope {@code /hero-photo?photoId=ID} (binaire local servi
     * par {@link #getHeroPhotoBytes}). Liste vide si aucune photo (le front affiche un degrade).
     */
    private List<String> resolveHeroImageUrls(WelcomeGuide guide, UUID token) {
        if (guide.getProperty() == null) {
            return List.of();
        }
        Long propertyId = guide.getProperty().getId();
        return parsePhotoIds(guide.getHeroPhotoIds()).stream()
            .map(id -> propertyPhotoRepository.findByIdAndPropertyId(id, propertyId)
                .map(photo -> (photo.getExternalUrl() != null && !photo.getExternalUrl().isBlank())
                    ? photo.getExternalUrl()
                    : "/api/public/guide/" + token + "/hero-photo?photoId=" + id)
                .orElse(null))
            .filter(java.util.Objects::nonNull)
            .toList();
    }

    /**
     * Sert le binaire d'une photo de couverture (hero) pour un token guest valide.
     * Token-scope : la photo doit etre listee dans {@code hero_photo_ids} du livret ET
     * appartenir a son logement. Vide si token invalide / non publie / id non autorise /
     * photo externe (servie via son URL).
     */
    @Transactional(readOnly = true)
    public Optional<byte[]> getHeroPhotoBytes(UUID token, Long photoId) {
        if (photoId == null) {
            return Optional.empty();
        }
        return tokenRepository.findByToken(token)
            .filter(WelcomeGuideToken::isCurrentlyValid)
            .map(WelcomeGuideToken::getGuide)
            .filter(g -> g != null && g.isPublished() && g.getProperty() != null
                && parsePhotoIds(g.getHeroPhotoIds()).contains(photoId))
            .flatMap(g -> propertyPhotoRepository.findByIdAndPropertyId(photoId, g.getProperty().getId()))
            .map(photo -> photo.getStorageKey() != null
                ? photoStorageService.retrieve(photo.getStorageKey())
                : photo.getData());
    }

    /** Parse un JSON array d'ids ('[1,2,3]') en liste de Long (extrait les entiers, robuste). */
    private static List<Long> parsePhotoIds(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        List<Long> ids = new java.util.ArrayList<>();
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\d+").matcher(json);
        while (m.find()) {
            ids.add(Long.parseLong(m.group()));
        }
        return ids;
    }

    /** Revoque tous les tokens lies a une reservation (ex: annulation). */
    @Transactional
    public int revokeTokensForReservation(Long reservationId) {
        List<WelcomeGuideToken> tokens = tokenRepository.findByReservationId(reservationId);
        tokens.forEach(t -> t.setRevoked(true));
        tokenRepository.saveAll(tokens);
        return tokens.size();
    }

    public String generateGuideLink(WelcomeGuideToken token) {
        return guideConfig.getBaseUrl() + "/" + token.getToken().toString();
    }

    public byte[] generateQrCode(String url, int width, int height) {
        try {
            QRCodeWriter writer = new QRCodeWriter();
            BitMatrix matrix = writer.encode(url, BarcodeFormat.QR_CODE, width, height);
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(matrix, "PNG", outputStream);
            return outputStream.toByteArray();
        } catch (Exception e) {
            log.error("Erreur generation QR code: {}", e.getMessage());
            throw new RuntimeException("Erreur generation QR code", e);
        }
    }

    @Transactional
    public void deleteGuide(Long guideId, Long orgId) {
        WelcomeGuide guide = loadGuide(guideId, orgId);
        // Suppression en cascade applicative : les FK enfants (créées par Hibernate, sans
        // ON DELETE CASCADE) bloquent le DELETE du livret tant que des tokens / entrées de
        // livre d'or subsistent. On purge d'abord les enfants, puis le livret. Les events
        // analytics (pas de FK) sont nettoyés pour ne pas laisser d'orphelins. Les commandes
        // d'upsell et commissions (guide_id dénormalisé, sans FK) sont des données financières
        // conservées telles quelles.
        tokenRepository.deleteByGuideId(guideId);
        entryRepository.deleteByGuideId(guideId);
        eventRepository.deleteByGuideId(guideId);
        guideRepository.delete(guide);
    }
}
