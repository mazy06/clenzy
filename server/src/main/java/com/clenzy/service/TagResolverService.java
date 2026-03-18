package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ProviderExpenseRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Service de resolution des tags de templates de documents.
 * Resout les tags Freemarker (ex: ${client.nom}, ${intervention.date_fin})
 * en valeurs concretes a partir des entites metier.
 * <p>
 * Formatage :
 * - Dates : dd/MM/yyyy HH:mm ou dd/MM/yyyy
 * - Montants : #,##0.00 € (locale FR)
 */
@Service
public class TagResolverService {

    private static final Logger log = LoggerFactory.getLogger(TagResolverService.class);

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATETIME_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final NumberFormat MONEY_FORMAT;

    static {
        MONEY_FORMAT = NumberFormat.getCurrencyInstance(Locale.FRANCE);
        MONEY_FORMAT.setMinimumFractionDigits(2);
        MONEY_FORMAT.setMaximumFractionDigits(2);
    }

    private final UserRepository userRepository;
    private final PropertyRepository propertyRepository;
    private final InterventionRepository interventionRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final ReservationRepository reservationRepository;
    private final ProviderExpenseRepository providerExpenseRepository;

    @Value("${clenzy.company.name:Clenzy}")
    private String companyName;

    @Value("${clenzy.company.address:}")
    private String companyAddress;

    @Value("${clenzy.company.siret:}")
    private String companySiret;

    @Value("${clenzy.company.email:info@clenzy.fr}")
    private String companyEmail;

    @Value("${clenzy.company.phone:}")
    private String companyPhone;

    public TagResolverService(
            UserRepository userRepository,
            PropertyRepository propertyRepository,
            InterventionRepository interventionRepository,
            ServiceRequestRepository serviceRequestRepository,
            ReservationRepository reservationRepository,
            ProviderExpenseRepository providerExpenseRepository
    ) {
        this.userRepository = userRepository;
        this.propertyRepository = propertyRepository;
        this.interventionRepository = interventionRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.reservationRepository = reservationRepository;
        this.providerExpenseRepository = providerExpenseRepository;
    }

    /**
     * Resout tous les tags pour un type de document et une reference donnee.
     *
     * @param documentType Type de document a generer
     * @param referenceId  ID de l'entite de reference (intervention, service request, etc.)
     * @param referenceType Type de reference ("intervention", "service_request", "property", "user")
     * @return Map hierarchique des tags resolus (ex: {"client": {"nom": "Dupont", ...}, "property": {...}})
     */
    public Map<String, Object> resolveTagsForDocument(DocumentType documentType, Long referenceId, String referenceType) {
        log.debug("Resolving tags for {} (ref: {} #{})", documentType, referenceType, referenceId);

        Map<String, Object> context = new LinkedHashMap<>();

        // Tags systeme (toujours presents)
        context.put("system", resolveSystemTags());
        context.put("entreprise", resolveEntrepriseTags());

        // Resoudre selon le type de reference
        switch (referenceType != null ? referenceType.toLowerCase() : "") {
            case "intervention" -> resolveFromIntervention(referenceId, context);
            case "reservation" -> resolveFromReservation(referenceId, context);
            case "service_request" -> resolveFromServiceRequest(referenceId, context);
            case "property" -> resolveFromProperty(referenceId, context);
            case "user" -> resolveFromUser(referenceId, context);
            case "provider_expense" -> resolveFromProviderExpense(referenceId, context);
            default -> log.warn("Unknown reference type: {}", referenceType);
        }

        log.debug("Resolved {} top-level tag groups", context.size());
        return context;
    }

    // ─── Resolution par entite ──────────────────────────────────────────────

    private void resolveFromIntervention(Long interventionId, Map<String, Object> context) {
        if (interventionId == null) return;

        interventionRepository.findById(interventionId).ifPresent(intervention -> {
            context.put("intervention", resolveInterventionTags(intervention));

            // Resoudre aussi property, client (requestor), assigned
            if (intervention.getProperty() != null) {
                context.put("property", resolvePropertyTags(intervention.getProperty()));

                if (intervention.getProperty().getOwner() != null) {
                    context.put("client", resolveClientTags(intervention.getProperty().getOwner()));
                }
            }

            if (intervention.getRequestor() != null) {
                context.putIfAbsent("client", resolveClientTags(intervention.getRequestor()));
            }

            if (intervention.getAssignedUser() != null) {
                context.put("technicien", resolveClientTags(intervention.getAssignedUser()));
            } else {
                context.put("technicien", emptyClientTags());
            }

            // Tags paiement
            context.put("paiement", resolvePaymentTags(intervention));

            // Tags ligne de facturation (top-level pour les templates FACTURE)
            context.put("ligne", resolveInterventionLigneTags(intervention));

            // Numero de facture (tag nf.*)
            context.put("nf", resolveInterventionNfTags(intervention));
        });
    }

    private void resolveFromServiceRequest(Long serviceRequestId, Map<String, Object> context) {
        if (serviceRequestId == null) return;

        serviceRequestRepository.findById(serviceRequestId).ifPresent(sr -> {
            context.put("demande", resolveServiceRequestTags(sr));

            if (sr.getProperty() != null) {
                context.put("property", resolvePropertyTags(sr.getProperty()));
            }

            if (sr.getUser() != null) {
                context.put("client", resolveClientTags(sr.getUser()));
            }
        });
    }

    private void resolveFromProperty(Long propertyId, Map<String, Object> context) {
        if (propertyId == null) return;

        propertyRepository.findById(propertyId).ifPresent(property -> {
            context.put("property", resolvePropertyTags(property));

            if (property.getOwner() != null) {
                context.put("client", resolveClientTags(property.getOwner()));
            }
        });
    }

    private void resolveFromReservation(Long reservationId, Map<String, Object> context) {
        if (reservationId == null) return;

        reservationRepository.findByIdFetchAll(reservationId).ifPresent(reservation -> {
            context.put("reservation", resolveReservationTags(reservation));

            // Guest (voyageur) — fallback on guestName if no Guest entity
            if (reservation.getGuest() != null) {
                context.put("client", resolveGuestTags(reservation.getGuest(), reservation.getGuestName()));
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
                context.put("property", resolvePropertyTags(reservation.getProperty()));

                // Proprietaire
                if (reservation.getProperty().getOwner() != null) {
                    context.put("proprietaire", resolveClientTags(reservation.getProperty().getOwner()));
                }
            }

            // Tags paiement
            context.put("paiement", resolveReservationPaymentTags(reservation));

            // Ligne de facturation (detail du sejour)
            context.put("ligne", resolveReservationLigneTags(reservation));

            // Intervention liee
            if (reservation.getIntervention() != null) {
                Intervention intervention = reservation.getIntervention();
                context.put("intervention", resolveInterventionTags(intervention));

                if (intervention.getAssignedUser() != null) {
                    context.put("technicien", resolveClientTags(intervention.getAssignedUser()));
                }
            }

            // Fallback technicien si absent (pas d'intervention ou pas d'assignedUser)
            context.putIfAbsent("technicien", emptyClientTags());

            // Surcharger intervention.lignes avec les lignes de facturation du sejour
            @SuppressWarnings("unchecked")
            Map<String, Object> interventionMap = (Map<String, Object>) context.get("intervention");
            if (interventionMap == null) {
                interventionMap = new LinkedHashMap<>();
                context.put("intervention", interventionMap);
            }
            interventionMap.put("lignes", buildReservationLignes(reservation));
        });
    }

    private void resolveFromUser(Long userId, Map<String, Object> context) {
        if (userId == null) return;

        userRepository.findById(userId).ifPresent(user ->
                context.put("client", resolveClientTags(user))
        );
    }

    private void resolveFromProviderExpense(Long expenseId, Map<String, Object> context) {
        if (expenseId == null) return;

        providerExpenseRepository.findById(expenseId).ifPresent(expense -> {
            context.put("depense", resolveExpenseTags(expense));

            // Prestataire
            if (expense.getProvider() != null) {
                context.put("prestataire", resolveClientTags(expense.getProvider()));
            }

            // Logement
            if (expense.getProperty() != null) {
                context.put("property", resolvePropertyTags(expense.getProperty()));

                // Proprietaire du logement
                if (expense.getProperty().getOwner() != null) {
                    context.put("client", resolveClientTags(expense.getProperty().getOwner()));
                }
            }
        });
    }

    private Map<String, Object> resolveExpenseTags(ProviderExpense expense) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("id", String.valueOf(expense.getId()));
        tags.put("description", safeStr(expense.getDescription()));
        tags.put("montant_ht", formatMoney(expense.getAmountHt()));
        tags.put("taux_tva", expense.getTaxRate() != null
                ? expense.getTaxRate().multiply(java.math.BigDecimal.valueOf(100)).stripTrailingZeros().toPlainString() + " %"
                : "0 %");
        tags.put("montant_tva", formatMoney(expense.getTaxAmount()));
        tags.put("montant_ttc", formatMoney(expense.getAmountTtc()));
        tags.put("devise", safeStr(expense.getCurrency()));
        tags.put("categorie", expense.getCategory() != null ? expense.getCategory().getLabel() : "");
        tags.put("date", expense.getExpenseDate() != null
                ? expense.getExpenseDate().format(DATE_FORMAT) : "");
        tags.put("statut", expense.getStatus() != null ? expense.getStatus().name() : "");
        tags.put("reference_facture", safeStr(expense.getInvoiceReference()));
        tags.put("notes", safeStr(expense.getNotes()));
        tags.put("reference_paiement", safeStr(expense.getPaymentReference()));
        return tags;
    }

    // ─── Builders de tags par categorie ─────────────────────────────────────

    private Map<String, Object> resolveSystemTags() {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("date", LocalDateTime.now().format(DATE_FORMAT));
        tags.put("datetime", LocalDateTime.now().format(DATETIME_FORMAT));
        tags.put("annee", String.valueOf(LocalDateTime.now().getYear()));
        tags.put("numero_auto", UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        return tags;
    }

    private Map<String, Object> resolveEntrepriseTags() {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("nom", companyName);
        tags.put("adresse", companyAddress);
        tags.put("siret", companySiret);
        tags.put("email", companyEmail);
        tags.put("telephone", companyPhone);
        return tags;
    }

    private Map<String, Object> resolveClientTags(User user) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("nom", safeStr(user.getLastName()));
        tags.put("prenom", safeStr(user.getFirstName()));
        tags.put("nom_complet", safeStr(user.getFullName()));
        tags.put("email", safeStr(user.getEmail()));
        tags.put("telephone", safeStr(user.getPhoneNumber()));
        tags.put("societe", safeStr(user.getCompanyName()));
        tags.put("ville", safeStr(user.getCity()));
        tags.put("code_postal", safeStr(user.getPostalCode()));
        tags.put("role", user.getRole() != null ? user.getRole().name() : "");
        return tags;
    }

    /**
     * Tags client/technicien vides — fallback quand l'entite n'existe pas.
     */
    private Map<String, Object> emptyClientTags() {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("nom", "");
        tags.put("prenom", "");
        tags.put("nom_complet", "");
        tags.put("email", "");
        tags.put("telephone", "");
        tags.put("societe", "");
        tags.put("ville", "");
        tags.put("code_postal", "");
        tags.put("role", "");
        return tags;
    }

    private Map<String, Object> resolvePropertyTags(Property property) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("nom", safeStr(property.getName()));
        tags.put("adresse", safeStr(property.getAddress()));
        tags.put("ville", safeStr(property.getCity()));
        tags.put("code_postal", safeStr(property.getPostalCode()));
        tags.put("pays", safeStr(property.getCountry()));
        tags.put("type", property.getType() != null ? property.getType().name() : "");
        tags.put("surface", property.getSquareMeters() != null ? property.getSquareMeters() + " m²" : "");
        tags.put("chambres", property.getBedroomCount() != null ? String.valueOf(property.getBedroomCount()) : "");
        tags.put("salles_bain", property.getBathroomCount() != null ? String.valueOf(property.getBathroomCount()) : "");
        tags.put("capacite", property.getMaxGuests() != null ? String.valueOf(property.getMaxGuests()) : "");
        tags.put("prix_nuit", formatMoney(property.getNightlyPrice()));
        tags.put("check_in", safeStr(property.getDefaultCheckInTime()));
        tags.put("check_out", safeStr(property.getDefaultCheckOutTime()));
        tags.put("instructions_acces", safeStr(property.getAccessInstructions()));
        return tags;
    }

    private Map<String, Object> resolveInterventionTags(Intervention intervention) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("id", String.valueOf(intervention.getId()));
        tags.put("titre", safeStr(intervention.getTitle()));
        tags.put("description", safeStr(intervention.getDescription()));
        tags.put("type", safeStr(intervention.getType()));
        tags.put("statut", intervention.getStatus() != null ? intervention.getStatus().name() : "");
        tags.put("priorite", safeStr(intervention.getPriority()));
        tags.put("date_planifiee", formatDate(intervention.getScheduledDate()));
        tags.put("date_debut", formatDateTime(intervention.getStartTime()));
        tags.put("date_fin", formatDateTime(intervention.getEndTime()));
        tags.put("date_completion", formatDateTime(intervention.getCompletedAt()));
        tags.put("duree_estimee", intervention.getEstimatedDurationHours() != null
                ? intervention.getEstimatedDurationHours() + "h" : "");
        tags.put("duree_reelle", intervention.getActualDurationMinutes() != null
                ? intervention.getActualDurationMinutes() + " min" : "");
        tags.put("cout_estime", formatMoney(intervention.getEstimatedCost()));
        tags.put("cout_reel", formatMoney(intervention.getActualCost()));
        tags.put("notes", parseStepNotes(intervention.getNotes()));
        tags.put("notes_technicien", safeStr(intervention.getTechnicianNotes()));
        tags.put("instructions", safeStr(intervention.getSpecialInstructions()));
        tags.put("progression", intervention.getProgressPercentage() != null
                ? intervention.getProgressPercentage() + "%" : "0%");
        // Liste par defaut : une seule ligne avec la description de l'intervention
        Map<String, Object> defaultLine = new LinkedHashMap<>();
        defaultLine.put("description", safeStr(intervention.getDescription()));
        defaultLine.put("quantite", "1");
        defaultLine.put("prix_unitaire", formatMoney(intervention.getActualCost() != null
                ? intervention.getActualCost() : intervention.getEstimatedCost()));
        defaultLine.put("total", formatMoney(intervention.getActualCost() != null
                ? intervention.getActualCost() : intervention.getEstimatedCost()));
        tags.put("lignes", List.of(defaultLine));
        return tags;
    }

    private Map<String, Object> resolveServiceRequestTags(ServiceRequest sr) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("id", String.valueOf(sr.getId()));
        tags.put("titre", safeStr(sr.getTitle()));
        tags.put("description", safeStr(sr.getDescription()));
        tags.put("type_service", sr.getServiceType() != null ? sr.getServiceType().name() : "");
        tags.put("priorite", sr.getPriority() != null ? sr.getPriority().name() : "");
        tags.put("statut", sr.getStatus() != null ? sr.getStatus().name() : "");
        tags.put("date_souhaitee", formatDate(sr.getDesiredDate()));
        tags.put("creneau", safeStr(sr.getPreferredTimeSlot()));
        tags.put("cout_estime", formatMoney(sr.getEstimatedCost()));
        tags.put("cout_reel", formatMoney(sr.getActualCost()));
        tags.put("instructions", safeStr(sr.getSpecialInstructions()));
        tags.put("date_creation", formatDateTime(sr.getCreatedAt()));
        return tags;
    }

    private Map<String, Object> resolveReservationTags(Reservation reservation) {
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

    private Map<String, Object> resolveGuestTags(Guest guest, String fallbackName) {
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

    private Map<String, Object> resolveReservationLigneTags(Reservation reservation) {
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
     * Utilisee pour alimenter intervention.lignes dans le contexte FACTURE/RESERVATION.
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

    private Map<String, Object> resolveReservationPaymentTags(Reservation reservation) {
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

    /**
     * Tags ligne de facturation pour une intervention (top-level ${ligne.*}).
     * Utilise le cout reel ou estime comme montant.
     */
    private Map<String, Object> resolveInterventionLigneTags(Intervention intervention) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("description", safeStr(intervention.getDescription()));
        tags.put("quantite", "1");
        BigDecimal cost = intervention.getActualCost() != null
                ? intervention.getActualCost() : intervention.getEstimatedCost();
        tags.put("prix_unitaire", formatMoney(cost));
        tags.put("total", formatMoney(cost));
        return tags;
    }

    /**
     * Tags numero de facture pour une intervention (top-level ${nf.*}).
     * Le vrai numero est attribue par DocumentNumberingService, ici on fournit des fallbacks.
     */
    private Map<String, Object> resolveInterventionNfTags(Intervention intervention) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("numero", "");
        tags.put("date", LocalDateTime.now().format(DATE_FORMAT));
        return tags;
    }

    private Map<String, Object> resolvePaymentTags(Intervention intervention) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("statut", intervention.getPaymentStatus() != null ? intervention.getPaymentStatus().name() : "PENDING");
        tags.put("montant", formatMoney(intervention.getActualCost() != null
                ? intervention.getActualCost() : intervention.getEstimatedCost()));
        tags.put("date_paiement", formatDateTime(intervention.getPaidAt()));
        tags.put("reference_stripe", safeStr(intervention.getStripePaymentIntentId()));
        return tags;
    }

    // ─── Utilitaires de formatage ───────────────────────────────────────────

    private String safeStr(String value) {
        return value != null ? value : "";
    }

    /**
     * Parse le JSON des notes d'etapes et retourne un texte lisible.
     * Format attendu : {"rooms":{"general":"texte"}, "inspection":"texte", "after_photos":"texte"}
     * Retourne une concatenation des valeurs textuelles, sans les cles JSON.
     */
    private String parseStepNotes(String notesJson) {
        if (notesJson == null || notesJson.isBlank()) return "";
        // Not JSON — return as-is (plain text notes)
        if (!notesJson.trim().startsWith("{")) return notesJson;
        try {
            final ObjectMapper mapper = new ObjectMapper();
            final JsonNode root = mapper.readTree(notesJson);
            final List<String> parts = new ArrayList<>();
            root.fields().forEachRemaining(entry -> {
                final JsonNode value = entry.getValue();
                if (value.isTextual() && !value.asText().isBlank()) {
                    parts.add(value.asText().trim());
                } else if (value.isObject()) {
                    // e.g. "rooms": {"general": "texte", "0": "note piece 1"}
                    value.fields().forEachRemaining(sub -> {
                        if (sub.getValue().isTextual() && !sub.getValue().asText().isBlank()) {
                            parts.add(sub.getValue().asText().trim());
                        }
                    });
                }
            });
            return String.join("\n", parts);
        } catch (Exception e) {
            log.debug("Could not parse step notes JSON, using raw value: {}", e.getMessage());
            return notesJson;
        }
    }

    private String formatDate(LocalDateTime dateTime) {
        if (dateTime == null) return "";
        return dateTime.format(DATE_FORMAT);
    }

    private String formatDateTime(LocalDateTime dateTime) {
        if (dateTime == null) return "";
        return dateTime.format(DATETIME_FORMAT);
    }

    private String formatMoney(BigDecimal amount) {
        if (amount == null) return "0,00 €";
        return MONEY_FORMAT.format(amount);
    }
}
