package com.clenzy.integration.channex.dto;

/**
 * Indique qu'un OTA est synchronise sur une property du hub.
 *
 * <p>Affiche dans le modal Distribution en mini-badge logo OTA + check vert
 * exposant. Une property peut avoir 0 ou plusieurs OTAs (Airbnb + Booking + Vrbo).</p>
 *
 * @param otaName  nom officiel du channel Channex ("Airbnb", "AirBNB", "BookingCom",
 *                 "VrboCom", "ExpediaQuickConnect", "Agoda", ...). Le frontend match
 *                 sur la version normalisee (lowercase) avec CHANNEX_OTA_OPTIONS pour
 *                 retrouver brand color + initials.
 * @param isActive true si OAuth complet + Save fait dans le wizard hub
 * @param hasOauthToken true si des tokens OAuth sont stockes (auth reussie meme si pas Save)
 */
public record ChannexPropertyOtaSync(
    String otaName,
    boolean isActive,
    boolean hasOauthToken
) {}
