package com.clenzy.tenant;

import org.springframework.stereotype.Component;
import org.springframework.web.context.annotation.RequestScope;

/**
 * Bean request-scoped qui contient l'identifiant de l'organisation courante.
 * Resolu par le TenantFilter a partir du JWT de l'utilisateur authentifie.
 *
 * Utilisation dans les services :
 *   tenantContext.getRequiredOrganizationId()  → Long (throw si non resolu)
 *   tenantContext.isSuperAdmin()               → true si l'utilisateur est ADMIN global
 */
@Component
@RequestScope
public class TenantContext {

    private Long organizationId;
    private boolean superAdmin = false;
    private boolean systemOrg = false;

    // --- Fiscal context (enrichi depuis FiscalProfile) ---
    private String countryCode = "FR";
    private String defaultCurrency = "EUR";
    private boolean vatRegistered = true;

    public Long getOrganizationId() {
        return organizationId;
    }

    public void setOrganizationId(Long organizationId) {
        this.organizationId = organizationId;
    }

    public boolean isSuperAdmin() {
        return superAdmin;
    }

    public void setSuperAdmin(boolean superAdmin) {
        this.superAdmin = superAdmin;
    }

    /**
     * Indique si l'utilisateur appartient a une organisation de type SYSTEM.
     * Les utilisateurs SYSTEM ont acces aux donnees de toutes les organisations
     * (equipes, interventions) car ils fournissent des services cross-org.
     */
    public boolean isSystemOrg() {
        return systemOrg;
    }

    public void setSystemOrg(boolean systemOrg) {
        this.systemOrg = systemOrg;
    }

    // --- Fiscal getters/setters ---

    public String getCountryCode() {
        return countryCode;
    }

    public void setCountryCode(String countryCode) {
        this.countryCode = countryCode;
    }

    public String getDefaultCurrency() {
        return defaultCurrency;
    }

    public void setDefaultCurrency(String defaultCurrency) {
        this.defaultCurrency = defaultCurrency;
    }

    public boolean isVatRegistered() {
        return vatRegistered;
    }

    public void setVatRegistered(boolean vatRegistered) {
        this.vatRegistered = vatRegistered;
    }

    /**
     * Retourne l'organizationId ou leve une exception si non resolu.
     * A utiliser dans les services pour les operations d'ecriture.
     */
    public Long getRequiredOrganizationId() {
        if (organizationId == null) {
            throw new IllegalStateException("Contexte d'organisation non resolu. " +
                "L'utilisateur doit etre authentifie et rattache a une organisation.");
        }
        return organizationId;
    }
}
