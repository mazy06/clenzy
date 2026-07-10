package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Phase C5 — Reporting Booking.com via Channex (protection revenus) :
 * no-show, carte invalide, annulation pour carte invalide.
 *
 * <p>Contraintes documentees : no-show declarable de minuit du jour d'arrivee
 * a +48 h ; {@code cancel_due_invalid_card} apres {@code invalid_card} et le
 * delai laisse au guest ; 422 {@code method_not_supported} si le canal ne
 * supporte pas l'operation (remonte tel quel au caller).</p>
 *
 * <p>Ownership : le booking Channex est resolu depuis la Reservation Clenzy
 * ({@code externalUid = "channex:{bookingId}"}) — on verifie que la resa
 * appartient a l'org AVANT tout appel Channex.</p>
 */
@Service
public class ChannexBookingReportingService {

    private static final Logger log = LoggerFactory.getLogger(ChannexBookingReportingService.class);

    private final ChannexClient channexClient;
    private final ReservationRepository reservationRepository;

    public ChannexBookingReportingService(ChannexClient channexClient,
                                          ReservationRepository reservationRepository) {
        this.channexClient = channexClient;
        this.reservationRepository = reservationRepository;
    }

    public record ReportResult(String status, Long reservationId, String channexBookingId) {}

    /** Signale un no-show (waivedFees = renoncer aux frais de no-show). */
    public ReportResult reportNoShow(Long reservationId, Long orgId, boolean waivedFees) {
        String channexBookingId = resolveChannexBookingId(reservationId, orgId);
        channexClient.reportNoShow(channexBookingId, waivedFees);
        log.info("ChannexReporting: no-show signale reservation=#{} booking={} waivedFees={}",
            reservationId, channexBookingId, waivedFees);
        return new ReportResult("no_show_reported", reservationId, channexBookingId);
    }

    /** Signale une carte invalide (le guest recoit un delai pour la corriger). */
    public ReportResult reportInvalidCard(Long reservationId, Long orgId) {
        String channexBookingId = resolveChannexBookingId(reservationId, orgId);
        channexClient.reportInvalidCard(channexBookingId);
        log.info("ChannexReporting: carte invalide signalee reservation=#{} booking={}",
            reservationId, channexBookingId);
        return new ReportResult("invalid_card_reported", reservationId, channexBookingId);
    }

    /** Annule la resa pour carte invalide (apres reportInvalidCard + delai guest). */
    public ReportResult cancelDueInvalidCard(Long reservationId, Long orgId) {
        String channexBookingId = resolveChannexBookingId(reservationId, orgId);
        channexClient.cancelDueInvalidCard(channexBookingId);
        log.info("ChannexReporting: annulation carte invalide reservation=#{} booking={}",
            reservationId, channexBookingId);
        return new ReportResult("cancelled_due_invalid_card", reservationId, channexBookingId);
    }

    /**
     * Resout l'id booking Channex d'une reservation de l'org. La resa doit
     * VENIR de Channex (externalUid {@code channex:...}) — le reporting ne
     * s'applique qu'aux resas OTA.
     */
    private String resolveChannexBookingId(Long reservationId, Long orgId) {
        Reservation reservation = reservationRepository.findById(reservationId)
            .orElseThrow(() -> new IllegalStateException("Reservation introuvable : " + reservationId));
        // findById contourne le filtre Hibernate : validation d'org explicite (audit n°3)
        if (!orgId.equals(reservation.getOrganizationId())) {
            throw new org.springframework.security.access.AccessDeniedException(
                "Reservation " + reservationId + " hors de l'organisation " + orgId);
        }
        String externalUid = Optional.ofNullable(reservation.getExternalUid()).orElse("");
        if (!externalUid.startsWith(ChannexBookingService.EXTERNAL_UID_PREFIX)) {
            throw new IllegalStateException("Reservation " + reservationId
                + " n'est pas une resa Channex — reporting OTA inapplicable");
        }
        return externalUid.substring(ChannexBookingService.EXTERNAL_UID_PREFIX.length());
    }
}
