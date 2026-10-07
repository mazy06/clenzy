package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/** Un fournisseur possède son espace indépendant ; l'organisation qui le paie ne devient pas la sienne. */
@Service @Transactional(propagation=Propagation.MANDATORY)
public class BaitlySupplierWorkspace {
    private final UserRepository users;private final OrganizationService organizations;
    public BaitlySupplierWorkspace(UserRepository users,OrganizationService organizations){this.users=users;this.organizations=organizations;}
    public void ensure(long userId) {
        var user=users.findForMarketplaceReconciliation(userId).orElseThrow();
        if(user.getOrganizationId()!=null)return;
        if(!Boolean.TRUE.equals(user.isEmailVerified()) || user.getStatus()!=UserStatus.ACTIVE)
            throw new org.springframework.security.access.AccessDeniedException("Adresse fournisseur non vérifiée");
        organizations.createForUser(user,user.getFullName(),OrganizationType.INDIVIDUAL);
    }
}
