package com.clenzy.service.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Pricing table des LLMs supportes (USD par million de tokens).
 *
 * <p><b>Pourquoi un service plutot qu'une config YAML</b> : les prix evoluent
 * rarement (~1-2 fois par an), sont publiques (anthropic.com/pricing,
 * openai.com/pricing) et hardcoder permet de tester unitairement le cost
 * calculation sans Spring context.</p>
 *
 * <p>Sources :
 * <ul>
 *   <li>Anthropic : https://www.anthropic.com/pricing (2026-Q2)</li>
 *   <li>OpenAI : https://openai.com/api/pricing/ (2026-Q2)</li>
 *   <li>Voyage : https://www.voyageai.com/pricing (2026-Q2)</li>
 * </ul></p>
 *
 * <p><b>Matching modele</b> : la cle est le PREFIX du model id (ex: "claude-sonnet-4"
 * matche "claude-sonnet-4-20250514"). Permet d'eviter de re-deployer a chaque
 * sortie de revision mineure.</p>
 *
 * <p><b>Fallback</b> : modele inconnu → returns ZERO pricing + log warn.
 * Vaut mieux afficher "$0.00" qu'un cost faux qui mine la confiance user.</p>
 */
@Service
public class LlmPricingService {

    private static final Logger log = LoggerFactory.getLogger(LlmPricingService.class);

    /** Tarifs : prefix modele → (input $/Mtok, output $/Mtok). Ordre = priorite de match (plus specifique d'abord). */
    private static final Map<String, ModelPrice> PRICES = new LinkedHashMap<>();

    static {
        // ─── Anthropic Claude (par ordre de specificite) ──────────────────
        // Claude Sonnet 4 (defaut Clenzy chat)
        PRICES.put("claude-sonnet-4",     new ModelPrice("3.00", "15.00"));
        // Claude Sonnet 3.5
        PRICES.put("claude-3-5-sonnet",   new ModelPrice("3.00", "15.00"));
        // Claude Haiku 4.5 (defaut Clenzy briefings)
        PRICES.put("claude-haiku-4",      new ModelPrice("0.80",  "4.00"));
        // Claude Haiku 3.5
        PRICES.put("claude-3-5-haiku",    new ModelPrice("0.80",  "4.00"));
        // Claude Opus 4
        PRICES.put("claude-opus-4",       new ModelPrice("15.00", "75.00"));
        // Fallback generique anthropic
        PRICES.put("claude-3-haiku",      new ModelPrice("0.25",  "1.25"));
        PRICES.put("claude-3-opus",       new ModelPrice("15.00", "75.00"));
        PRICES.put("claude-3-sonnet",     new ModelPrice("3.00", "15.00"));

        // ─── OpenAI ────────────────────────────────────────────────────────
        // match par PREFIX le plus long : "gpt-5-mini" gagne sur "gpt-5", etc.
        // GPT-5 (2025)
        PRICES.put("gpt-5-nano",           new ModelPrice("0.05", "0.40"));
        PRICES.put("gpt-5-mini",           new ModelPrice("0.25", "2.00"));
        PRICES.put("gpt-5",                new ModelPrice("1.25", "10.00"));
        // GPT-4.1
        PRICES.put("gpt-4.1-nano",         new ModelPrice("0.10", "0.40"));
        PRICES.put("gpt-4.1-mini",         new ModelPrice("0.40", "1.60"));
        PRICES.put("gpt-4.1",              new ModelPrice("2.00", "8.00"));
        // Reasoning (o-series)
        PRICES.put("o4-mini",              new ModelPrice("1.10", "4.40"));
        PRICES.put("o3-mini",              new ModelPrice("1.10", "4.40"));
        PRICES.put("o3",                   new ModelPrice("2.00", "8.00"));
        PRICES.put("o1-mini",              new ModelPrice("1.10", "4.40"));
        PRICES.put("o1",                   new ModelPrice("15.00", "60.00"));
        // GPT-4o / 4 / 3.5
        PRICES.put("gpt-4o-mini",          new ModelPrice("0.15", "0.60"));
        PRICES.put("gpt-4o",               new ModelPrice("2.50", "10.00"));
        PRICES.put("gpt-4-turbo",          new ModelPrice("10.00", "30.00"));
        PRICES.put("gpt-4",                new ModelPrice("30.00", "60.00"));
        PRICES.put("gpt-3.5-turbo",        new ModelPrice("0.50",  "1.50"));
        // Embeddings (input seul — pas d'output billable)
        PRICES.put("text-embedding-3-large", new ModelPrice("0.13", "0.00"));
        PRICES.put("text-embedding-3-small", new ModelPrice("0.02", "0.00"));

        // ─── Voyage AI (embeddings + rerank) ───────────────────────────────
        PRICES.put("voyage-3-large",       new ModelPrice("0.18", "0.00"));
        PRICES.put("voyage-3-lite",        new ModelPrice("0.02", "0.00"));
        PRICES.put("rerank-2",             new ModelPrice("0.05", "0.00"));
    }

    private static final ModelPrice ZERO = new ModelPrice("0.00", "0.00");
    private static final BigDecimal MILLION = new BigDecimal("1000000");

    /**
     * Resout le prix d'un modele par prefix-match (le plus long match gagne).
     * Si aucun match, retourne {@link #ZERO} (display "$0.00" plutot que crash)
     * avec un log warn — un ZERO silencieux = cout sous-compte sans que personne
     * ne le voie (piege identifie par l'audit campagne, ticket T-01).
     */
    public ModelPrice priceOf(String model) {
        if (model == null || model.isBlank()) return ZERO;
        String best = matchPrefix(model);
        if (best == null) {
            log.warn("[PRICING] Modele inconnu de la grille tarifaire : '{}' → cout $0.00 "
                    + "(ajouter le prefix dans LlmPricingService.PRICES)", model);
            return ZERO;
        }
        return PRICES.get(best);
    }

    /**
     * True si le modele a un tarif dans la grille (prefix-match). Sert a
     * l'observabilite (metrique {@code assistant.pricing.unknown_model}) pour
     * alerter quand un cout est compte a zero faute de tarif.
     */
    public boolean isKnownModel(String model) {
        return model != null && !model.isBlank() && matchPrefix(model) != null;
    }

    private String matchPrefix(String model) {
        String best = null;
        for (String prefix : PRICES.keySet()) {
            if (model.startsWith(prefix) && (best == null || prefix.length() > best.length())) {
                best = prefix;
            }
        }
        return best;
    }

    /**
     * Calcule le cout USD d'un appel LLM. Arrondi a 6 decimales (precision
     * suffisante pour micro-cents — ex: 0.000142 USD pour un appel court).
     */
    public BigDecimal computeCost(String model, long promptTokens, long completionTokens) {
        ModelPrice p = priceOf(model);
        BigDecimal inputCost = p.inputPerMillion()
                .multiply(BigDecimal.valueOf(promptTokens))
                .divide(MILLION, 6, RoundingMode.HALF_UP);
        BigDecimal outputCost = p.outputPerMillion()
                .multiply(BigDecimal.valueOf(completionTokens))
                .divide(MILLION, 6, RoundingMode.HALF_UP);
        return inputCost.add(outputCost).setScale(6, RoundingMode.HALF_UP);
    }

    /** Snapshot immutable du prix d'un modele. Valeurs en USD par million de tokens. */
    public record ModelPrice(BigDecimal inputPerMillion, BigDecimal outputPerMillion) {
        public ModelPrice(String inputPerMillion, String outputPerMillion) {
            this(new BigDecimal(inputPerMillion), new BigDecimal(outputPerMillion));
        }
    }
}
