package com.clenzy.service.tags;

import com.clenzy.dto.QuoteLineDto;
import com.clenzy.model.ServiceQuote;
import com.clenzy.repository.ServiceQuoteRepository;
import com.clenzy.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static com.clenzy.service.tags.TagFormatting.DATE_FORMAT;
import static com.clenzy.service.tags.TagFormatting.formatMoney;
import static com.clenzy.service.tags.TagFormatting.safeStr;

/**
 * Tags d'un DEVIS prestataire.
 *
 * <p>Un devis se rendait jusqu'ici via son intervention — dont les tags
 * {@code montant} et {@code total} portent le cout de l'INTERVENTION, pas celui
 * du devis. Trois devis concurrents produisaient donc trois PDF identiques,
 * affichant un montant qui n'etait celui d'aucun d'eux. C'est pourquoi le
 * document n'etait genere qu'a l'approbation, une fois le cout aligne — et le
 * prestataire n'avait rien a transmettre entre-temps.</p>
 *
 * <p>Ce resolveur rend le devis pour lui-meme : son montant, son detail ligne a
 * ligne, sa validite. L'intervention, le logement et le client restent
 * disponibles, resolus depuis le devis.</p>
 */
@Component
public class ServiceQuoteTagResolver implements ReferenceTagResolver {

    private static final Logger log = LoggerFactory.getLogger(ServiceQuoteTagResolver.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final ServiceQuoteRepository quoteRepository;
    private final InterventionTagResolver interventionTags;
    private final EntityTagBuilders builders;
    private final UserRepository userRepository;

    public ServiceQuoteTagResolver(ServiceQuoteRepository quoteRepository,
                                   InterventionTagResolver interventionTags,
                                   EntityTagBuilders builders,
                                   UserRepository userRepository) {
        this.quoteRepository = quoteRepository;
        this.interventionTags = interventionTags;
        this.builders = builders;
        this.userRepository = userRepository;
    }

    @Override
    public String referenceType() {
        return "service_quote";
    }

    @Override
    public void resolve(Long quoteId, Map<String, Object> context) {
        if (quoteId == null) return;

        quoteRepository.findById(quoteId).ifPresent(quote -> {
            // Le contexte de l'intervention d'abord : logement, client, dates.
            // Les tags du devis passent APRES et ecrasent ce qui parle d'argent.
            if (quote.getInterventionId() != null) {
                interventionTags.resolve(quote.getInterventionId(), context);
            }

            // ${ligne.*} : ce que le devis facture, pas ce que l'intervention
            // avait estime.
            List<QuoteLineDto> lines = parseLines(quote.getLines());
            context.put("devis", quoteTags(quote, lines));
            context.put("ligne", ligneTags(quote, lines));
            context.put("lignes", lines.stream().map(this::lineTags).collect(Collectors.toList()));

            // Le prestataire signe de son enseigne.
            if (quote.getProviderUserId() != null) {
                userRepository.findById(quote.getProviderUserId()).ifPresent(provider -> {
                    context.put("technicien", builders.clientTags(provider));
                    byte[] logo = builders.companyLogoBytes(provider);
                    if (logo != null) {
                        context.put("logo_prestataire", logo);
                    }
                });
            }

            context.put("nf", nfTags());
        });
    }

    /**
     * Tags {@code devis.*}.
     *
     * <p>Ce namespace est deja celui du devis PROSPECT (forfait, menage,
     * abonnement, pms, total), et le modele actif l'utilise —
     * {@code ${devis.forfait.nom}}, {@code ${devis.total.mensuel}}. L'ecraser
     * avec une autre forme faisait echouer le rendu sur une reference nulle.
     * On conserve donc la charpente attendue, remplie de ce qu'un devis
     * prestataire a de comparable, et on ajoute nos champs a cote.</p>
     */
    private Map<String, Object> quoteTags(ServiceQuote quote, List<QuoteLineDto> lines) {
        Map<String, Object> tags = new LinkedHashMap<>();

        String prestations = lines.isEmpty()
                ? safeStr(quote.getDescription())
                : lines.stream().map(QuoteLineDto::label).collect(Collectors.joining(", "));
        Map<String, Object> forfait = new LinkedHashMap<>();
        forfait.put("id", quote.getId() != null ? String.valueOf(quote.getId()) : "");
        forfait.put("nom", prestations);
        tags.put("forfait", forfait);

        String montant = formatMoney(quote.getAmount());
        Map<String, Object> total = new LinkedHashMap<>();
        total.put("mensuel", montant);
        total.put("mensuel_sans_pms", montant);
        total.put("mensuel_avec_pms", montant);
        total.put("annuel_avec_remise", montant);
        tags.put("total", total);

        // Blocs du devis prospect sans equivalent ici : presents pour que le
        // modele les traverse, vides parce qu'ils ne veulent rien dire.
        tags.put("menage", emptyKeys("prix_intervention", "interventions_par_mois",
                "estimation_mensuelle", "estimation_annuelle"));
        tags.put("abonnement", emptyKeys("mensuel", "annuel_sans_remise",
                "annuel_avec_remise", "economie_annuelle", "remise_pct"));
        tags.put("pms", emptyKeys("mensuel", "annuel_avec_remise", "synchro_incluse"));

        tags.put("numero", quote.getId() != null ? String.valueOf(quote.getId()) : "");
        tags.put("prestataire", safeStr(quote.getProviderName()));
        tags.put("montant", montant);
        tags.put("devise", safeStr(quote.getCurrency()));
        tags.put("statut", quote.getStatus() != null ? quote.getStatus().name() : "");
        tags.put("valide_jusqu_au", quote.getValidUntil() != null
                ? quote.getValidUntil().format(DATE_FORMAT) : "");
        tags.put("debut_possible", quote.getEarliestStartDate() != null
                ? quote.getEarliestStartDate().format(DATE_FORMAT) : "");
        tags.put("description", safeStr(quote.getDescription()));
        return tags;
    }

    private static Map<String, Object> emptyKeys(String... keys) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (String key : keys) map.put(key, "");
        return map;
    }

    /** Ligne unique agregee, pour les modeles qui n'en attendent qu'une. */
    private Map<String, Object> ligneTags(ServiceQuote quote, List<QuoteLineDto> lines) {
        Map<String, Object> tags = new LinkedHashMap<>();
        String description = lines.isEmpty()
                ? safeStr(quote.getDescription())
                : lines.stream().map(QuoteLineDto::label).collect(Collectors.joining(", "));
        tags.put("description", description);
        tags.put("quantite", "1");
        tags.put("prix_unitaire", formatMoney(quote.getAmount()));
        tags.put("total", formatMoney(quote.getAmount()));
        return tags;
    }

    private Map<String, Object> lineTags(QuoteLineDto line) {
        BigDecimal quantity = line.quantity() != null ? line.quantity() : BigDecimal.ONE;
        BigDecimal unitPrice = line.unitPrice() != null ? line.unitPrice() : BigDecimal.ZERO;
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("description", safeStr(line.label()));
        tags.put("quantite", quantity.stripTrailingZeros().toPlainString());
        tags.put("prix_unitaire", formatMoney(unitPrice));
        tags.put("total", formatMoney(unitPrice.multiply(quantity)));
        return tags;
    }

    private Map<String, Object> nfTags() {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("numero", "");
        tags.put("date", LocalDateTime.now().format(DATE_FORMAT));
        return tags;
    }

    /** Un detail illisible ne doit pas faire echouer la generation. */
    private List<QuoteLineDto> parseLines(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return MAPPER.readValue(json, new TypeReference<List<QuoteLineDto>>() {});
        } catch (Exception e) {
            log.warn("Detail du devis illisible : {}", e.getMessage());
            return List.of();
        }
    }
}
