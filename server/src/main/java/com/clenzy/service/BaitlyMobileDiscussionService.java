package com.clenzy.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.marketplace.service.*;
import com.clenzy.marketplace.repository.MarketplaceQuoteRequestRepository;
import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

/** Résout le fil existant ; chaque ouverture recontrôle les droits métier. */
@Service @Transactional
public class BaitlyMobileDiscussionService {
    private final ContactThreadService threads;
    private final MarketplaceQuoteService quotes;
    private final ProviderAccountResolver accounts;
    private final InterventionRepository missions;
    private final InterventionAccessPolicy access;
    private final QuoteDiscussionScope scope;
    private final MarketplaceQuoteRequestRepository requests;
    private final TenantContext tenant;
    public BaitlyMobileDiscussionService(ContactThreadService threads,MarketplaceQuoteService quotes,ProviderAccountResolver accounts,
        InterventionRepository missions,InterventionAccessPolicy access,QuoteDiscussionScope scope,MarketplaceQuoteRequestRepository requests,TenantContext tenant) {
        this.threads=threads;this.quotes=quotes;this.accounts=accounts;this.missions=missions;this.access=access;this.scope=scope;this.requests=requests;this.tenant=tenant;
    }
    public Map<String,String> open(String kind,Long id,Jwt jwt) {
        ContactThread thread;
        if("quote".equals(kind)) {
            var q=quotes.getFor(id,tenant.getRequiredOrganizationId(),accounts.providerIdOrNull(jwt.getSubject()),accounts.userIdOf(jwt.getSubject()),jwt);
            thread=threads.findByReference(q.getRequesterOrganizationId(),"MARKETPLACE_QUOTE",id)
                .orElseThrow(()->new NotFoundException("Discussion en préparation. Réessayez dans un instant."));
        } else if("mission".equals(kind)) {
            var m=missions.findById(id).orElseThrow(()->new NotFoundException("Mission indisponible."));
            access.assertCanAccess(m,jwt);
            var q=requests.findFirstByInterventionIdOrderByIdDesc(id);
            if(q.isPresent()) return open("quote",q.get().getId(),jwt);
            Set<String> members=new HashSet<>(scope.members(m.getTeamId()));
            if(m.getAssignedUser()!=null)members.add(m.getAssignedUser().getKeycloakId());
            if(m.getRequestor()!=null)members.add(m.getRequestor().getKeycloakId());
            if(m.getProperty()!=null && m.getProperty().getOwner()!=null)members.add(m.getProperty().getOwner().getKeycloakId());
            members.remove(null);
            thread=threads.openThread(m.getOrganizationId(),m.getTitle(),ContactMessageCategory.GENERAL,
                jwt.getSubject(),"BAITLY_MISSION",id,members);
        } else throw new IllegalArgumentException("Discussion inconnue.");
        threads.messages(thread.getId(),jwt.getSubject());
        return Map.of("threadKey",ContactThreadService.groupKey(thread.getId()));
    }
}
