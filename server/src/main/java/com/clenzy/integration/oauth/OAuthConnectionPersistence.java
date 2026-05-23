package com.clenzy.integration.oauth;

import java.util.Optional;

/**
 * Strategie de persistance d'une connexion OAuth (Pennylane, DocuSign, ...).
 *
 * <h2>Role</h2>
 * Decouple {@link OAuthFlowEngine} de la couche JPA / Spring Data. Chaque
 * provider fournit une implementation legere qui delegue a son repository
 * concret. Permet a chaque provider de garder son entite et sa table sans
 * forcer un schema partage.
 *
 * <h2>Pattern</h2>
 * Strategy (GoF) — le moteur OAuth orchestre, la strategie persiste.
 *
 * @param <C> type concret de la connexion (PennylaneConnection, ...).
 */
public interface OAuthConnectionPersistence<C extends OAuthConnectionLike> {

    /** Trouve la connexion (active ou non) pour une organisation. */
    Optional<C> findByOrganizationId(Long organizationId);

    /** Trouve UNIQUEMENT les connexions ACTIVE. */
    Optional<C> findActiveByOrganizationId(Long organizationId);

    /** Cree une nouvelle instance vide de l'entite (constructeur par defaut). */
    C newConnection();

    /** Sauvegarde la connexion en base. */
    C save(C connection);
}
