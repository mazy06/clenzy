package com.clenzy.tenant;

import org.springframework.stereotype.Component;

/**
 * Holder du contexte d'organisation courante — singleton avec ThreadLocal
 * interne (pattern Spring {@code SecurityContextHolder}).
 *
 * <p><b>Pourquoi pas {@code @RequestScope}</b> : le request scope est nettoye
 * des que le handler HTTP retourne. Pour les flows async (SSE, scheduled
 * tasks, sseExecutor pool), le scope devient inactif → "Scope 'request' is
 * not active for the current thread" → tools/services crashent silencieusement.
 * Pattern ThreadLocal permet a n'importe quel thread d'avoir son propre
 * contexte, set manuellement quand on passe a un thread async.</p>
 *
 * <p><b>Securite critique</b> : TOUT thread qui set le tenant DOIT clear()
 * a la fin (try/finally), sinon fuite cross-request quand le thread est
 * reattribue. {@code TenantFilter} le fait pour les threads HTTP request.
 * {@code AssistantController} le fait pour les threads du sseExecutor pool.</p>
 *
 * <p><b>API</b> : strictement identique a l'ancien @RequestScope —
 * tous les usages existants (services, tests) restent compatibles.</p>
 */
@Component
public class TenantContext {

    /**
     * Etat tenant pour le thread courant. {@code withInitial} retourne une
     * data vide par defaut (orgId=null) pour eviter NullPointer si un thread
     * accede avant que setX() soit appele.
     */
    private static final ThreadLocal<TenantData> HOLDER = ThreadLocal.withInitial(TenantData::new);

    /**
     * Container des champs tenant. Class interne (non statique non, on a besoin
     * d'une nouvelle instance par thread).
     */
    private static final class TenantData {
        Long organizationId;
        boolean superAdmin = false;
        boolean systemOrg = false;
        String countryCode = "FR";
        String defaultCurrency = "EUR";
        boolean vatRegistered = true;
    }

    public Long getOrganizationId() {
        return HOLDER.get().organizationId;
    }

    public void setOrganizationId(Long organizationId) {
        HOLDER.get().organizationId = organizationId;
    }

    public boolean isSuperAdmin() {
        return HOLDER.get().superAdmin;
    }

    public void setSuperAdmin(boolean superAdmin) {
        HOLDER.get().superAdmin = superAdmin;
    }

    /**
     * Indique si l'utilisateur appartient a une organisation de type SYSTEM.
     * Les utilisateurs SYSTEM ont acces aux donnees de toutes les organisations
     * (equipes, interventions) car ils fournissent des services cross-org.
     */
    public boolean isSystemOrg() {
        return HOLDER.get().systemOrg;
    }

    public void setSystemOrg(boolean systemOrg) {
        HOLDER.get().systemOrg = systemOrg;
    }

    // --- Fiscal getters/setters ---

    public String getCountryCode() {
        return HOLDER.get().countryCode;
    }

    public void setCountryCode(String countryCode) {
        HOLDER.get().countryCode = countryCode;
    }

    public String getDefaultCurrency() {
        return HOLDER.get().defaultCurrency;
    }

    public void setDefaultCurrency(String defaultCurrency) {
        HOLDER.get().defaultCurrency = defaultCurrency;
    }

    public boolean isVatRegistered() {
        return HOLDER.get().vatRegistered;
    }

    public void setVatRegistered(boolean vatRegistered) {
        HOLDER.get().vatRegistered = vatRegistered;
    }

    /**
     * Retourne l'organizationId ou leve une exception si non resolu.
     * A utiliser dans les services pour les operations d'ecriture.
     */
    public Long getRequiredOrganizationId() {
        Long organizationId = HOLDER.get().organizationId;
        if (organizationId == null) {
            throw new IllegalStateException("Contexte d'organisation non resolu. " +
                "L'utilisateur doit etre authentifie et rattache a une organisation.");
        }
        return organizationId;
    }

    /**
     * Reset complet du contexte pour le thread courant. CRITIQUE securite :
     * doit etre appele dans un {@code finally} apres tout {@code setX()} sur
     * un thread qui sera reattribue (pool thread). Sinon fuite cross-request
     * du tenant precedent.
     *
     * <p>{@link TenantFilter} appelle clear() apres le {@code filterChain.doFilter}
     * pour chaque request HTTP. {@code AssistantController} appelle clear()
     * a la fin du task sseExecutor.</p>
     */
    public void clear() {
        HOLDER.remove();
    }
}
