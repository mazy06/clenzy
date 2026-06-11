package com.clenzy.service.messaging;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.MapboxStaticImageService;
import com.clenzy.service.NotificationService;
import com.clenzy.service.WelcomeGuideService;
import com.clenzy.service.access.AccessCodeResolverService;
import com.clenzy.service.access.AccessCodeResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Orchestrateur principal de l'envoi de messages aux voyageurs.
 * Charge les donnees, interpole le template, envoie via le canal
 * et journalise le resultat.
 *
 * Supporte le routage multi-canal (Email, WhatsApp, SMS) via List<MessageChannel>.
 */
@Service
public class GuestMessagingService {

    private static final Logger log = LoggerFactory.getLogger(GuestMessagingService.class);

    private final List<MessageChannel> channels;
    private final TemplateInterpolationService interpolationService;
    private final GuestMessageLogRepository messageLogRepository;
    private final CheckInInstructionsRepository instructionsRepository;
    private final MessageTemplateRepository templateRepository;
    private final ReservationRepository reservationRepository;
    private final NotificationService notificationService;
    private final AccessCodeResolverService accessCodeResolverService;
    private final MapboxStaticImageService mapboxStaticImageService;
    private final WelcomeGuideService welcomeGuideService;

    public GuestMessagingService(
            List<MessageChannel> channels,
            TemplateInterpolationService interpolationService,
            GuestMessageLogRepository messageLogRepository,
            CheckInInstructionsRepository instructionsRepository,
            MessageTemplateRepository templateRepository,
            ReservationRepository reservationRepository,
            NotificationService notificationService,
            AccessCodeResolverService accessCodeResolverService,
            MapboxStaticImageService mapboxStaticImageService,
            WelcomeGuideService welcomeGuideService
    ) {
        this.channels = channels;
        this.interpolationService = interpolationService;
        this.messageLogRepository = messageLogRepository;
        this.instructionsRepository = instructionsRepository;
        this.templateRepository = templateRepository;
        this.reservationRepository = reservationRepository;
        this.notificationService = notificationService;
        this.accessCodeResolverService = accessCodeResolverService;
        this.mapboxStaticImageService = mapboxStaticImageService;
        this.welcomeGuideService = welcomeGuideService;
    }

    /**
     * Genere un apercu du message (sujet + corps HTML) sans l'envoyer.
     * Utilise pour afficher le contenu d'un message dans l'historique.
     */
    @Transactional(readOnly = true)
    public TemplateInterpolationService.InterpolatedMessage previewMessage(
            Long reservationId, Long templateId, Long orgId) {
        Reservation reservation = reservationRepository.findById(reservationId)
            .orElseThrow(() -> new IllegalArgumentException("Reservation introuvable: " + reservationId));

        MessageTemplate template = templateRepository.findByIdAndOrganizationId(templateId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Template introuvable: " + templateId));

        Property property = reservation.getProperty();
        Guest guest = reservation.getGuest();

        CheckInInstructions instructions = instructionsRepository
            .findByPropertyIdAndOrganizationId(property.getId(), orgId)
            .orElse(null);

        return interpolationService.interpolate(
            template, reservation, guest, property, instructions);
    }

    /**
     * Envoi manuel d'un message pour une reservation avec un template donne.
     */
    @Transactional
    public GuestMessageLog sendMessage(Long reservationId, Long templateId, Long orgId) {
        return sendMessage(reservationId, templateId, orgId, MessageChannelType.EMAIL);
    }

    /**
     * Envoi manuel via un canal specifique.
     * <p>
     * Verifie la presence d'un destinataire AVANT d'engager le pipeline d'envoi pour
     * eviter de creer un log FAILED previsible quand la reservation provient d'un
     * iCal anonymise (Airbnb / Booking.com) — l'historique reste propre et l'UI
     * peut afficher un message clair via le 400 renvoye par le controller.
     */
    @Transactional
    public GuestMessageLog sendMessage(Long reservationId, Long templateId, Long orgId,
                                        MessageChannelType channelType) {
        Reservation reservation = reservationRepository.findById(reservationId)
            .orElseThrow(() -> new IllegalArgumentException("Reservation introuvable: " + reservationId));

        // Ownership (regle audit 2026-06 #3) : findById contourne le filtre Hibernate.
        // Le reservationId peut etre controle par l'appelant (ex: tool LLM send_guest_message) ;
        // refuser si la reservation n'appartient pas a l'organisation du caller, sinon envoi
        // de message guest declenche sur une reservation cross-org.
        if (reservation.getOrganizationId() != null && !reservation.getOrganizationId().equals(orgId)) {
            throw new AccessDeniedException(
                "Reservation " + reservationId + " hors de l'organisation " + orgId);
        }

        MessageTemplate template = templateRepository.findByIdAndOrganizationId(templateId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Template introuvable: " + templateId));

        ensureRecipientResolvable(reservation, channelType);

        return sendForReservationViaChannel(reservation, template, orgId, channelType, Map.of());
    }

    /**
     * Verifie qu'un destinataire valide existe pour le canal demande.
     * Si non, leve une {@link MessagingRecipientMissingException} (HTTP 400) — pas de log cree.
     */
    private void ensureRecipientResolvable(Reservation reservation, MessageChannelType channelType) {
        Guest guest = reservation.getGuest();
        String emailValue = guest != null ? guest.getEmail() : null;
        String phoneValue = guest != null ? guest.getPhone() : null;

        String missing = switch (channelType) {
            case EMAIL -> (emailValue == null || emailValue.isBlank()) ? "email" : null;
            case SMS, WHATSAPP -> (phoneValue == null || phoneValue.isBlank()) ? "telephone" : null;
            default -> null;
        };

        if (missing == null) return;

        String source = reservation.getSource() != null ? reservation.getSource() : "";
        boolean anonymizedIcal = source.equalsIgnoreCase("airbnb")
                || source.equalsIgnoreCase("booking")
                || source.toLowerCase().contains("ical");

        String hint = anonymizedIcal
                ? "Réservation importée via iCal (" + source + ") — l'email du voyageur n'est pas exposé. "
                + "Ajoute les coordonnées manuellement dans la fiche guest pour activer l'envoi."
                : "Renseigne d'abord les coordonnées du voyageur dans la fiche guest.";

        String message = "Aucun " + missing + " n'est associé au voyageur de cette réservation. " + hint;
        throw new com.clenzy.exception.MessagingRecipientMissingException(
                reservation.getId(), channelType.name(), message);
    }

    /**
     * Envoie un message pour une reservation chargee (utilise par le scheduler).
     * Utilise le canal email par defaut.
     */
    @Transactional
    public GuestMessageLog sendForReservation(Reservation reservation, MessageTemplate template, Long orgId) {
        return sendForReservationViaChannel(reservation, template, orgId, MessageChannelType.EMAIL, Map.of());
    }

    /**
     * Envoie un message via un canal specifique avec variables supplementaires.
     */
    @Transactional
    public GuestMessageLog sendForReservationViaChannel(Reservation reservation, MessageTemplate template,
                                                         Long orgId, MessageChannelType channelType,
                                                         Map<String, String> extraVars) {
        Property property = reservation.getProperty();
        Guest guest = reservation.getGuest();

        CheckInInstructions instructions = instructionsRepository
            .findByPropertyIdAndOrganizationId(property.getId(), orgId)
            .orElse(null);

        // Resoudre le code d'acces dynamique (serrure connectee, echange de cles, ou manuel)
        Map<String, String> resolvedVars = new LinkedHashMap<>(extraVars);
        try {
            AccessCodeResult accessResult = accessCodeResolverService
                    .resolveForReservation(property, reservation, instructions);
            resolvedVars.putAll(accessResult.templateVariables());
            log.debug("Code d'acces resolu: method={}, property={}, reservation={}",
                    accessResult.method(), property.getId(), reservation.getId());
        } catch (Exception e) {
            log.error("Erreur resolution code d'acces pour reservation={}: {}",
                    reservation.getId(), e.getMessage(), e);
            // Continue sans code dynamique — le code statique de CheckInInstructions sera utilise
        }

        // Anti entree anticipee : le code d'acces (et les codes additionnels) ne sont communiques
        // qu'a partir de l'heure de check-in (meme regle que le livret). Avant ce moment, les tags
        // renvoient vers le livret au lieu des codes reels (texte FR, traduit ensuite dans la
        // langue du guest). Repli : si AUCUN livret publie n'existe, l'email reste le seul canal
        // du code → on ne masque pas (sinon le voyageur ne le recevrait jamais).
        if (!com.clenzy.service.access.StayTimes.isAfterCheckIn(reservation, property)
                && welcomeGuideService.hasPublishedGuideFor(reservation)) {
            var checkInAt = com.clenzy.service.access.StayTimes.checkInMoment(reservation, property);
            String at = checkInAt != null ? checkInAt.toLocalTime().toString() : "15:00";
            resolvedVars.put("accessCode",
                    "Communiqué le jour de votre arrivée à partir de " + at
                    + " — il s'affichera dans votre livret d'accueil");
            String extraPlaceholder = "Communiqué le jour de votre arrivée dans votre livret d'accueil";
            if (instructions != null) {
                for (String var : TemplateInterpolationService.extraCodeVariableNames(instructions.getExtraAccessCodes())) {
                    resolvedVars.put(var, extraPlaceholder);
                }
            }
        }

        // Resoudre le lien du livret d'accueil ({guideLink}) uniquement si le template
        // y fait reference et qu'il n'a pas deja ete fourni (l'action SEND_GUIDE le passe
        // deja via extraVars). On evite ainsi de creer un token de livret inutile pour les
        // messages qui ne l'utilisent pas (check-in, check-out, etc.). Best-effort : un
        // echec ne doit pas bloquer l'envoi du message.
        if (!resolvedVars.containsKey("guideLink") && templateReferencesGuideLink(template)) {
            try {
                welcomeGuideService.linkForReservation(reservation)
                        .ifPresent(link -> resolvedVars.put("guideLink", link));
            } catch (Exception e) {
                log.warn("Resolution du lien livret echouee pour reservation={}: {}",
                        reservation.getId(), e.getMessage());
            }
        }

        // Generer la carte de localisation Mapbox (propriete + point d'echange si applicable)
        try {
            Double storeLat = parseDoubleOrNull(resolvedVars.get("keyExchangeStoreLat"));
            Double storeLng = parseDoubleOrNull(resolvedVars.get("keyExchangeStoreLng"));
            String storeName = resolvedVars.get("keyExchangeStoreName");

            String mapImageTag = mapboxStaticImageService.generateMapImageTag(
                    property.getLatitude(), property.getLongitude(),
                    storeLat, storeLng,
                    property.getName(), storeName
            );
            resolvedVars.put("locationMap", mapImageTag);
        } catch (Exception e) {
            log.warn("Erreur generation carte Mapbox pour reservation={}: {}",
                    reservation.getId(), e.getMessage());
            resolvedVars.put("locationMap", "");
        }

        // Interpoler et traduire
        String guestLanguage = guest != null ? guest.getLanguage() : "fr";
        TemplateInterpolationService.InterpolatedMessage interpolated =
            interpolationService.interpolateAndTranslate(
                template, reservation, guest, property, instructions,
                resolvedVars, guestLanguage);

        // Construire la requete d'envoi
        MessageDeliveryRequest request = new MessageDeliveryRequest(
            guest != null ? guest.getEmail() : null,
            guest != null ? guest.getPhone() : null,
            guest != null ? guest.getFullName() : reservation.getGuestName(),
            interpolated.subject(),
            interpolated.htmlBody(),
            interpolated.plainBody(),
            guestLanguage
        );

        // Trouver le canal
        MessageChannel channel = findChannel(channelType);

        // Verifier la disponibilite
        if (channel == null || !channel.isAvailable()) {
            // Fallback vers email si le canal demande n'est pas disponible
            if (channelType != MessageChannelType.EMAIL) {
                log.warn("Canal {} indisponible, fallback vers EMAIL", channelType);
                channel = findChannel(MessageChannelType.EMAIL);
            }
            if (channel == null || !channel.isAvailable()) {
                log.warn("Aucun canal disponible pour la reservation {}", reservation.getId());
                return createLog(reservation, guest, template, orgId, channelType,
                    "N/A", interpolated.subject(), MessageStatus.FAILED, "Aucun canal disponible");
            }
        }

        // Verifier le destinataire selon le canal
        String recipient = getRecipient(request, channel.getChannelType());
        if (recipient == null || recipient.isBlank()) {
            log.warn("Pas de destinataire {} pour la reservation {}",
                channel.getChannelType(), reservation.getId());
            return createLog(reservation, guest, template, orgId, channel.getChannelType(),
                "N/A", interpolated.subject(), MessageStatus.FAILED,
                "Pas de destinataire pour le canal " + channel.getChannelType());
        }

        // Envoyer
        MessageDeliveryResult result = channel.send(request);

        MessageStatus status = result.success() ? MessageStatus.SENT : MessageStatus.FAILED;
        GuestMessageLog logEntry = createLog(
            reservation, guest, template, orgId, channel.getChannelType(),
            recipient, interpolated.subject(), status, result.errorMessage()
        );

        // Notification interne
        String notifTitle = result.success()
            ? "Message envoye a " + request.recipientName()
            : "Echec envoi message a " + request.recipientName();
        String notifMessage = result.success()
            ? "Template '" + template.getName() + "' envoye via " + channel.getChannelType()
            : "Erreur: " + result.errorMessage();

        NotificationKey key = result.success()
            ? NotificationKey.GUEST_MESSAGE_SENT
            : NotificationKey.GUEST_MESSAGE_FAILED;

        if (property.getOwner() != null && property.getOwner().getKeycloakId() != null) {
            notificationService.send(
                property.getOwner().getKeycloakId(), key, notifTitle, notifMessage, null
            );
        }

        return logEntry;
    }

    public boolean alreadySent(Long reservationId, MessageTemplateType type) {
        return messageLogRepository.existsSentOrPendingByReservationAndType(reservationId, type);
    }

    private MessageChannel findChannel(MessageChannelType type) {
        return channels.stream()
            .filter(c -> c.getChannelType() == type)
            .findFirst()
            .orElse(null);
    }

    private String getRecipient(MessageDeliveryRequest request, MessageChannelType channelType) {
        return switch (channelType) {
            case EMAIL -> request.recipientEmail();
            case WHATSAPP, SMS -> request.recipientPhone();
        };
    }

    private static Double parseDoubleOrNull(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Vrai si le sujet ou le corps du template reference la variable {@code {guideLink}}. */
    private static boolean templateReferencesGuideLink(MessageTemplate template) {
        return referencesGuideLink(template.getSubject()) || referencesGuideLink(template.getBody());
    }

    private static boolean referencesGuideLink(String text) {
        return text != null && text.contains("{guideLink}");
    }

    private GuestMessageLog createLog(
            Reservation reservation, Guest guest, MessageTemplate template,
            Long orgId, MessageChannelType channelType, String recipient,
            String subject, MessageStatus status, String errorMessage
    ) {
        GuestMessageLog entry = new GuestMessageLog();
        entry.setOrganizationId(orgId);
        entry.setReservation(reservation);
        entry.setGuest(guest);
        entry.setTemplate(template);
        entry.setChannel(channelType);
        entry.setRecipient(recipient);
        entry.setSubject(subject);
        entry.setStatus(status);
        entry.setErrorMessage(errorMessage);
        if (status == MessageStatus.SENT || status == MessageStatus.DELIVERED) {
            entry.setSentAt(LocalDateTime.now());
        }
        return messageLogRepository.save(entry);
    }
}
