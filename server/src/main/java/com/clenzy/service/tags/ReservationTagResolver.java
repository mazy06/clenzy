package com.clenzy.service.tags;

import com.clenzy.model.Guest;
import com.clenzy.model.Intervention;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.clenzy.service.tags.TagFormatting.DATE_FORMAT;
import static com.clenzy.service.tags.TagFormatting.DATETIME_FORMAT;
import static com.clenzy.service.tags.TagFormatting.formatDateTime;
import static com.clenzy.service.tags.TagFormatting.formatMoney;
import static com.clenzy.service.tags.TagFormatting.safeStr;

/**
 * Tags d'une reservation : reservation.*, client.* (guest), property.*,
 * proprietaire.*, paiement.*, ligne.*, lignes (detail facture), technicien.*, intervention.*.
 */
@Component
public class ReservationTagResolver implements ReferenceTagResolver {

    private final ReservationRepository reservationRepository;
    private final EntityTagBuilders builders;

    public ReservationTagResolver(ReservationRepository reservationRepository,
                                  EntityTagBuilders builders) {
        this.reservationRepository = reservationRepository;
        this.builders = builders;
    }

    @Override
    public String referenceType() {
        return "reservation";
    }

    @Override
    public void resolve(Long reservationId, Map<String, Object> context) {
        if (reservationId == null) return;

        reservationRepository.findByIdFetchAll(reservationId).ifPresent(reservation -> {
            context.put("reservation", reservationTags(reservation));

            // Guest (voyageur) — fallback on guestName if no Guest entity
            if (reservation.getGuest() != null) {
                context.put("client", guestTags(reservation.getGuest(), reservation.getGuestName()));
            } else {
                Map<String, Object> guestFallback = new LinkedHashMap<>();
                guestFallback.put("nom", safeStr(reservation.getGuestName()));
                guestFallback.put("prenom", "");
                guestFallback.put("nom_complet", safeStr(reservation.getGuestName()));
                guestFallback.put("email", "");
                guestFallback.put("telephone", "");
                guestFallback.put("societe", "");
                guestFallback.put("code_postal", "");
                guestFallback.put("ville", "");
                context.put("client", guestFallback);
            }

            // Property
            if (reservation.getProperty() != null) {
                context.put("property", builders.propertyTags(reservation.getProperty()));

                // Proprietaire
                if (reservation.getProperty().getOwner() != null) {
                    context.put("proprietaire", builders.clientTags(reservation.getProperty().getOwner()));
                }
            }

            // Tags paiement
            context.put("paiement", paymentTags(reservation));

            // Ligne de facturation (detail du sejour) — singulier, conserve pour back-compat
            context.put("ligne", ligneTags(reservation));

            // Lignes de detail de la facture (toujours present) : boucle [#list lignes as ligne]
            context.put("lignes", buildReservationLignes(reservation));

            // Intervention liee — uniquement si une intervention reelle existe.
            // Sans intervention : ni "intervention" ni "technicien" dans le contexte,
            // donc has_intervention / has_technicien = false (les guards masquent ces sections).
            if (reservation.getIntervention() != null) {
                Intervention intervention = reservation.getIntervention();
                context.put("intervention", builders.interventionTags(intervention));

                if (intervention.getAssignedUser() != null) {
                    context.put("technicien", builders.clientTags(intervention.getAssignedUser()));
                }
            }
        });
    }

    private Map<String, Object> reservationTags(Reservation reservation) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("id", String.valueOf(reservation.getId()));
        tags.put("guest_name", safeStr(reservation.getGuestName()));
        tags.put("check_in", reservation.getCheckIn() != null ? reservation.getCheckIn().format(DATE_FORMAT) : "");
        tags.put("check_out", reservation.getCheckOut() != null ? reservation.getCheckOut().format(DATE_FORMAT) : "");
        tags.put("check_in_time", safeStr(reservation.getCheckInTime()));
        tags.put("check_out_time", safeStr(reservation.getCheckOutTime()));
        tags.put("statut", safeStr(reservation.getStatus()));
        tags.put("source", safeStr(reservation.getSource()));
        tags.put("code_confirmation", safeStr(reservation.getConfirmationCode()));
        tags.put("prix_total", formatMoney(reservation.getTotalPrice()));
        tags.put("devise", safeStr(reservation.getCurrency()));
        // Nombre de nuits
        long nights = 0;
        if (reservation.getCheckIn() != null && reservation.getCheckOut() != null) {
            nights = java.time.temporal.ChronoUnit.DAYS.between(reservation.getCheckIn(), reservation.getCheckOut());
        }
        tags.put("nuits", String.valueOf(nights));
        tags.put("nombre_voyageurs", reservation.getGuestCount() != null ? String.valueOf(reservation.getGuestCount()) : "1");
        tags.put("frais_menage", formatMoney(reservation.getCleaningFee()));
        tags.put("taxe_sejour", formatMoney(reservation.getTouristTaxAmount()));
        tags.put("revenu_chambre", formatMoney(reservation.getRoomRevenue()));
        tags.put("notes", safeStr(reservation.getNotes()));
        return tags;
    }

    private Map<String, Object> guestTags(Guest guest, String fallbackName) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("nom", safeStr(guest.getLastName()));
        tags.put("prenom", safeStr(guest.getFirstName()));
        String fullName = guest.getFullName();
        if (fullName == null || fullName.isBlank()) fullName = fallbackName;
        tags.put("nom_complet", safeStr(fullName));
        tags.put("email", safeStr(guest.getEmail()));
        tags.put("telephone", safeStr(guest.getPhone()));
        tags.put("langue", safeStr(guest.getLanguage()));
        tags.put("pays", safeStr(guest.getCountryCode()));
        // Champs absents du modele Guest mais requis par les templates FACTURE
        tags.put("societe", "");
        tags.put("code_postal", "");
        tags.put("ville", "");
        return tags;
    }

    private Map<String, Object> ligneTags(Reservation reservation) {
        Map<String, Object> tags = new LinkedHashMap<>();

        // Description : "Hebergement - [property] - du [check_in] au [check_out]"
        String propertyName = reservation.getProperty() != null
                ? safeStr(reservation.getProperty().getName()) : "";
        String checkIn = reservation.getCheckIn() != null
                ? reservation.getCheckIn().format(DATE_FORMAT) : "";
        String checkOut = reservation.getCheckOut() != null
                ? reservation.getCheckOut().format(DATE_FORMAT) : "";
        tags.put("description", "Hebergement - " + propertyName + " - du " + checkIn + " au " + checkOut);

        // Quantite = nombre de nuits
        long nights = 0;
        if (reservation.getCheckIn() != null && reservation.getCheckOut() != null) {
            nights = java.time.temporal.ChronoUnit.DAYS.between(
                    reservation.getCheckIn(), reservation.getCheckOut());
        }
        tags.put("quantite", String.valueOf(nights));

        // Prix unitaire = revenu chambre / nuits (ou totalPrice / nuits)
        BigDecimal unitPrice = BigDecimal.ZERO;
        if (nights > 0) {
            BigDecimal revenue = reservation.getRoomRevenue() != null
                    ? reservation.getRoomRevenue() : reservation.getTotalPrice();
            if (revenue != null) {
                unitPrice = revenue.divide(BigDecimal.valueOf(nights), 2, java.math.RoundingMode.HALF_UP);
            }
        }
        tags.put("prix_unitaire", formatMoney(unitPrice));

        // Total
        tags.put("total", formatMoney(reservation.getTotalPrice()));

        return tags;
    }

    /**
     * Construit la liste des lignes de facturation a partir d'une reservation.
     * Produit 1 a 3 lignes : hebergement, frais de menage, taxe de sejour.
     * Utilisee pour alimenter la liste top-level "lignes" (detail facture) du contexte FACTURE/RESERVATION.
     */
    private List<Map<String, Object>> buildReservationLignes(Reservation reservation) {
        List<Map<String, Object>> lignes = new ArrayList<>();

        // Nombre de nuits
        long nights = 0;
        if (reservation.getCheckIn() != null && reservation.getCheckOut() != null) {
            nights = java.time.temporal.ChronoUnit.DAYS.between(
                    reservation.getCheckIn(), reservation.getCheckOut());
        }

        // Ligne 1 : Hebergement
        Map<String, Object> hebergement = new LinkedHashMap<>();
        String propertyName = reservation.getProperty() != null
                ? safeStr(reservation.getProperty().getName()) : "";
        String checkIn = reservation.getCheckIn() != null
                ? reservation.getCheckIn().format(DATE_FORMAT) : "";
        String checkOut = reservation.getCheckOut() != null
                ? reservation.getCheckOut().format(DATE_FORMAT) : "";
        hebergement.put("description",
                "Hebergement - " + propertyName + " - du " + checkIn + " au " + checkOut);
        hebergement.put("quantite", String.valueOf(nights));
        BigDecimal roomRevenue = reservation.getRoomRevenue() != null
                ? reservation.getRoomRevenue() : reservation.getTotalPrice();
        BigDecimal unitPrice = BigDecimal.ZERO;
        if (nights > 0 && roomRevenue != null) {
            unitPrice = roomRevenue.divide(BigDecimal.valueOf(nights), 2,
                    java.math.RoundingMode.HALF_UP);
        }
        hebergement.put("prix_unitaire", formatMoney(unitPrice));
        hebergement.put("total", formatMoney(roomRevenue));
        lignes.add(hebergement);

        // Ligne 2 : Frais de menage (si applicable)
        if (reservation.getCleaningFee() != null
                && reservation.getCleaningFee().compareTo(BigDecimal.ZERO) > 0) {
            Map<String, Object> cleaning = new LinkedHashMap<>();
            cleaning.put("description", "Frais de menage");
            cleaning.put("quantite", "1");
            cleaning.put("prix_unitaire", formatMoney(reservation.getCleaningFee()));
            cleaning.put("total", formatMoney(reservation.getCleaningFee()));
            lignes.add(cleaning);
        }

        // Ligne 3 : Taxe de sejour (si applicable)
        if (reservation.getTouristTaxAmount() != null
                && reservation.getTouristTaxAmount().compareTo(BigDecimal.ZERO) > 0) {
            Map<String, Object> tax = new LinkedHashMap<>();
            tax.put("description", "Taxe de sejour");
            tax.put("quantite", String.valueOf(nights));
            BigDecimal taxUnit = BigDecimal.ZERO;
            if (nights > 0) {
                taxUnit = reservation.getTouristTaxAmount().divide(
                        BigDecimal.valueOf(nights), 2, java.math.RoundingMode.HALF_UP);
            }
            tax.put("prix_unitaire", formatMoney(taxUnit));
            tax.put("total", formatMoney(reservation.getTouristTaxAmount()));
            lignes.add(tax);
        }

        return lignes;
    }

    private Map<String, Object> paymentTags(Reservation reservation) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("montant", formatMoney(reservation.getTotalPrice()));
        tags.put("devise", safeStr(reservation.getCurrency()));
        tags.put("statut", reservation.getPaymentStatus() != null
                ? reservation.getPaymentStatus().name() : "PENDING");
        tags.put("date_paiement", formatDateTime(reservation.getPaidAt()));
        // Payment link sent tracking
        tags.put("lien_envoye_le", reservation.getPaymentLinkSentAt() != null
                ? reservation.getPaymentLinkSentAt().format(DATETIME_FORMAT) : "");
        tags.put("email_paiement", safeStr(reservation.getPaymentLinkEmail()));
        tags.put("reference_stripe", safeStr(reservation.getStripeSessionId()));
        return tags;
    }
}
