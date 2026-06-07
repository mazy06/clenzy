package com.clenzy.service.messaging;

import com.clenzy.dto.ConversationDto;
import com.clenzy.model.CheckInInstructions;
import com.clenzy.model.Conversation;
import com.clenzy.model.ConversationChannel;
import com.clenzy.model.Guest;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.WhatsAppTemplateContent;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.clenzy.repository.ConversationRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.messaging.whatsapp.WhatsAppTemplateService;
import com.clenzy.service.messaging.whatsapp.WhatsAppVariableConverter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * Envoi d'un template WhatsApp (editable) sur une conversation rattachee a une
 * reservation.
 *
 * <p>Flux : resout le {@link WhatsAppTemplateContent} (override org → systeme),
 * interpole ses variables depuis la reservation/guest, envoie via le provider
 * actif ({@link WhatsAppChannel#sendTemplate} : template Meta officiel, ou
 * fallback texte rendu pour OpenWA), puis enregistre le message SORTANT.</p>
 *
 * <p>Bypasse la fenetre 24h : c'est precisement le role d'un template de relancer
 * un guest hors fenetre.</p>
 */
@Service
public class WhatsAppTemplateSender {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppTemplateSender.class);

    private final ConversationRepository conversationRepository;
    private final ReservationRepository reservationRepository;
    private final CheckInInstructionsRepository instructionsRepository;
    private final ConversationService conversationService;
    private final WhatsAppTemplateService templateService;
    private final TemplateInterpolationService interpolation;
    private final WhatsAppVariableConverter variableConverter;
    private final WhatsAppChannel whatsAppChannel;

    public WhatsAppTemplateSender(ConversationRepository conversationRepository,
                                  ReservationRepository reservationRepository,
                                  CheckInInstructionsRepository instructionsRepository,
                                  ConversationService conversationService,
                                  WhatsAppTemplateService templateService,
                                  TemplateInterpolationService interpolation,
                                  WhatsAppVariableConverter variableConverter,
                                  WhatsAppChannel whatsAppChannel) {
        this.conversationRepository = conversationRepository;
        this.reservationRepository = reservationRepository;
        this.instructionsRepository = instructionsRepository;
        this.conversationService = conversationService;
        this.templateService = templateService;
        this.interpolation = interpolation;
        this.variableConverter = variableConverter;
        this.whatsAppChannel = whatsAppChannel;
    }

    @Transactional
    public ConversationDto sendTemplate(Long conversationId, String templateKey,
                                        String senderName, String senderKeycloakId) {
        Conversation conv = conversationRepository.findById(conversationId)
            .orElseThrow(() -> new IllegalArgumentException("Conversation introuvable: " + conversationId));

        Reservation res = conv.getReservation();
        if (res == null) {
            throw new IllegalArgumentException("Rattachez d'abord la conversation à une réservation avant d'envoyer un template.");
        }
        Guest guest = conv.getGuest();
        if (guest == null || guest.getPhone() == null || guest.getPhone().isBlank()) {
            throw new IllegalArgumentException("Aucun numéro de téléphone pour ce guest.");
        }
        Property property = conv.getProperty() != null ? conv.getProperty() : res.getProperty();
        if (property == null) {
            throw new IllegalArgumentException("Réservation sans logement associé.");
        }

        String metaLang = mapMetaLocale(guest.getLanguage());
        WhatsAppTemplateContent template = templateService.resolve(conv.getOrganizationId(), templateKey, metaLang)
            .or(() -> templateService.resolve(conv.getOrganizationId(), templateKey, "fr_FR"))
            .orElseThrow(() -> new IllegalArgumentException("Template introuvable: " + templateKey));

        // Charge les instructions check-in du logement (code d'accès, wifi, parking…)
        // pour résoudre {accessCode}/{wifiPassword}/etc. dans le template.
        CheckInInstructions instructions = instructionsRepository
            .findByPropertyIdAndOrganizationId(property.getId(), conv.getOrganizationId())
            .orElse(null);
        Map<String, String> vars = interpolation.buildVariables(res, guest, property, instructions);
        String renderedBody = interpolation.interpolate(template.getBodyNamed(), vars, false);
        List<String> params = variableConverter.extractVariables(template.getBodyNamed()).stream()
            .map(v -> vars.getOrDefault(v, ""))
            .toList();

        MessageDeliveryResult result = whatsAppChannel.sendTemplate(
            guest.getPhone(), template.getMetaTemplateName(), template.getLanguage(), params, renderedBody);

        String status = result.success() ? "SENT" : "FAILED";
        conversationService.recordOutboundDelivered(
            conv, senderName, senderKeycloakId, renderedBody, result.providerMessageId(), status);

        log.info("Template WhatsApp '{}' envoyé sur conv {} (status {})", templateKey, conversationId, status);
        return ConversationDto.from(conv);
    }

    /**
     * Envoi proactif d'un template depuis une RÉSERVATION (le guest n'a pas
     * forcément encore écrit) : crée/récupère la conversation WhatsApp de la
     * réservation puis délègue à {@link #sendTemplate}.
     */
    @Transactional
    public ConversationDto sendTemplateForReservation(Long reservationId, String templateKey,
                                                      String senderName, String senderKeycloakId) {
        Reservation res = reservationRepository.findById(reservationId)
            .orElseThrow(() -> new IllegalArgumentException("Réservation introuvable: " + reservationId));
        Conversation conv = conversationService.getOrCreateForReservation(
            res.getOrganizationId(), reservationId, ConversationChannel.WHATSAPP,
            res.getGuest(), res.getProperty(), res);
        return sendTemplate(conv.getId(), templateKey, senderName, senderKeycloakId);
    }

    /** Langue guest (ex "fr") → locale Meta du template (ex "fr_FR"). */
    private static String mapMetaLocale(String lang) {
        if (lang == null) return "fr_FR";
        return switch (lang.toLowerCase()) {
            case "en" -> "en_US";
            case "ar" -> "ar_AR";
            default -> "fr_FR";
        };
    }
}
