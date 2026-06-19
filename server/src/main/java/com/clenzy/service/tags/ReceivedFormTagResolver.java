package com.clenzy.service.tags;

import com.clenzy.repository.ReceivedFormRepository;
import com.clenzy.service.PricingConfigService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static com.clenzy.service.tags.TagFormatting.DATE_FORMAT;
import static com.clenzy.service.tags.TagFormatting.DATETIME_FORMAT;
import static com.clenzy.service.tags.TagFormatting.safeStr;

/**
 * Tags d'un ReceivedForm (formulaire de contact / devis / maintenance / support).
 * Construit toutes les namespaces exigees par le template DEVIS standard :
 *   - client.*    (nom, prenom, nom_complet, email, telephone, societe, ville, code_postal, role)
 *   - property.*  (nom, adresse, ville, code_postal, type, surface, ...) synthetisees depuis le payload
 *   - demande.*   (titre, type_service, description, priorite, date_souhaitee, creneau,
 *                  cout_estime, cout_reel, instructions, sujet, ...)
 *   - ligne.*     (description, prix_unitaire, quantite, total) — placeholder devis
 *   - devis.*     (pricing calcule) et intervention.lignes (tableau devis)
 */
@Component
public class ReceivedFormTagResolver implements ReferenceTagResolver {

    private static final Logger log = LoggerFactory.getLogger(ReceivedFormTagResolver.class);

    private static final NumberFormat MONEY_FORMAT;

    static {
        MONEY_FORMAT = NumberFormat.getCurrencyInstance(Locale.FRANCE);
        MONEY_FORMAT.setMinimumFractionDigits(2);
        MONEY_FORMAT.setMaximumFractionDigits(2);
    }

    private final ReceivedFormRepository receivedFormRepository;
    private final PricingConfigService pricingConfigService;
    private final ObjectMapper objectMapper;

    public ReceivedFormTagResolver(ReceivedFormRepository receivedFormRepository,
                                   PricingConfigService pricingConfigService,
                                   ObjectMapper objectMapper) {
        this.receivedFormRepository = receivedFormRepository;
        this.pricingConfigService = pricingConfigService;
        this.objectMapper = objectMapper;
    }

    @Override
    public String referenceType() {
        return "received_form";
    }

    @Override
    public void resolve(Long formId, Map<String, Object> context) {
        if (formId == null) return;

        receivedFormRepository.findById(formId).ifPresent(form -> {
            JsonNode payload = parsePayloadSafely(form.getPayload());

            // ── Client ────────────────────────────────────────────────
            Map<String, Object> client = new LinkedHashMap<>();
            String fullName = safeStr(form.getFullName());
            String[] parts = fullName.trim().split("\\s+");
            String prenom = parts.length >= 2 ? parts[0] : "";
            String nom = parts.length >= 2
                    ? String.join(" ", java.util.Arrays.copyOfRange(parts, 1, parts.length))
                    : fullName;
            client.put("nom", nom);
            client.put("prenom", prenom);
            client.put("nom_complet", fullName);
            client.put("email", safeStr(form.getEmail()));
            client.put("telephone", safeStr(form.getPhone()));
            client.put("societe", "");
            client.put("ville", safeStr(form.getCity()));
            client.put("code_postal", safeStr(form.getPostalCode()));
            client.put("role", "PROSPECT");
            context.put("client", client);

            // ── Property (synthetisee depuis le payload) ──────────────
            Map<String, Object> property = new LinkedHashMap<>();
            String propertyType = payload != null ? labelize(jsonText(payload, "propertyType")) : "";
            String surface = payload != null ? jsonText(payload, "surface") : "";
            // Nom du logement : on n'a pas de nom dans le formulaire → on synthetise
            String synthName = !propertyType.isEmpty()
                    ? propertyType + (form.getCity() != null ? " — " + form.getCity() : "")
                    : (form.getCity() != null ? "Logement — " + form.getCity() : "Logement");
            property.put("nom", synthName);
            property.put("adresse", "");  // pas dans le formulaire
            property.put("ville", safeStr(form.getCity()));
            property.put("code_postal", safeStr(form.getPostalCode()));
            property.put("pays", "France");
            property.put("type", propertyType);
            property.put("surface", surface.isEmpty() ? "" : surface + " m²");
            property.put("chambres", "");
            property.put("salles_bain", "");
            property.put("capacite", payload != null ? labelize(jsonText(payload, "guestCapacity")) : "");
            property.put("prix_nuit", "");
            property.put("check_in", "");
            property.put("check_out", "");
            property.put("instructions_acces", "");
            context.put("property", property);

            // ── Devis pricing (DEVIS uniquement) ──────────────────────
            PricingConfigService.DevisQuoteBreakdown quote = null;
            if ("DEVIS".equalsIgnoreCase(form.getFormType()) && payload != null) {
                try {
                    String pType = jsonText(payload, "propertyType");
                    String pCount = jsonText(payload, "propertyCount");
                    String pGuest = jsonText(payload, "guestCapacity");
                    int pSurface = safeParseInt(jsonText(payload, "surface"));
                    List<String> pServices = readJsonArrayAsList(payload, "services");
                    String pCalendar = jsonText(payload, "calendarSync");
                    String pFreq = jsonText(payload, "bookingFrequency");
                    quote = pricingConfigService.computeDevisQuote(
                            pType, pCount, pGuest, pSurface, pServices, pCalendar, pFreq);
                    context.put("devis", buildDevisPricingTags(quote));
                } catch (Exception e) {
                    log.warn("Failed to compute devis pricing for form #{}: {}", form.getId(), e.getMessage());
                    context.put("devis", buildEmptyDevisPricingTags());
                }
            } else {
                context.put("devis", buildEmptyDevisPricingTags());
            }

            // ── Demande (riche) ───────────────────────────────────────
            Map<String, Object> demande = new LinkedHashMap<>();
            String typeService;
            String titre;
            String description;
            String priorite;
            if ("DEVIS".equalsIgnoreCase(form.getFormType())) {
                String forfaitLabel = quote != null ? quote.forfaitLabel() : "Essentiel";
                typeService = "Forfait " + forfaitLabel + " — Gestion locative Clenzy";
                titre = safeStr(form.getSubject() != null ? form.getSubject() :
                        "Devis " + propertyType + " — " + safeStr(form.getCity()));
                description = buildDevisDescription(payload, quote);
                priorite = "Normale";
            } else if ("MAINTENANCE".equalsIgnoreCase(form.getFormType())) {
                typeService = "Travaux / maintenance";
                titre = safeStr(form.getSubject() != null ? form.getSubject() : "Travaux — " + safeStr(form.getCity()));
                description = buildMaintenanceDescription(payload);
                priorite = payload != null ? labelize(jsonText(payload, "urgency")) : "Normale";
                if (priorite.isEmpty()) priorite = "Normale";
            } else {
                typeService = "Support";
                titre = safeStr(form.getSubject() != null ? form.getSubject() :
                        (payload != null ? jsonText(payload, "subject") : ""));
                description = payload != null ? jsonText(payload, "message") : "";
                priorite = "Normale";
            }
            demande.put("id", String.valueOf(form.getId()));
            demande.put("titre", titre);
            demande.put("type_service", typeService);
            demande.put("description", description);
            demande.put("priorite", priorite);
            demande.put("date_souhaitee", form.getCreatedAt() != null ? form.getCreatedAt().format(DATE_FORMAT) : "");
            demande.put("creneau", "À convenir");
            demande.put("cout_estime", "Sur demande");
            demande.put("cout_reel", "Sur demande");
            demande.put("instructions", description);
            demande.put("sujet", safeStr(form.getSubject()));
            demande.put("statut", safeStr(form.getStatus()));
            demande.put("type", safeStr(form.getFormType()));
            demande.put("ip", safeStr(form.getIpAddress()));
            demande.put("date", form.getCreatedAt() != null ? form.getCreatedAt().format(DATETIME_FORMAT) : "");
            context.put("demande", demande);

            // ── Ligne (premiere ligne du tableau devis, retro-compat) ──
            Map<String, Object> ligne = new LinkedHashMap<>();
            if (quote != null) {
                ligne.put("description", "Prestation de ménage — Forfait " + quote.forfaitLabel());
                ligne.put("quantite", String.valueOf(quote.interventionsPerMonth()) + " /mois");
                ligne.put("prix_unitaire", formatEur(quote.interventionPrice()) + "/intervention");
                ligne.put("total", formatEur(quote.monthlyCleaningCost()) + "/mois");
            } else {
                ligne.put("description", typeService);
                ligne.put("quantite", "1");
                ligne.put("prix_unitaire", "Sur demande");
                ligne.put("total", "Sur demande");
            }
            context.put("ligne", ligne);

            // ── Intervention : lignes pour iteration <#list intervention.lignes as l> ──
            Map<String, Object> intervention = new LinkedHashMap<>();
            intervention.put("lignes", buildDevisLineItems(quote, typeService));
            // champs frequemment utilises sur les templates intervention/facture
            intervention.put("titre", titre);
            intervention.put("description", description);
            intervention.put("date_debut", form.getCreatedAt() != null ? form.getCreatedAt().format(DATE_FORMAT) : "");
            intervention.put("date_fin", "");
            intervention.put("cout_reel", quote != null ? formatEur(quote.monthlyTotalWithPms()) : "Sur demande");
            context.put("intervention", intervention);
        });
    }

    /**
     * Construit la liste des lignes pour le tableau de devis.
     * Multiplie le ménage par les interventions mensuelles, ajoute l'abonnement
     * mensuel et la promo annuelle pour donner au template toutes les options.
     */
    private List<Map<String, Object>> buildDevisLineItems(PricingConfigService.DevisQuoteBreakdown q, String fallbackDescription) {
        List<Map<String, Object>> lignes = new ArrayList<>();
        if (q == null) {
            lignes.add(makeLine(fallbackDescription, "1", "Sur demande", "Sur demande"));
            return lignes;
        }

        // Ligne 1 : Ménage à l'intervention — la seule prestation récurrente de
        // conciergerie (facturée à l'usage, pas d'abonnement de gestion).
        lignes.add(makeLine(
                "Prestation de ménage (forfait " + q.forfaitLabel() + ")",
                String.valueOf(q.interventionsPerMonth()) + " /mois",
                formatEur(q.interventionPrice()),
                formatEur(q.monthlyCleaningCost()) + "/mois"
        ));

        // Ligne 2 : Abonnement PMS — OPTION (logiciel de gestion). Tarif issu des
        // parametres "Abonnement PMS" (base, ou avec synchro auto si demandee).
        String pmsDescription = q.pmsSyncIncluded()
                ? "Option — Abonnement PMS (logiciel : calendrier, réservations, facturation + synchro auto)"
                : "Option — Abonnement PMS (logiciel : calendrier, réservations, facturation)";
        lignes.add(makeLine(
                pmsDescription,
                "1",
                formatEur(q.pmsMonthlyPrice()) + "/mois",
                formatEur(q.pmsMonthlyPrice()) + "/mois"
        ));

        // Ligne 3 : Option paiement annuel de l'abonnement PMS (le menage, facture
        // a l'intervention, n'est pas remise — seul le logiciel se prepaie a l'annee).
        lignes.add(makeLine(
                "Option paiement annuel — Abonnement PMS ("
                        + q.annualDiscountPercent() + " % de remise, "
                        + formatEur(q.pmsAnnualSavings()) + " économisés)",
                "1",
                formatEur(q.pmsAnnualWithDiscount()) + "/an",
                formatEur(q.pmsAnnualWithDiscount()) + "/an"
        ));

        // Lignes 4-5 : Choix de formule — cases a cocher sur le document.
        // Le prospect coche soit la gestion menage seule, soit avec l'abonnement PMS.
        lignes.add(makeLine(
                "☐ Formule 1 — Gestion ménage seule (conciergerie)",
                "—",
                "—",
                formatEur(q.monthlyTotalCleaningOnly()) + "/mois"
        ));
        lignes.add(makeLine(
                "☐ Formule 2 — Gestion ménage + Abonnement PMS (+"
                        + formatEur(q.pmsMonthlyPrice()) + "/mois)",
                "—",
                "—",
                formatEur(q.monthlyTotalWithPms()) + "/mois"
        ));

        return lignes;
    }

    private Map<String, Object> makeLine(String description, String quantite, String prixUnitaire, String total) {
        Map<String, Object> l = new LinkedHashMap<>();
        l.put("description", description);
        l.put("quantite", quantite);
        l.put("prix_unitaire", prixUnitaire);
        l.put("total", total);
        return l;
    }

    /** Convertit un montant entier euros en chaine "X €" formatee FR. */
    private String formatEur(int amount) {
        return MONEY_FORMAT.format(amount).replace(",00", "").replace(" €", " €");
    }

    /** Tags devis vides (formulaire non-DEVIS ou erreur de calcul). */
    private Map<String, Object> buildEmptyDevisPricingTags() {
        Map<String, Object> tags = new LinkedHashMap<>();
        Map<String, Object> forfait = new LinkedHashMap<>();
        forfait.put("id", "");
        forfait.put("nom", "");
        tags.put("forfait", forfait);

        Map<String, Object> menage = new LinkedHashMap<>();
        menage.put("prix_intervention", "");
        menage.put("interventions_par_mois", "");
        menage.put("estimation_mensuelle", "");
        menage.put("estimation_annuelle", "");
        tags.put("menage", menage);

        Map<String, Object> abonnement = new LinkedHashMap<>();
        abonnement.put("mensuel", "");
        abonnement.put("annuel_sans_remise", "");
        abonnement.put("annuel_avec_remise", "");
        abonnement.put("economie_annuelle", "");
        abonnement.put("remise_pct", "");
        tags.put("abonnement", abonnement);

        Map<String, Object> pms = new LinkedHashMap<>();
        pms.put("mensuel", "");
        pms.put("annuel_avec_remise", "");
        pms.put("synchro_incluse", "");
        tags.put("pms", pms);

        Map<String, Object> total = new LinkedHashMap<>();
        total.put("mensuel", "");
        total.put("mensuel_sans_pms", "");
        total.put("mensuel_avec_pms", "");
        total.put("annuel_avec_remise", "");
        tags.put("total", total);

        return tags;
    }

    /** Tags devis complets a partir du calcul. */
    private Map<String, Object> buildDevisPricingTags(PricingConfigService.DevisQuoteBreakdown q) {
        Map<String, Object> tags = new LinkedHashMap<>();

        // devis.forfait.*
        Map<String, Object> forfait = new LinkedHashMap<>();
        forfait.put("id", q.forfaitId());
        forfait.put("nom", q.forfaitLabel());
        tags.put("forfait", forfait);

        // devis.menage.*
        Map<String, Object> menage = new LinkedHashMap<>();
        menage.put("prix_intervention", formatEur(q.interventionPrice()));
        menage.put("interventions_par_mois", String.valueOf(q.interventionsPerMonth()));
        menage.put("estimation_mensuelle", formatEur(q.monthlyCleaningCost()));
        menage.put("estimation_annuelle", formatEur(q.annualCleaningCost()));
        tags.put("menage", menage);

        // devis.abonnement.* — DESORMAIS = l'abonnement PMS (logiciel), seul element
        // remise en annuel. (Avant : le forfait de gestion, supprime.) Les libelles
        // "Dont abonnement" du template designent donc bien le PMS.
        Map<String, Object> abonnement = new LinkedHashMap<>();
        abonnement.put("mensuel", formatEur(q.pmsMonthlyPrice()));
        abonnement.put("annuel_sans_remise", formatEur(q.pmsAnnualWithoutDiscount()));
        abonnement.put("annuel_avec_remise", formatEur(q.pmsAnnualWithDiscount()));
        abonnement.put("economie_annuelle", formatEur(q.pmsAnnualSavings()));
        abonnement.put("remise_pct", q.annualDiscountPercent() + " %");
        tags.put("abonnement", abonnement);

        // devis.pms.* (alias explicite de l'abonnement PMS)
        Map<String, Object> pms = new LinkedHashMap<>();
        pms.put("mensuel", formatEur(q.pmsMonthlyPrice()));
        pms.put("annuel_avec_remise", formatEur(q.pmsAnnualWithDiscount()));
        pms.put("synchro_incluse", q.pmsSyncIncluded() ? "oui" : "non");
        tags.put("pms", pms);

        // devis.total.* — le pack recommande = menage + PMS (cf. boite « DEUX FORMULES »).
        Map<String, Object> total = new LinkedHashMap<>();
        total.put("mensuel", formatEur(q.monthlyTotalWithPms()));
        total.put("mensuel_sans_pms", formatEur(q.monthlyTotalCleaningOnly()));
        total.put("mensuel_avec_pms", formatEur(q.monthlyTotalWithPms()));
        total.put("annuel_avec_remise", formatEur(q.annualTotalWithPms()));
        tags.put("total", total);

        return tags;
    }

    private int safeParseInt(String s) {
        if (s == null || s.isBlank()) return 0;
        try { return Integer.parseInt(s.trim()); } catch (NumberFormatException e) { return 0; }
    }

    private List<String> readJsonArrayAsList(JsonNode node, String field) {
        if (node == null || !node.hasNonNull(field)) return Collections.emptyList();
        JsonNode arr = node.get(field);
        if (!arr.isArray()) return Collections.emptyList();
        List<String> out = new ArrayList<>();
        arr.forEach(item -> out.add(item.isTextual() ? item.asText() : item.toString()));
        return out;
    }

    /** Resume textuel des champs DEVIS + pricing calcule pour la description du document. */
    private String buildDevisDescription(JsonNode payload, PricingConfigService.DevisQuoteBreakdown quote) {
        StringBuilder sb = new StringBuilder();
        if (payload != null) {
            String type = labelize(jsonText(payload, "propertyType"));
            String surface = jsonText(payload, "surface");
            String capacite = labelize(jsonText(payload, "guestCapacity"));
            String nombre = jsonText(payload, "propertyCount");
            if (!type.isEmpty() || !surface.isEmpty() || !capacite.isEmpty() || !nombre.isEmpty()) {
                sb.append("Bien : ");
                List<String> bits = new ArrayList<>();
                if (!type.isEmpty()) bits.add(type);
                if (!surface.isEmpty()) bits.add(surface + " m²");
                if (!capacite.isEmpty()) bits.add(capacite + " voyageurs");
                if (!nombre.isEmpty() && !"1".equals(nombre)) bits.add(nombre + " logements");
                sb.append(String.join(", ", bits)).append(".\n");
            }
            String forfaitServices = joinJsonArray(payload, "services");
            String devisServices = joinJsonArray(payload, "servicesDevis");
            String cal = labelize(jsonText(payload, "calendarSync"));
            if (!forfaitServices.isEmpty() || !devisServices.isEmpty() || !cal.isEmpty()) {
                sb.append("Services souhaités :");
                if (!forfaitServices.isEmpty()) sb.append("\n  • Forfait : ").append(forfaitServices);
                if (!devisServices.isEmpty()) sb.append("\n  • Sur devis : ").append(devisServices);
                if (!cal.isEmpty()) sb.append("\n  • Synchro calendrier : ").append(cal);
                sb.append('\n');
            }
            String freq = labelize(jsonText(payload, "bookingFrequency"));
            String menage = labelize(jsonText(payload, "cleaningSchedule"));
            if (!freq.isEmpty() || !menage.isEmpty()) {
                sb.append("Planning :");
                if (!freq.isEmpty()) sb.append("\n  • Fréquence des réservations : ").append(freq);
                if (!menage.isEmpty()) sb.append("\n  • Planning ménage : ").append(menage);
                sb.append('\n');
            }
        }
        // Annexe : recap chiffre du devis si calcul disponible
        if (quote != null) {
            sb.append("\nRecommandation tarifaire — Forfait ").append(quote.forfaitLabel()).append(" :")
              .append("\n  • Ménage : ").append(formatEur(quote.interventionPrice())).append(" par intervention (~")
              .append(formatEur(quote.monthlyCleaningCost())).append("/mois)")
              .append("\n  • Option Abonnement PMS (logiciel) : ").append(formatEur(quote.pmsMonthlyPrice())).append(" / mois")
              .append("\n  • Abonnement PMS annuel : ").append(formatEur(quote.pmsAnnualWithDiscount()))
              .append("/an (au lieu de ").append(formatEur(quote.pmsAnnualWithoutDiscount()))
              .append(", soit ").append(quote.annualDiscountPercent())
              .append(" % de remise / ").append(formatEur(quote.pmsAnnualSavings())).append(" économisés)");
        }
        return sb.toString().trim();
    }

    /** Resume textuel des champs MAINTENANCE. */
    private String buildMaintenanceDescription(JsonNode payload) {
        if (payload == null) return "";
        StringBuilder sb = new StringBuilder();
        String works = joinJsonArray(payload, "selectedWorks");
        if (!works.isEmpty()) sb.append("Travaux demandés : ").append(works).append("\n");
        String custom = jsonText(payload, "customNeed");
        if (!custom.isEmpty()) sb.append("Besoin spécifique : ").append(custom).append("\n");
        String desc = jsonText(payload, "description");
        if (!desc.isEmpty()) sb.append("\n").append(desc);
        return sb.toString().trim();
    }

    // ─── ReceivedForm helpers ─────────────────────────────────────────────

    private JsonNode parsePayloadSafely(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            log.warn("Cannot parse ReceivedForm payload as JSON: {}", e.getMessage());
            return null;
        }
    }

    private String jsonText(JsonNode node, String field) {
        if (node == null || !node.hasNonNull(field)) return "";
        JsonNode v = node.get(field);
        return v.isTextual() ? v.asText() : v.toString();
    }

    private String joinJsonArray(JsonNode node, String field) {
        if (node == null || !node.hasNonNull(field)) return "";
        JsonNode arr = node.get(field);
        if (!arr.isArray()) return labelize(arr.isTextual() ? arr.asText() : arr.toString());
        List<String> parts = new ArrayList<>();
        arr.forEach(item -> parts.add(labelize(item.isTextual() ? item.asText() : item.toString())));
        return String.join(", ", parts);
    }

    /** kebab-case → "Kebab Case" — lit les codes du frontend (ex: 'tres-frequent') */
    private String labelize(String raw) {
        if (raw == null || raw.isBlank()) return "";
        String[] words = raw.replace('_', ' ').replace('-', ' ').toLowerCase().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < words.length; i++) {
            if (words[i].isEmpty()) continue;
            sb.append(Character.toUpperCase(words[i].charAt(0))).append(words[i].substring(1));
            if (i < words.length - 1) sb.append(' ');
        }
        return sb.toString();
    }
}
