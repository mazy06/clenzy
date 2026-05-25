package com.clenzy.service;

import com.clenzy.model.AssistantMemory;
import com.clenzy.repository.AssistantMemoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
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

    public AssistantMemoryService(AssistantMemoryRepository repository) {
        this.repository = repository;
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
        Optional<AssistantMemory> existing = repository.findByUserAndKey(keycloakId, normalizedKey);
        if (existing.isPresent()) {
            AssistantMemory memory = existing.get();
            memory.setMemoryValue(value);
            memory.setScopeEnum(scope);
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
     */
    @Transactional(readOnly = true)
    public List<AssistantMemory> listForUser(String keycloakId, int limit) {
        if (keycloakId == null || keycloakId.isBlank()) {
            return List.of();
        }
        int safeLimit = Math.max(1, Math.min(limit, 100));
        return repository.findRecentByUser(keycloakId, PageRequest.of(0, safeLimit));
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
