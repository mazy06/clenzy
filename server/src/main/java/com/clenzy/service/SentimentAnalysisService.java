package com.clenzy.service;

import com.clenzy.model.ReviewTag;
import com.clenzy.model.SentimentLabel;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class SentimentAnalysisService {

    public record SentimentResult(double score, SentimentLabel label, List<ReviewTag> tags) {}

    private static final double POSITIVE_THRESHOLD = 0.2;
    private static final double NEGATIVE_THRESHOLD = -0.2;

    // ── Positive keywords per language ──────────────────────────────────
    private static final Map<String, Set<String>> POSITIVE_KEYWORDS = Map.of(
        "en", Set.of("excellent", "amazing", "wonderful", "fantastic", "great", "perfect",
            "beautiful", "clean", "comfortable", "friendly", "helpful", "cozy", "spacious",
            "lovely", "outstanding", "superb", "recommend", "spotless", "welcoming", "convenient"),
        "fr", Set.of("excellent", "magnifique", "merveilleux", "fantastique", "genial", "parfait",
            "beau", "propre", "confortable", "sympathique", "agreable", "chaleureux", "spacieux",
            "superbe", "recommande", "impeccable", "accueillant", "pratique", "formidable", "ideal"),
        "es", Set.of("excelente", "maravilloso", "fantastico", "genial", "perfecto",
            "bonito", "limpio", "comodo", "amable", "agradable", "acogedor", "espacioso",
            "estupendo", "recomiendo", "impecable", "encantador", "practico", "increible"),
        "de", Set.of("ausgezeichnet", "wunderbar", "fantastisch", "grossartig", "perfekt",
            "sauber", "bequem", "freundlich", "angenehm", "gemuetlich", "geraeumig",
            "hervorragend", "empfehlen", "makellos", "einladend", "praktisch", "toll"),
        "it", Set.of("eccellente", "meraviglioso", "fantastico", "perfetto",
            "pulito", "comodo", "accogliente", "spazioso", "bellissimo",
            "consiglio", "impeccabile", "pratico", "stupendo", "magnifico"),
        "pt", Set.of("excelente", "maravilhoso", "fantastico", "perfeito",
            "limpo", "confortavel", "acolhedor", "espacoso", "lindo",
            "recomendo", "impecavel", "pratico", "incrivel", "otimo")
    );

    // ── Negative keywords per language ──────────────────────────────────
    private static final Map<String, Set<String>> NEGATIVE_KEYWORDS = Map.of(
        "en", Set.of("terrible", "horrible", "awful", "dirty", "noisy", "broken", "rude",
            "disappointing", "disgusting", "uncomfortable", "overpriced", "worst", "filthy",
            "cockroach", "mold", "stain", "smell", "bug", "cold", "dangerous"),
        "fr", Set.of("terrible", "horrible", "affreux", "sale", "bruyant", "casse", "impoli",
            "decevant", "degoutant", "inconfortable", "cher", "pire", "moisissure",
            "tache", "odeur", "insecte", "froid", "dangereux", "nul", "mauvais"),
        "es", Set.of("terrible", "horrible", "sucio", "ruidoso", "roto", "maleducado",
            "decepcionante", "asqueroso", "incomodo", "caro", "peor", "moho",
            "mancha", "olor", "insecto", "frio", "peligroso", "malo", "pesimo"),
        "de", Set.of("schrecklich", "furchtbar", "schmutzig", "laut", "kaputt", "unhoeflich",
            "enttaeuschend", "ekelhaft", "unbequem", "teuer", "schlimmste", "schimmel",
            "fleck", "geruch", "insekt", "kalt", "gefaehrlich", "schlecht"),
        "it", Set.of("terribile", "orribile", "sporco", "rumoroso", "rotto", "maleducato",
            "deludente", "disgustoso", "scomodo", "costoso", "peggiore", "muffa",
            "macchia", "odore", "insetto", "freddo", "pericoloso", "pessimo"),
        "pt", Set.of("terrivel", "horrivel", "sujo", "barulhento", "quebrado", "grosseiro",
            "decepcionante", "nojento", "desconfortavel", "caro", "pior", "mofo",
            "mancha", "cheiro", "inseto", "frio", "perigoso", "pessimo")
    );

    // ── Tag keyword mapping (language-agnostic with multi-lang support) ─
    private static final Map<ReviewTag, Set<String>> TAG_KEYWORDS = Map.of(
        ReviewTag.CLEANLINESS, Set.of("clean", "dirty", "spotless", "filthy", "propre", "sale",
            "impeccable", "moisissure", "limpio", "sucio", "sauber", "schmutzig", "pulito", "sporco", "limpo", "sujo"),
        ReviewTag.LOCATION, Set.of("location", "area", "neighborhood", "central", "proche", "quartier",
            "emplacement", "ubicacion", "zona", "lage", "posizione", "localizacao"),
        ReviewTag.VALUE, Set.of("price", "value", "expensive", "cheap", "worth", "prix", "cher",
            "precio", "caro", "preis", "teuer", "prezzo", "preco"),
        ReviewTag.COMMUNICATION, Set.of("communication", "responsive", "contact", "reply", "response",
            "reponse", "comunicacion", "kommunikation", "comunicazione", "comunicacao"),
        ReviewTag.CHECK_IN, Set.of("check-in", "checkin", "arrival", "key", "arrivee", "cle",
            "llegada", "llave", "ankunft", "schluessel", "arrivo", "chiave", "chegada", "chave"),
        ReviewTag.COMFORT, Set.of("comfort", "comfortable", "bed", "mattress", "sleep", "confortable",
            "lit", "matelas", "comodo", "cama", "bequem", "bett", "letto", "confortavel"),
        ReviewTag.ACCURACY, Set.of("accurate", "description", "photos", "listing", "annonce",
            "descripcion", "fotos", "beschreibung", "descrizione", "descricao"),
        ReviewTag.AMENITIES, Set.of("amenities", "kitchen", "wifi", "parking", "pool", "equipment",
            "cuisine", "piscine", "cocina", "kueche", "cucina", "cozinha", "equipement")
    );

    public SentimentResult analyze(String text, String language) {
        if (text == null || text.isBlank()) {
            return new SentimentResult(0.0, SentimentLabel.NEUTRAL, List.of());
        }

        String lang = normalizeLanguage(language);
        String normalized = text.toLowerCase(Locale.ROOT);
        String[] words = normalized.split("[\\s,.!?;:()\\[\\]\"'\\-/]+");

        double score = calculateScore(words, lang);
        SentimentLabel label = scoreToLabel(score);
        List<ReviewTag> tags = extractTags(words);

        return new SentimentResult(clamp(score), label, tags);
    }

    public List<ReviewTag> extractTags(String text, String language) {
        if (text == null || text.isBlank()) return List.of();
        String normalized = text.toLowerCase(Locale.ROOT);
        String[] words = normalized.split("[\\s,.!?;:()\\[\\]\"'\\-/]+");
        return extractTags(words);
    }

    private double calculateScore(String[] words, String lang) {
        Set<String> positives = POSITIVE_KEYWORDS.getOrDefault(lang, Set.of());
        Set<String> negatives = NEGATIVE_KEYWORDS.getOrDefault(lang, Set.of());
        // Also check English as fallback for mixed-language reviews
        Set<String> enPositives = POSITIVE_KEYWORDS.get("en");
        Set<String> enNegatives = NEGATIVE_KEYWORDS.get("en");

        int positiveCount = 0;
        int negativeCount = 0;

        for (String word : words) {
            if (word.length() < 2) continue;
            if (positives.contains(word) || enPositives.contains(word)) positiveCount++;
            if (negatives.contains(word) || enNegatives.contains(word)) negativeCount++;
        }

        int total = positiveCount + negativeCount;
        if (total == 0) return 0.0;

        return (double)(positiveCount - negativeCount) / total;
    }

    private List<ReviewTag> extractTags(String[] words) {
        Set<String> wordSet = new HashSet<>(Arrays.asList(words));
        return TAG_KEYWORDS.entrySet().stream()
            .filter(entry -> entry.getValue().stream().anyMatch(wordSet::contains))
            .map(Map.Entry::getKey)
            .sorted()
            .collect(Collectors.toList());
    }

    private SentimentLabel scoreToLabel(double score) {
        if (score >= POSITIVE_THRESHOLD) return SentimentLabel.POSITIVE;
        if (score <= NEGATIVE_THRESHOLD) return SentimentLabel.NEGATIVE;
        return SentimentLabel.NEUTRAL;
    }

    private String normalizeLanguage(String language) {
        if (language == null || language.isBlank()) return "en";
        String lang = language.toLowerCase(Locale.ROOT).trim();
        if (lang.contains("-")) lang = lang.split("-")[0];
        if (lang.contains("_")) lang = lang.split("_")[0];
        return POSITIVE_KEYWORDS.containsKey(lang) ? lang : "en";
    }

    private double clamp(double value) {
        return Math.max(-1.0, Math.min(1.0, value));
    }
}
