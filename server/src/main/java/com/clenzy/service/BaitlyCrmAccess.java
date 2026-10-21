package com.clenzy.service;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.security.access.AccessDeniedException;
import java.util.Map;

@Service
public class BaitlyCrmAccess {
    private final TenantContext tenant;
    private final OrganizationService organizations;
    private final OrganizationRepository repository;
    private final PermissionService permissions;
    public BaitlyCrmAccess(TenantContext tenant,OrganizationService organizations,
                          OrganizationRepository repository,PermissionService permissions) {
        this.tenant=tenant;this.organizations=organizations;this.repository=repository;this.permissions=permissions;
    }
    public long require(String subject) {
        long org=tenant.getRequiredOrganizationId();
        organizations.validateOrgManagement(subject,org);
        return org;
    }
    /** TenantFilter renseigne ce drapeau pour SUPER_ADMIN et SUPER_MANAGER, jamais depuis le client. */
    public boolean isPlatformStaff(){return tenant.isSuperAdmin();}
    /** Serializes identity checks with mutations, including concurrent imports. */
    public long lock(String subject) {
        long org=require(subject);
        repository.lockById(org).orElseThrow(()->new AccessDeniedException("Organisation inaccessible"));
        return org;
    }
    public Map<String,Object> capabilities(String subject) {
        long org=require(subject);
        return Map.of("organizationId",org,"canManage",permissions.checkUserPermission(subject,"baitly-crm:manage"),
            "canAuthorize",permissions.checkUserPermission(subject,"baitly-crm:authorize"),
            "canSendCampaigns",isPlatformStaff() || permissions.checkUserPermission(subject,"baitly-crm:campaign-send"));
    }
    public long lockForCampaignSend(String subject){
        long org=lock(subject);
        if(!isPlatformStaff() && (!permissions.checkUserPermission(subject,"baitly-crm:view") || !permissions.checkUserPermission(subject,"baitly-crm:manage") || !permissions.checkUserPermission(subject,"baitly-crm:campaign-send")))throw new AccessDeniedException("Envoi de campagne non autorisé");
        return org;
    }
}
