package com.clenzy.integration.channel;

import com.clenzy.integration.channel.model.ChannelCalendarDay;
import com.clenzy.integration.channel.model.ChannelMapping;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Contrat commun pour tous les connecteurs channel (Airbnb, Booking, VRBO, iCal).
 *
 * Chaque implementation est un bean Spring enregistre automatiquement
 * dans le {@link ChannelConnectorRegistry}.
 *
 * Les methodes avec {@code default} sont optionnelles et retournent
 * UNSUPPORTED si le channel ne les supporte pas.
 *
 * Principes :
 * - orgId est toujours passe en parametre (pas de TenantContext, compatible Kafka consumers)
 * - Les operations INBOUND (channel → PMS) passent par handleInboundEvent()
 * - Les operations OUTBOUND (PMS → channel) passent par pushCalendar/pushReservation
 * - Le CalendarEngine reste la source de verite pour le calendrier
 */
public interface ChannelConnector {

    /**
     * Nom unique du channel.
     */
    ChannelName getChannelName();

    /**
     * Capacites supportees par ce channel.
     */
    Set<ChannelCapability> getCapabilities();

    /**
     * Resout le mapping entre une propriete PMS et le listing cote channel.
     *
     * @param propertyId propriete PMS
     * @param orgId      organisation
     * @return le mapping si la propriete est liee a ce channel
     */
    Optional<ChannelMapping> resolveMapping(Long propertyId, Long orgId);

    /**
     * Traite un evenement entrant (webhook ou resultat de poll).
     *
     * @param eventType type d'evenement (ex: "calendar.updated", "reservation.created")
     * @param data      payload de l'evenement
     * @param orgId     organisation
     */
    void handleInboundEvent(String eventType, Map<String, Object> data, Long orgId);

    /**
     * Pousse une mise a jour calendrier vers le channel (OUTBOUND).
     * Implementation optionnelle — retourne UNSUPPORTED par defaut.
     *
     * @param propertyId propriete PMS
     * @param from       debut de la plage (inclus)
     * @param to         fin de la plage (exclus)
     * @param orgId      organisation
     * @return resultat de la synchronisation
     */
    default SyncResult pushCalendarUpdate(Long propertyId, LocalDate from,
                                           LocalDate to, Long orgId) {
        return SyncResult.unsupported("Calendar push not supported by " + getChannelName());
    }

    /**
     * Pousse une mise a jour reservation vers le channel (OUTBOUND).
     * Implementation optionnelle — retourne UNSUPPORTED par defaut.
     *
     * @param reservationId reservation PMS
     * @param orgId         organisation
     * @return resultat de la synchronisation
     */
    default SyncResult pushReservationUpdate(Long reservationId, Long orgId) {
        return SyncResult.unsupported("Reservation push not supported by " + getChannelName());
    }

    /**
     * Verifie la sante de la connexion channel.
     *
     * @param connectionId id de la connexion
     * @return statut de sante
     */
    default HealthStatus checkHealth(Long connectionId) {
        return HealthStatus.UNKNOWN;
    }

    /**
     * Lit le calendrier cote channel pour reconciliation.
     * Retourne une liste vide par defaut (le channel ne supporte pas la lecture).
     *
     * @param mapping mapping property-channel
     * @param from    debut de la plage (inclus)
     * @param to      fin de la plage (exclus)
     * @return liste des jours calendrier cote channel
     */
    default List<ChannelCalendarDay> getChannelCalendar(ChannelMapping mapping,
                                                         LocalDate from, LocalDate to) {
        return List.of();
    }

    /**
     * Recupere les avis guests depuis le channel.
     * Retourne une liste vide par defaut.
     */
    default java.util.List<com.clenzy.model.GuestReview> pullReviews(Long propertyId, Long orgId, java.time.LocalDate from) {
        return java.util.List.of();
    }

    /**
     * Pousse une promotion vers le channel (OUTBOUND).
     * Retourne UNSUPPORTED par defaut.
     */
    default SyncResult pushPromotion(com.clenzy.model.ChannelPromotion promo, Long orgId) {
        return SyncResult.unsupported("Promotion push not supported by " + getChannelName());
    }

    /**
     * Recupere les promotions depuis le channel.
     * Retourne une liste vide par defaut.
     */
    default java.util.List<com.clenzy.model.ChannelPromotion> pullPromotions(Long propertyId, Long orgId) {
        return java.util.List.of();
    }

    // ── Restrictions ─────────────────────────────────────────────────────────

    /**
     * Pousse les restrictions de sejour vers le channel (OUTBOUND).
     * Retourne UNSUPPORTED par defaut.
     *
     * @param propertyId propriete PMS
     * @param from       debut de la plage (inclus)
     * @param to         fin de la plage (exclus)
     * @param orgId      organisation
     * @return resultat de la synchronisation
     */
    default SyncResult pushRestrictions(Long propertyId, LocalDate from,
                                         LocalDate to, Long orgId) {
        return SyncResult.unsupported("Restriction push not supported by " + getChannelName());
    }

    // ── Contenu ──────────────────────────────────────────────────────────────

    /**
     * Pousse le contenu (description, photos, amenities) vers le channel.
     * Retourne UNSUPPORTED par defaut.
     */
    default SyncResult pushContent(com.clenzy.model.ChannelContentMapping content, Long orgId) {
        return SyncResult.unsupported("Content push not supported by " + getChannelName());
    }

    /**
     * Recupere le contenu depuis le channel pour une propriete.
     * Retourne UNSUPPORTED par defaut.
     */
    default SyncResult pullContent(Long propertyId, Long orgId) {
        return SyncResult.unsupported("Content pull not supported by " + getChannelName());
    }

    // ── Frais / Extras ───────────────────────────────────────────────────────

    /**
     * Pousse les frais supplementaires vers le channel.
     * Retourne UNSUPPORTED par defaut.
     */
    default SyncResult pushFees(java.util.List<com.clenzy.model.ChannelFee> fees, Long orgId) {
        return SyncResult.unsupported("Fees push not supported by " + getChannelName());
    }

    /**
     * Recupere les frais supplementaires depuis le channel.
     * Retourne une liste vide par defaut.
     */
    default java.util.List<com.clenzy.model.ChannelFee> pullFees(Long propertyId, Long orgId) {
        return java.util.List.of();
    }

    // ── Politiques d'annulation ──────────────────────────────────────────────

    /**
     * Pousse une politique d'annulation vers le channel.
     * Retourne UNSUPPORTED par defaut.
     */
    default SyncResult pushCancellationPolicy(com.clenzy.model.ChannelCancellationPolicy policy, Long orgId) {
        return SyncResult.unsupported("Cancellation policy push not supported by " + getChannelName());
    }

    /**
     * Recupere les politiques d'annulation depuis le channel.
     * Retourne une liste vide par defaut.
     */
    default java.util.List<com.clenzy.model.ChannelCancellationPolicy> pullCancellationPolicies(Long propertyId, Long orgId) {
        return java.util.List.of();
    }

    // ── Utilitaires ──────────────────────────────────────────────────────────

    /**
     * Teste si le channel supporte une capacite donnee.
     */
    default boolean supports(ChannelCapability capability) {
        return getCapabilities().contains(capability);
    }
}
