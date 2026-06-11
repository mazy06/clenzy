package com.clenzy.service.tags;

import java.util.Map;

/**
 * Resolveur de tags de document pour UN type de reference ("intervention",
 * "reservation", "received_form", ...).
 *
 * <p>Registre OCP (T-SOLID-5) : les implementations sont des beans Spring
 * collectes par {@code TagResolverService} et indexes par {@link #referenceType()}.
 * Ajouter un nouveau type de reference = ajouter une implementation, sans
 * modifier le dispatch existant.</p>
 */
public interface ReferenceTagResolver {

    /** Type de reference gere, en minuscules (ex. {@code "reservation"}). */
    String referenceType();

    /**
     * Resout les tags de l'entite {@code referenceId} et les ajoute au contexte.
     * No-op si {@code referenceId} est null ou si l'entite n'existe pas
     * (comportement historique de TagResolverService).
     */
    void resolve(Long referenceId, Map<String, Object> context);
}
