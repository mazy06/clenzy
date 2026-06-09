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
    boolean activitiesEnabled,
    boolean upsellsEnabled,
    /** false = livret non disponible (réservation absente ou révolue) → le guest voit un écran dédié. */
    boolean available,
    /** Raison d'indisponibilité quand {@code available=false} : {@code NO_RESERVATION} | {@code EXPIRED}. */
    String unavailableReason
) {
    /**
     * Copie avec un JSON {@code curatedActivities} reecrit (ex : injection des liens
     * d'affiliation Klook au moment de servir le livret). Tous les autres champs inchanges.
     */
    public WelcomeGuidePublicDto withCuratedActivities(String newCuratedActivities) {
        return new WelcomeGuidePublicDto(
            title, language, brandingColor, theme, heroImageUrls, welcomeMessage, hostNames,
            logoUrl, sections, pois, newCuratedActivities, property, practical, stay, checkIn,
            chatbotEnabled, guestbookEnabled, activitiesEnabled, upsellsEnabled, available, unavailableReason);
    }

    /**
     * Payload « livret non disponible » : titre + thème (pour habiller l'écran guest), aucun contenu
     * sensible. {@code reason} = {@code NO_RESERVATION} (aucune réservation liée) ou {@code EXPIRED}
     * (réservation révolue). Le contrôleur le renvoie en 200 ; le front affiche l'écran dédié.
     */
    public static WelcomeGuidePublicDto unavailable(WelcomeGuide g, String reason) {
        return new WelcomeGuidePublicDto(
            g.getTitle(), g.getLanguage(), g.getBrandingColor(),
            g.getTheme() != null ? g.getTheme() : "atelier", java.util.List.of(),
            null, null, g.getLogoUrl(), "[]", "[]", "[]",
            null, null, null, null,
            false, false, false, false, false, reason);
    }

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
    /** Référence légère d'une réservation (form admin : réservation liée / en cours ou à venir). */
    public record ReservationRef(Long id, String guestName, java.time.LocalDate checkIn,
                                 java.time.LocalDate checkOut, String status) {
        public static ReservationRef from(Reservation r) {
            return r == null ? null
                : new ReservationRef(r.getId(), r.getGuestName(), r.getCheckIn(), r.getCheckOut(), r.getStatus());
        }
    }

    public record PreviewData(PropertyInfo property, PracticalInfo practical, StayInfo stay,
                              ReservationRef currentReservation) {}

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
            g.isChatbotEnabled(), g.isGuestbookEnabled(), g.isActivitiesEnabled(),
            g.isUpsellsEnabled(), true, null
        );
    }

    /**
     * Construit les donnees d'apercu (config hote) depuis le logement + ses instructions
     * de check-in, sans token ni reservation. Le sejour expose seulement les horaires par
     * defaut du logement (pas de guest). Memes regles de mapping que {@link #from}.
     */
    public static PreviewData previewFrom(Property p, CheckInInstructions ci, Reservation currentReservation) {
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
        // Si une reservation est rattachee (sejour en cours / a venir), l'apercu reflete le VRAI
        // sejour : nom du voyageur, dates et nombre de voyageurs (c'est ce qui alimente le bandeau
        // "Bienvenue, <prenom>"). Sans reservation, on retombe sur les seuls horaires par defaut du
        // logement (pas de guest).
        StayInfo stayInfo;
        if (currentReservation != null) {
            stayInfo = new StayInfo(
                currentReservation.getCheckIn(), currentReservation.getCheckOut(),
                firstNonBlank(currentReservation.getCheckInTime(), p != null ? p.getDefaultCheckInTime() : null),
                firstNonBlank(currentReservation.getCheckOutTime(), p != null ? p.getDefaultCheckOutTime() : null),
                currentReservation.getGuestName(), currentReservation.getGuestCount()
            );
        } else if (p != null) {
            stayInfo = new StayInfo(null, null, p.getDefaultCheckInTime(), p.getDefaultCheckOutTime(), null, null);
        } else {
            stayInfo = null;
        }
        return new PreviewData(propertyInfo, practicalInfo, stayInfo, ReservationRef.from(currentReservation));
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
