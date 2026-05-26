package com.clenzy.service.agent.kb;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Fallback : conserve l'ordre d'entree, tronque a {@code topK}.
 *
 * <p>Utilise quand le re-ranking est desactive ({@code clenzy.ai.rerank.enabled=false})
 * ou que le provider configure est inavailable (cle API manquante). Garantit
 * une degradation propre : KbSearchService retourne toujours les meilleurs
 * resultats cosine quand le rerank ne marche pas.</p>
 */
@Component
public class NoOpRerankProvider implements RerankProvider {

    @Override
    public List<Integer> rerank(String query, List<String> documents, int topK) {
        if (documents == null || documents.isEmpty()) return List.of();
        int n = Math.min(topK, documents.size());
        List<Integer> indices = new ArrayList<>(n);
        for (int i = 0; i < n; i++) indices.add(i);
        return indices;
    }

    @Override
    public String name() {
        return "noop";
    }
}
