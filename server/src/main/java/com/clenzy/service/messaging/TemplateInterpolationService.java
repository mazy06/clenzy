package com.clenzy.service.messaging;

import com.clenzy.model.*;
import com.clenzy.util.StringUtils;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Interpole les variables dynamiques dans les templates de message.
 * Toutes les valeurs sont echappees HTML pour le corps HTML.
 */
@Service
public class TemplateInterpolationService {

    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{(\\w+)}");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    /**
     * Variables supportees avec leur description (pour l'endpoint /variables).
     */
    public static final List<TemplateVariable> SUPPORTED_VARIABLES = List.of(
        new TemplateVariable("guestName", "Nom complet du voyageur", "Jean Dupont"),
        new TemplateVariable("guestFirstName", "Prenom du voyageur", "Jean"),
        new TemplateVariable("propertyName", "Nom de la propriete", "Studio Riviera"),
        new TemplateVariable("propertyAddress", "Adresse complete", "12 rue de la Paix, 75002 Paris"),
        new TemplateVariable("checkInDate", "Date d'arrivee", "15/03/2026"),
        new TemplateVariable("checkOutDate", "Date de depart", "20/03/2026"),
        new TemplateVariable("checkInTime", "Heure d'arrivee", "15:00"),
        new TemplateVariable("checkOutTime", "Heure de depart", "11:00"),
        new TemplateVariable("accessCode", "Code d'acces", "1234"),
        new TemplateVariable("wifiName", "Nom du reseau WiFi", "Studio-Wifi"),
        new TemplateVariable("wifiPassword", "Mot de passe WiFi", "password123"),
        new TemplateVariable("parkingInfo", "Informations parking", "Place 12, sous-sol B"),
        new TemplateVariable("arrivalInstructions", "Instructions d'arrivee", "Prendre l'ascenseur..."),
        new TemplateVariable("departureInstructions", "Instructions de depart", "Laisser les cles..."),
        new TemplateVariable("houseRules", "Regles de la maison", "Pas de fete, pas de bruit..."),
        new TemplateVariable("emergencyContact", "Contact d'urgence", "+33 6 12 34 56 78"),
        new TemplateVariable("confirmationCode", "Code de confirmation", "ABC123"),
        new TemplateVariable("checkInLink", "Lien check-in en ligne", "https://app.clenzy.fr/checkin/abc123"),
        new TemplateVariable("guideLink", "Lien guide d'accueil", "https://app.clenzy.fr/guide/xyz789")
    );

    private final TranslationService translationService;

    public TemplateInterpolationService(TranslationService translationService) {
        this.translationService = translationService;
    }

    /**
     * Interpole un template avec les donnees de la reservation.
     */
    public InterpolatedMessage interpolate(
            MessageTemplate template,
            Reservation reservation,
            Guest guest,
            Property property,
            CheckInInstructions instructions
    ) {
        return interpolate(template, reservation, guest, property, instructions, Map.of());
    }

    /**
     * Interpole un template avec des variables supplementaires (checkInLink, guideLink, etc.).
     */
    public InterpolatedMessage interpolate(
            MessageTemplate template,
            Reservation reservation,
            Guest guest,
            Property property,
            CheckInInstructions instructions,
            Map<String, String> extraVars
    ) {
        Map<String, String> vars = buildVariableMap(reservation, guest, property, instructions);
        vars.putAll(extraVars);

        String subject = replaceVariables(template.getSubject(), vars, false);
        String htmlBody = replaceVariables(template.getBody(), vars, true);
        String plainBody = replaceVariables(template.getBody(), vars, false);

        return new InterpolatedMessage(subject, htmlBody, plainBody);
    }

    /**
     * Interpole un template puis traduit le resultat dans la langue du guest.
     * Si la traduction est desactivee ou si la langue est celle du template, retourne sans traduire.
     */
    public InterpolatedMessage interpolateAndTranslate(
            MessageTemplate template,
            Reservation reservation,
            Guest guest,
            Property property,
            CheckInInstructions instructions,
            Map<String, String> extraVars,
            String targetLanguage
    ) {
        InterpolatedMessage interpolated = interpolate(template, reservation, guest, property, instructions, extraVars);

        if (targetLanguage == null || targetLanguage.equalsIgnoreCase("fr")) {
            return interpolated;
        }

        String translatedSubject = translationService.translate(interpolated.subject(), targetLanguage);
        String translatedHtml = translationService.translate(interpolated.htmlBody(), targetLanguage);
        String translatedPlain = translationService.translate(interpolated.plainBody(), targetLanguage);

        return new InterpolatedMessage(translatedSubject, translatedHtml, translatedPlain);
    }

    private Map<String, String> buildVariableMap(
            Reservation reservation, Guest guest, Property property, CheckInInstructions instructions
    ) {
        Map<String, String> vars = new LinkedHashMap<>();

        // Guest
        if (guest != null) {
            vars.put("guestName", guest.getFullName());
            vars.put("guestFirstName", guest.getFirstName());
        } else {
            vars.put("guestName", reservation.getGuestName() != null ? reservation.getGuestName() : "");
            vars.put("guestFirstName", "");
        }

        // Property
        vars.put("propertyName", property.getName());
        vars.put("propertyAddress", property.getFullAddress());

        // Dates
        vars.put("checkInDate", reservation.getCheckIn() != null ? reservation.getCheckIn().format(DATE_FMT) : "");
        vars.put("checkOutDate", reservation.getCheckOut() != null ? reservation.getCheckOut().format(DATE_FMT) : "");

        // Times : reservation override > property default
        String checkInTime = reservation.getCheckInTime();
        if (checkInTime == null || checkInTime.isBlank()) {
            checkInTime = property.getDefaultCheckInTime();
        }
        vars.put("checkInTime", checkInTime != null ? checkInTime : "15:00");

        String checkOutTime = reservation.getCheckOutTime();
        if (checkOutTime == null || checkOutTime.isBlank()) {
            checkOutTime = property.getDefaultCheckOutTime();
        }
        vars.put("checkOutTime", checkOutTime != null ? checkOutTime : "11:00");

        // Check-in instructions
        if (instructions != null) {
            vars.put("accessCode", nullToEmpty(instructions.getAccessCode()));
            vars.put("wifiName", nullToEmpty(instructions.getWifiName()));
            vars.put("wifiPassword", nullToEmpty(instructions.getWifiPassword()));
            vars.put("parkingInfo", nullToEmpty(instructions.getParkingInfo()));
            vars.put("arrivalInstructions", nullToEmpty(instructions.getArrivalInstructions()));
            vars.put("departureInstructions", nullToEmpty(instructions.getDepartureInstructions()));
            vars.put("houseRules", nullToEmpty(instructions.getHouseRules()));
            // Emergency : instructions > property
            String emergency = instructions.getEmergencyContact();
            if (emergency == null || emergency.isBlank()) {
                emergency = property.getEmergencyContact();
            }
            vars.put("emergencyContact", nullToEmpty(emergency));
        } else {
            vars.put("accessCode", "");
            vars.put("wifiName", "");
            vars.put("wifiPassword", "");
            vars.put("parkingInfo", "");
            vars.put("arrivalInstructions", "");
            vars.put("departureInstructions", "");
            vars.put("houseRules", "");
            vars.put("emergencyContact", nullToEmpty(property.getEmergencyContact()));
        }

        // Reservation
        vars.put("confirmationCode", nullToEmpty(reservation.getConfirmationCode()));

        return vars;
    }

    /**
     * Remplace les variables {name} dans le texte.
     * Si escapeHtml=true, les valeurs sont echappees pour le HTML.
     */
    private String replaceVariables(String text, Map<String, String> vars, boolean escapeHtml) {
        if (text == null) return "";

        Matcher matcher = VARIABLE_PATTERN.matcher(text);
        StringBuilder sb = new StringBuilder();

        while (matcher.find()) {
            String key = matcher.group(1);
            String value = vars.getOrDefault(key, "{" + key + "}");
            if (escapeHtml) {
                value = StringUtils.escapeHtml(value);
            }
            matcher.appendReplacement(sb, Matcher.quoteReplacement(value));
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    private static String nullToEmpty(String value) {
        return value != null ? value : "";
    }

    /**
     * Variable de template avec description et exemple.
     */
    public record TemplateVariable(String key, String description, String example) {}

    /**
     * Message interpole pret a etre envoye.
     */
    public record InterpolatedMessage(String subject, String htmlBody, String plainBody) {}
}
