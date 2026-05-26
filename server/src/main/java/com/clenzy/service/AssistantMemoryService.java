package com.clenzy.service;

import com.clenzy.model.AssistantMemory;
import com.clenzy.repository.AssistantMemoryRepository;
import com.clenzy.service.agent.kb.EmbeddingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Service de gestion de la memoire long-terme de l'assistant IA.
 *
 * <p>Trois operations exposees :
 * <ul>
 *   <li>{@link #upsert(Long, String, String, String, AssistantMemory.Scope)} : insert ou
 *       update d'une entree par cle (utilise par le tool {@code remember_fact}).</li>
 *   <li>{@link #forget(Long, String, String)} : suppression d'une entree par cle
 *       (utilise par le tool {@code forget_fact}).</li>
 *   <li>{@link #listForUser(String, int)} : top N memoires triees par recence (utilise
 *       par l'orchestrateur pour construire le system prompt).</li>
 * </ul>
 *
 * <p>L'ownership est porte par le tuple {@code (organizationId, keycloakId)} : la
 * defense en profondeur repose sur le filtre Hibernate (organization) + le filtre
 * applicatif sur {@code keycloak_id} dans chaque query.</p>
 */
@Service
@Transactional
public class AssistantMemoryService {

    private static final Logger log = LoggerFactory.getLogger(AssistantMemoryService.class);
    private static final int MAX_MEMORY_KEY_LENGTH = 120;
    private static final int MAX_MEMORY_VALUE_LENGTH = 2000;

    private final AssistantMemoryRepository repository;
    private final EmbeddingService embeddingService;
    private final boolean relevanceEnabled;

    public AssistantMemoryService(AssistantMemoryRepository repository,
                                    Optional<EmbeddingService> embeddingService,
                                    @Value("${clenzy.assistant.memory.relevance-enabled:true}") boolean relevanceEnabled) {
        this.repository = repository;
        this.embeddingService = embeddingService.orElse(null);
        this.relevanceEnabled = relevanceEnabled;
    }

    /**
     * Insere ou met a jour une entree de memoire pour l'user courant.
     *
     * @param organizationId org du user (pour multi-tenant defense en profondeur)
     * @param keycloakId     sujet JWT de l'user
     * @param key            cle stable (max 120 chars, normalisee snake_case)
     * @param value          valeur libre (max 2000 chars)
     * @param scope          categorisation (preference / fact / goal / project)
     * @return l'entite persistee (nouvellement creee ou mise a jour)
     */
    public AssistantMemory upsert(Long organizationId, String keycloakId,
                                   String key, String value, AssistantMemory.Scope scope) {
        validateInputs(organizationId, keycloakId, key, value, scope);

        String normalizedKey = normalizeKey(key);
        String embedding = embedSafe(normalizedKey, value);
        Optional<AssistantMemory> existing = repository.findByUserAndKey(keycloakId, normalizedKey);
        if (existing.isPresent()) {
            AssistantMemory memory = existing.get();
            memory.setMemoryValue(value);
            memory.setScopeEnum(scope);
            if (embedding != null) {
                memory.setEmbedding(embedding);
            }
            // Defense en profondeur : ne jamais laisser une entree changer d'org
            // (theoriquement impossible vu l'unique key (keycloak_id, memory_key)
            //  mais on coupe court en cas de derive).
            if (!memory.getOrganizationId().equals(organizationId)) {
                log.warn("Memory key '{}' belongs to org {} but caller is {} — refusing cross-org update",
                        normalizedKey, memory.getOrganizationId(), organizationId);
                throw new IllegalStateException("Cross-org memory mismatch");
            }
            return repository.save(memory);
        }

        AssistantMemory created = new AssistantMemory(organizationId, keycloakId,
                normalizedKey, value, scope);
        created.setEmbedding(embedding);
        return repository.save(created);
    }

    /**
     * Supprime une entree de memoire par cle.
     *
     * @return true si une entree a ete effectivement supprimee, false si la cle
     *         n'existait pas pour cet user
     */
    public boolean forget(Long organizationId, String keycloakId, String key) {
        if (key == null || key.isBlank()) {
            return false;
        }
        // organizationId reserve pour la coherence d'API ; le filtre se fait via
        // keycloak_id (ownership user-level) + filtre Hibernate (tenant).
        int deleted = repository.deleteByUserAndKey(keycloakId, normalizeKey(key));
        if (deleted > 0) {
            log.info("Forgot memory key '{}' for user {} (org {})",
                    key, keycloakId, organizationId);
        }
        return deleted > 0;
    }

    /**
     * Liste les memoires d'un user, triees par recence, limitees a {@code limit} entrees.
     * Utilise par l'orchestrateur pour borner la taille du system prompt.
     *
     * <p>Bump batch de {@code last_accessed_at} sur les entrees retournees pour
     * alimenter le scheduler de cleanup (purge des memoires non lues > 6 mois).</p>
     */
    public List<AssistantMemory> listForUser(String keycloakId, int limit) {
        if (keycloakId == null || keycloakId.isBlank()) {
            return List.of();
        }
        int safeLimit = Math.max(1, Math.min(limit, 100));
        List<AssistantMemory> result = repository.findRecentByUser(
                keycloakId, PageRequest.of(0, safeLimit));
        touchLastAccessedSafe(result);
        return result;
    }

    /**
     * Selection des memoires les plus pertinentes pour {@code userMessage} via
     * similarite cosine sur les embeddings stockes.
     *
     * <p>Fallback automatique sur {@link #listForUser(String, int)} si :
     * <ul>
     *   <li>La feature est desactivee ({@code clenzy.assistant.memory.relevance-enabled=false})</li>
     *   <li>Aucun {@link EmbeddingService} n'est configure</li>
     *   <li>{@code userMessage} est null/blank (cas resume after confirmation)</li>
     *   <li>L'embedding du query echoue (provider down)</li>
     *   <li>Aucune entree n'a d'embedding stocke (cas migration : entrees pre-0145)</li>
     * </ul>
     * Le caller n'a pas a se preoccuper de ces cas — la methode renvoie toujours
     * une liste valide.</p>
     */
    public List<AssistantMemory> listMostRelevant(String keycloakId, String userMessage, int limit) {
        if (!relevanceEnabled || embeddingService == null
                || userMessage == null || userMessage.isBlank()) {
            return listForUser(keycloakId, limit);
        }
        if (keycloakId == null || keycloakId.isBlank()) {
            return List.of();
        }

        int safeLimit = Math.max(1, Math.min(limit, 100));
        String queryEmbedding;
        try {
            queryEmbedding = embeddingService.embedAsVectorString(userMessage);
        } catch (Exception e) {
            log.debug("Memory relevance search : embedding failed ({}), fallback recency", e.getMessage());
            return listForUser(keycloakId, safeLimit);
        }

        List<Object[]> rows;
        try {
            rows = repository.searchByCosineSimilarity(queryEmbedding, keycloakId, safeLimit);
        } catch (Exception e) {
            log.warn("Memory relevance search failed ({}), fallback recency", e.getMessage());
            return listForUser(keycloakId, safeLimit);
        }

        if (rows == null || rows.isEmpty()) {
            // Cas : user pre-0145 avec aucune entree ayant un embedding
            return listForUser(keycloakId, safeLimit);
        }

        List<Long> orderedIds = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            Number id = (Number) row[0];
            orderedIds.add(id.longValue());
        }

        List<AssistantMemory> entities = repository.findAllById(orderedIds);
        // findAllById ne garantit pas l'ordre — on re-trie selon orderedIds
        Map<Long, AssistantMemory> byId = new HashMap<>(entities.size());
        for (AssistantMemory m : entities) byId.put(m.getId(), m);

        List<AssistantMemory> ordered = new ArrayList<>(orderedIds.size());
        for (Long id : orderedIds) {
            AssistantMemory m = byId.get(id);
            if (m != null) ordered.add(m);
        }
        touchLastAccessedSafe(ordered);
        return ordered;
    }

    /**
     * Genere l'embedding texte pgvector pour {@code key + value}. Retourne null
     * en cas d'echec (provider non configure / API down) : l'entree est persistee
     * sans embedding et reste accessible via le fallback recency-only.
     */
    private String embedSafe(String key, String value) {
        if (embeddingService == null) return null;
        try {
            String text = key + ": " + value;
            return embeddingService.embedAsVectorString(text);
        } catch (Exception e) {
            log.debug("Memory embedding failed for key '{}' : {}", key, e.getMessage());
            return null;
        }
    }

    /**
     * Bump batch de {@code last_accessed_at}. Une seule query UPDATE pour
     * eviter le N+1. Echec silencieux : le bump n'est pas critique pour le user.
     */
    private void touchLastAccessedSafe(List<AssistantMemory> memories) {
        if (memories == null || memories.isEmpty()) return;
        try {
            List<Long> ids = new ArrayList<>(memories.size());
            for (AssistantMemory m : memories) {
                if (m.getId() != null) ids.add(m.getId());
            }
            if (ids.isEmpty()) return;
            LocalDateTime now = LocalDateTime.now();
            repository.touchLastAccessed(ids, now);
            // Sync in-memory pour les callers qui lisent immediatement after
            for (AssistantMemory m : memories) m.setLastAccessedAt(now);
        } catch (Exception e) {
            log.debug("touchLastAccessed failed : {}", e.getMessage());
        }
    }

    private static String normalizeKey(String raw) {
        String trimmed = raw.trim();
        return trimmed.length() > MAX_MEMORY_KEY_LENGTH
                ? trimmed.substring(0, MAX_MEMORY_KEY_LENGTH)
                : trimmed;
    }

    private static void validateInputs(Long organizationId, String keycloakId,
                                        String key, String value,
                                        AssistantMemory.Scope scope) {
        if (organizationId == null) {
            throw new IllegalArgumentException("organizationId est requis");
        }
        if (keycloakId == null || keycloakId.isBlank()) {
            throw new IllegalArgumentException("keycloakId est requis");
        }
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("La cle de memoire est requise");
        }
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("La valeur de memoire est requise");
        }
        if (value.length() > MAX_MEMORY_VALUE_LENGTH) {
            throw new IllegalArgumentException(
                    "La valeur ne peut pas depasser " + MAX_MEMORY_VALUE_LENGTH + " caracteres");
        }
        if (scope == null) {
            throw new IllegalArgumentException(
                    "Le scope est requis (preference, fact, goal ou project)");
        }
    }
}
