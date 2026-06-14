package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.dto.MappingSuggestion;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Apparie des propriétés Clenzy non-mappées à des propriétés Channex non-mappées par nom normalisé
 * (CLZ Domaine 1 / mapping). <b>Fonction pure</b>, entièrement testable.
 *
 * <p>Normalisation : minuscules, accents retirés, ponctuation → espaces. Match exact normalisé
 * → confiance HIGH ; sinon inclusion mutuelle (≥ 4 caractères) → MEDIUM. Au plus une suggestion
 * par propriété Clenzy ; une propriété Channex n'est suggérée qu'une fois.</p>
 */
@Component
public class MappingSuggestionMatcher {

    public record ClenzyCandidate(Long id, String name) {}

    public record ChannexCandidate(String id, String title) {}

    public List<MappingSuggestion> suggest(List<ClenzyCandidate> clenzy, List<ChannexCandidate> channex) {
        List<MappingSuggestion> out = new ArrayList<>();
        Set<String> usedChannex = new HashSet<>();
        for (ClenzyCandidate c : clenzy) {
            String cn = normalize(c.name());
            if (cn.isEmpty()) continue;
            ChannexCandidate exact = null;
            ChannexCandidate partial = null;
            for (ChannexCandidate x : channex) {
                if (usedChannex.contains(x.id())) continue;
                String xn = normalize(x.title());
                if (xn.isEmpty()) continue;
                if (xn.equals(cn)) {
                    exact = x;
                    break;
                }
                if (partial == null && Math.min(xn.length(), cn.length()) >= 4
                        && (xn.contains(cn) || cn.contains(xn))) {
                    partial = x;
                }
            }
            ChannexCandidate match = (exact != null) ? exact : partial;
            if (match == null) continue;
            usedChannex.add(match.id());
            out.add(new MappingSuggestion(
                c.id(), c.name(), match.id(), match.title(),
                exact != null ? "HIGH" : "MEDIUM",
                exact != null ? "Nom identique (normalise)" : "Nom partiellement correspondant"));
        }
        return out;
    }

    static String normalize(String s) {
        if (s == null) return "";
        return Normalizer.normalize(s, Normalizer.Form.NFD)
            .replaceAll("\\p{M}+", "")
            .toLowerCase()
            .replaceAll("[^a-z0-9]+", " ")
            .trim()
            .replaceAll("\\s+", " ");
    }
}
