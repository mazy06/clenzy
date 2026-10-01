package com.clenzy.config;

import com.clenzy.service.PermissionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.access.PermissionEvaluator;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.io.Serializable;

/**
 * Donne un sens a {@code @PreAuthorize("hasPermission(null, 'x:y')")}.
 *
 * <p><b>Pourquoi il existe</b> : sans {@link PermissionEvaluator} enregistre,
 * Spring Security retombe sur {@code DenyAllPermissionEvaluator}, dont la
 * reponse est toujours {@code false} — l'expression ne filtrait alors personne,
 * elle fermait la route a tout le monde. C'est ce qui rendait les rapports de
 * {@code ReportController} injoignables, staff plateforme compris.</p>
 *
 * <p><b>Ce qu'il apporte face a {@code hasAnyRole}</b> : les permissions par
 * role sont <b>administrables</b> ({@code PUT /api/permissions/roles/{role}}).
 * Une liste de roles ecrite en dur dans l'annotation ignore cette
 * administration — retirer {@code reports:generate} a SUPER_MANAGER depuis
 * l'ecran ne changeait rien a l'API. En passant par le service, l'ecran cesse
 * de mentir.</p>
 *
 * <p><b>Le prix</b> : contrairement a {@code hasAnyRole}, qui se decide sur les
 * seules authorities du JWT, l'evaluation touche Redis et, cache froid, la base.
 * A reserver donc aux routes dont la permission est reellement administree, et
 * non a celles dont la regle se reduit a une liste de roles figee.</p>
 *
 * <p><b>Fail-closed</b> : tout ce qui n'est pas une identite resolue vaut refus
 * — pas d'authentification, principal qui n'est pas un JWT (donc pas de sujet
 * Keycloak a qui rattacher des permissions), permission absente. Le service
 * lui-meme attrape ses erreurs et repond {@code false}.</p>
 *
 * <p>Le {@link ObjectProvider} n'est pas une precaution de style : le handler
 * d'expressions est construit tres tot dans le cycle de vie du contexte, et une
 * injection directe forcerait l'initialisation prematuree de
 * {@link PermissionService} — donc de Redis et du JPA — avant que leur propre
 * configuration soit prete. La resolution est donc differee a l'appel.</p>
 */
public class BaitlyPermissionEvaluator implements PermissionEvaluator {

    private static final Logger log = LoggerFactory.getLogger(BaitlyPermissionEvaluator.class);

    private final ObjectProvider<PermissionService> permissionServiceProvider;

    public BaitlyPermissionEvaluator(ObjectProvider<PermissionService> permissionServiceProvider) {
        this.permissionServiceProvider = permissionServiceProvider;
    }

    /**
     * Forme utilisee par le projet : {@code hasPermission(null, 'reports:generate')}.
     * La cible est ignoree — les permissions sont globales au role, elles ne
     * portent pas sur un objet particulier.
     */
    @Override
    public boolean hasPermission(Authentication authentication, Object targetDomainObject, Object permission) {
        if (permission == null) {
            return false;
        }

        String keycloakId = keycloakIdOf(authentication);
        if (keycloakId == null) {
            return false;
        }

        PermissionService permissionService = permissionServiceProvider.getIfAvailable();
        if (permissionService == null) {
            // Ne devrait pas arriver hors d'un contexte partiel : on refuse plutot
            // que de laisser passer une route qu'on ne sait pas evaluer.
            log.error("BaitlyPermissionEvaluator : PermissionService indisponible, acces refuse (permission={})", permission);
            return false;
        }

        return permissionService.checkUserPermission(keycloakId, permission.toString());
    }

    /**
     * Forme par identifiant de cible ({@code hasPermission(id, 'Type', 'perm')}).
     * Non supportee : le modele de permissions du projet ne porte pas sur des
     * objets. Refuser est le seul comportement sur : accepter reviendrait a
     * ouvrir une route dont personne n'a ecrit la regle.
     */
    @Override
    public boolean hasPermission(Authentication authentication, Serializable targetId,
                                 String targetType, Object permission) {
        log.warn("BaitlyPermissionEvaluator : hasPermission par cible non supporte "
                + "(targetType={}, permission={}), acces refuse", targetType, permission);
        return false;
    }

    /**
     * Sujet Keycloak de l'appelant, ou {@code null} s'il n'y en a pas.
     * {@link PermissionService#checkUserPermission} attend ce sujet, pas
     * l'identifiant en base.
     */
    private String keycloakIdOf(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        if (authentication instanceof JwtAuthenticationToken jwtAuth) {
            return jwtAuth.getToken().getSubject();
        }
        if (authentication.getPrincipal() instanceof Jwt jwt) {
            return jwt.getSubject();
        }
        return null;
    }
}
