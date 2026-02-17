package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
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
            ServiceRequestRepository serviceRequestRepository
    ) {
        this.userRepository = userRepository;
        this.propertyRepository = propertyRepository;
        this.interventionRepository = interventionRepository;
        this.serviceRequestRepository = serviceRequestRepository;
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
            case "service_request" -> resolveFromServiceRequest(referenceId, context);
            case "property" -> resolveFromProperty(referenceId, context);
            case "user" -> resolveFromUser(referenceId, context);
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
            }

            // Tags paiement
            context.put("paiement", resolvePaymentTags(intervention));
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

    private void resolveFromUser(Long userId, Map<String, Object> context) {
        if (userId == null) return;

        userRepository.findById(userId).ifPresent(user ->
                context.put("client", resolveClientTags(user))
        );
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
        tags.put("notes", safeStr(intervention.getNotes()));
        tags.put("notes_technicien", safeStr(intervention.getTechnicianNotes()));
        tags.put("instructions", safeStr(intervention.getSpecialInstructions()));
        tags.put("progression", intervention.getProgressPercentage() != null
                ? intervention.getProgressPercentage() + "%" : "0%");
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
