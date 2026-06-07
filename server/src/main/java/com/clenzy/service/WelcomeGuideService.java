package com.clenzy.service;

import com.clenzy.config.GuideConfig;
import com.clenzy.dto.WelcomeGuidePublicDto;
import com.clenzy.dto.WelcomeGuideRequest;
import com.clenzy.service.access.AccessCodeResolverService;
import com.clenzy.model.*;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.WelcomeGuideRepository;
import com.clenzy.repository.WelcomeGuideTokenRepository;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class WelcomeGuideService {

    private static final Logger log = LoggerFactory.getLogger(WelcomeGuideService.class);

    private final WelcomeGuideRepository guideRepository;
    private final WelcomeGuideTokenRepository tokenRepository;
    private final PropertyRepository propertyRepository;
    private final CheckInInstructionsRepository checkInInstructionsRepository;
    private final GuideConfig guideConfig;
    private final AccessCodeResolverService accessCodeResolverService;
    private final OnlineCheckInService onlineCheckInService;

    public WelcomeGuideService(WelcomeGuideRepository guideRepository,
                                WelcomeGuideTokenRepository tokenRepository,
                                PropertyRepository propertyRepository,
                                CheckInInstructionsRepository checkInInstructionsRepository,
                                GuideConfig guideConfig,
                                AccessCodeResolverService accessCodeResolverService,
                                OnlineCheckInService onlineCheckInService) {
        this.guideRepository = guideRepository;
        this.tokenRepository = tokenRepository;
        this.propertyRepository = propertyRepository;
        this.checkInInstructionsRepository = checkInInstructionsRepository;
        this.guideConfig = guideConfig;
        this.accessCodeResolverService = accessCodeResolverService;
        this.onlineCheckInService = onlineCheckInService;
    }

    @Transactional
    public WelcomeGuide createGuide(Long orgId, WelcomeGuideRequest req) {
        Property property = propertyRepository.findById(req.propertyId())
            .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable: " + req.propertyId()));

        WelcomeGuide guide = new WelcomeGuide();
        guide.setOrganizationId(orgId);
        guide.setProperty(property);
        guide.setTitle(req.title());
        guide.setLanguage(req.language() != null ? req.language() : "fr");
        guide.setSections(req.sections() != null ? req.sections() : "[]");
        if (req.pois() != null) guide.setPois(req.pois());
        if (req.curatedActivities() != null) guide.setCuratedActivities(req.curatedActivities());
        if (req.brandingColor() != null) guide.setBrandingColor(req.brandingColor());
        if (req.logoUrl() != null) guide.setLogoUrl(req.logoUrl());
        if (req.chatbotEnabled() != null) guide.setChatbotEnabled(req.chatbotEnabled());
        if (req.guestbookEnabled() != null) guide.setGuestbookEnabled(req.guestbookEnabled());
        if (req.activitiesEnabled() != null) guide.setActivitiesEnabled(req.activitiesEnabled());

        return guideRepository.save(guide);
    }

    /** Met a jour un livret. Le logement et la langue ne sont pas modifiables apres creation (ignores). */
    @Transactional
    public WelcomeGuide updateGuide(Long guideId, Long orgId, WelcomeGuideRequest req) {
        WelcomeGuide guide = guideRepository.findByIdAndOrganizationId(guideId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Guide introuvable: " + guideId));

        if (req.title() != null) guide.setTitle(req.title());
        if (req.sections() != null) guide.setSections(req.sections());
        if (req.pois() != null) guide.setPois(req.pois());
        if (req.curatedActivities() != null) guide.setCuratedActivities(req.curatedActivities());
        if (req.brandingColor() != null) guide.setBrandingColor(req.brandingColor());
        if (req.logoUrl() != null) guide.setLogoUrl(req.logoUrl());
        if (req.published() != null) guide.setPublished(req.published());
        if (req.chatbotEnabled() != null) guide.setChatbotEnabled(req.chatbotEnabled());
        if (req.guestbookEnabled() != null) guide.setGuestbookEnabled(req.guestbookEnabled());
        if (req.activitiesEnabled() != null) guide.setActivitiesEnabled(req.activitiesEnabled());

        return guideRepository.save(guide);
    }

    public Optional<WelcomeGuide> getById(Long id, Long orgId) {
        return guideRepository.findByIdAndOrganizationId(id, orgId);
    }

    public List<WelcomeGuide> getAll(Long orgId) {
        return guideRepository.findByOrganizationIdOrderByCreatedAtDesc(orgId);
    }

    public List<WelcomeGuide> getByProperty(Long propertyId, Long orgId) {
        return guideRepository.findByPropertyIdAndOrganizationId(propertyId, orgId);
    }

    @Transactional
    public WelcomeGuideToken generateToken(Long guideId, Long orgId, Reservation reservation) {
        WelcomeGuide guide = guideRepository.findByIdAndOrganizationId(guideId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Guide introuvable: " + guideId));

        WelcomeGuideToken token = new WelcomeGuideToken();
        token.setOrganizationId(orgId);
        token.setGuide(guide);
        token.setReservation(reservation);
        token.setToken(UUID.randomUUID());
        applyValidityWindow(token, reservation);

        return tokenRepository.save(token);
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
        WelcomeGuide guide = resolvePublishedGuide(
            reservation.getProperty().getId(), reservation.getOrganizationId(), guestLanguage(reservation));
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
        WelcomeGuide guide = resolvePublishedGuide(
            reservation.getProperty().getId(), reservation.getOrganizationId(), guestLanguage(reservation));
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
        Property property = guide.getProperty();
        CheckInInstructions ci = (property != null)
            ? checkInInstructionsRepository.findByPropertyId(property.getId()).orElse(null)
            : null;
        Reservation reservation = t.getReservation();
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
        return Optional.of(
            WelcomeGuidePublicDto.from(guide, property, ci, reservation, dynamicAccessCode, checkIn));
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
        WelcomeGuide guide = guideRepository.findByIdAndOrganizationId(guideId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Guide introuvable: " + guideId));
        guideRepository.delete(guide);
    }
}
