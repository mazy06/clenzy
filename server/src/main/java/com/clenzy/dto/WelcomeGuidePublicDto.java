package com.clenzy.dto;

import com.clenzy.model.CheckInInstructions;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.WelcomeGuide;

import java.time.LocalDate;
import java.util.List;

/**
 * Payload public du livret d'accueil, servi au guest via un token valide.
 *
 * <p>Auto-rempli depuis le logement ({@link Property}), les instructions de
 * check-in ({@link CheckInInstructions}) et la reservation ({@link Reservation}) :
 * zero double-saisie pour l'hote. Le contenu editorial libre (autour de moi,
 * activites, sections custom) reste dans {@link #sections} (JSON gere par le livret).</p>
 */
public record WelcomeGuidePublicDto(
    String title,
    String language,
    String brandingColor,
    String theme,
    List<String> heroImageUrls,
    String welcomeMessage,
    String hostNames,
    String logoUrl,
    String sections,
    String pois,
    String curatedActivities,
    PropertyInfo property,
    PracticalInfo practical,
    StayInfo stay,
    CheckInInfo checkIn,
    boolean chatbotEnabled,
    boolean guestbookEnabled,
    boolean activitiesEnabled
) {
    /** Localisation du logement (pour la carte "autour de moi" + adresse). */
    public record PropertyInfo(
        String name,
        String address,
        String city,
        String postalCode,
        String country,
        Double latitude,
        Double longitude
    ) {}

    /** Informations pratiques sensibles : wifi, digicode, regles, urgences. */
    public record PracticalInfo(
        String wifiName,
        String wifiPassword,
        String accessCode,
        String parkingInfo,
        String arrivalInstructions,
        String departureInstructions,
        String houseRules,
        String emergencyContact,
        String additionalNotes,
        /** JSON [{key, caption}] — photos d'indication d'acces ; le front construit l'URL via le token. */
        String arrivalPhotos
    ) {}

    /** Check-in en ligne lie au sejour (nullable si non configure pour ce sejour). */
    public record CheckInInfo(String link, String status) {}

    /** Contexte du sejour courant (nullable si token sans reservation). */
    public record StayInfo(
        LocalDate checkIn,
        LocalDate checkOut,
        String checkInTime,
        String checkOutTime,
        String guestName,
        Integer guestCount
    ) {}

    /**
     * Donnees auto-remplies d'un logement pour l'apercu cote hote (config) : memes sources
     * que le payload guest (Property + CheckInInstructions), sans token ni reservation.
     * Permet a l'editeur de livret de montrer les vraies infos (adresse, wifi, digicode,
     * horaires par defaut) dans l'apercu telephone en direct.
     */
    public record PreviewData(PropertyInfo property, PracticalInfo practical, StayInfo stay) {}

    public static WelcomeGuidePublicDto from(WelcomeGuide g, Property p,
                                             CheckInInstructions ci, Reservation r,
                                             String dynamicAccessCode, CheckInInfo checkIn,
                                             List<String> heroImageUrls) {
        PropertyInfo propertyInfo = (p == null) ? null : new PropertyInfo(
            p.getName(), p.getAddress(), p.getCity(), p.getPostalCode(), p.getCountry(),
            p.getLatitude() != null ? p.getLatitude().doubleValue() : null,
            p.getLongitude() != null ? p.getLongitude().doubleValue() : null
        );

        // Le digicode dynamique (serrure connectee) ecrase le code statique des instructions.
        boolean hasDynamicCode = dynamicAccessCode != null && !dynamicAccessCode.isBlank();
        PracticalInfo practicalInfo = (ci == null && !hasDynamicCode) ? null : new PracticalInfo(
            ci != null ? ci.getWifiName() : null,
            ci != null ? ci.getWifiPassword() : null,
            hasDynamicCode ? dynamicAccessCode : (ci != null ? ci.getAccessCode() : null),
            ci != null ? ci.getParkingInfo() : null,
            ci != null ? ci.getArrivalInstructions() : null,
            ci != null ? ci.getDepartureInstructions() : null,
            ci != null ? ci.getHouseRules() : null,
            resolveEmergency(ci, p),
            ci != null ? ci.getAdditionalNotes() : null,
            ci != null && ci.getArrivalPhotos() != null ? ci.getArrivalPhotos() : "[]"
        );

        StayInfo stayInfo = (r == null) ? null : new StayInfo(
            r.getCheckIn(), r.getCheckOut(),
            firstNonBlank(r.getCheckInTime(), p != null ? p.getDefaultCheckInTime() : null),
            firstNonBlank(r.getCheckOutTime(), p != null ? p.getDefaultCheckOutTime() : null),
            r.getGuestName(), r.getGuestCount()
        );

        return new WelcomeGuidePublicDto(
            g.getTitle(), g.getLanguage(), g.getBrandingColor(),
            g.getTheme() != null ? g.getTheme() : "atelier", heroImageUrls,
            g.getWelcomeMessage(), g.getHostNames(),
            g.getLogoUrl(), g.getSections(), g.getPois(),
            g.getCuratedActivities(),
            propertyInfo, practicalInfo, stayInfo, checkIn,
            g.isChatbotEnabled(), g.isGuestbookEnabled(), g.isActivitiesEnabled()
        );
    }

    /**
     * Construit les donnees d'apercu (config hote) depuis le logement + ses instructions
     * de check-in, sans token ni reservation. Le sejour expose seulement les horaires par
     * defaut du logement (pas de guest). Memes regles de mapping que {@link #from}.
     */
    public static PreviewData previewFrom(Property p, CheckInInstructions ci) {
        PropertyInfo propertyInfo = (p == null) ? null : new PropertyInfo(
            p.getName(), p.getAddress(), p.getCity(), p.getPostalCode(), p.getCountry(),
            p.getLatitude() != null ? p.getLatitude().doubleValue() : null,
            p.getLongitude() != null ? p.getLongitude().doubleValue() : null
        );
        PracticalInfo practicalInfo = (ci == null) ? null : new PracticalInfo(
            ci.getWifiName(), ci.getWifiPassword(), ci.getAccessCode(), ci.getParkingInfo(),
            ci.getArrivalInstructions(), ci.getDepartureInstructions(), ci.getHouseRules(),
            resolveEmergency(ci, p), ci.getAdditionalNotes(),
            ci.getArrivalPhotos() != null ? ci.getArrivalPhotos() : "[]"
        );
        StayInfo stayInfo = (p == null) ? null : new StayInfo(
            null, null,
            p.getDefaultCheckInTime(), p.getDefaultCheckOutTime(),
            null, null
        );
        return new PreviewData(propertyInfo, practicalInfo, stayInfo);
    }

    private static String resolveEmergency(CheckInInstructions ci, Property p) {
        if (ci != null && ci.getEmergencyContact() != null && !ci.getEmergencyContact().isBlank()) {
            return ci.getEmergencyContact();
        }
        return p != null ? p.getEmergencyContact() : null;
    }

    private static String firstNonBlank(String a, String b) {
        return (a != null && !a.isBlank()) ? a : b;
    }
}
