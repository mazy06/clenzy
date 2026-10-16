package com.clenzy.marketplace.service;

import com.clenzy.marketplace.dto.CatalogProviderDto;
import com.clenzy.marketplace.model.BaitlyNetworkLink;
import com.clenzy.marketplace.repository.*;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.service.OrganizationService;
import com.clenzy.tenant.TenantContext;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.util.*;
import java.security.*;
import java.nio.charset.StandardCharsets;

@Service @Transactional
public class BaitlyNetworkService {
    private final BaitlyNetworkLinkRepository links;
    private final MarketplaceProviderRepository providers;
    private final MarketplaceCatalogService catalog;
    private final MarketplaceExposureService exposure;
    private final ProviderAccountResolver accounts;
    private final OrganizationService organizations;
    private final OrganizationRepository organizationRepository;
    private final TenantContext tenant;
    private final Clock clock;
    public BaitlyNetworkService(BaitlyNetworkLinkRepository links,MarketplaceProviderRepository providers,
        MarketplaceCatalogService catalog,MarketplaceExposureService exposure,ProviderAccountResolver accounts,
        OrganizationService organizations,OrganizationRepository organizationRepository,TenantContext tenant,Clock clock) {
        this.links=links;this.providers=providers;this.catalog=catalog;this.exposure=exposure;
        this.accounts=accounts;this.organizations=organizations;this.organizationRepository=organizationRepository;this.tenant=tenant;this.clock=clock;
    }
    public record Link(Long id,Long providerId,String providerName,String organizationName,String status,
                       Instant expiresAt,CatalogProviderDto provider){}
    public record Invitation(Link link,String url){}
    /** Annuaire interne existant, limite a l'organisation authentifiee, sans publication. */
    @Transactional(readOnly=true)
    public Page<CatalogProviderDto> members(int page) {
        Long org=tenant.getRequiredOrganizationId();
        return providers.findByHomeOrganizationId(org,PageRequest.of(Math.max(0,page),20,Sort.by("displayName").ascending().and(Sort.by("id"))))
            .map(p -> catalog.getCatalogEntry(p.getId(),org).orElseThrow(BaitlyNetworkService::missing));
    }
    public boolean canManage(String subject) {
        return organizations.canManageOrg(subject,tenant.getRequiredOrganizationId());
    }
    @Transactional(readOnly=true)
    public Page<Link> list(boolean received,String subject,int page) {
        var pagination=PageRequest.of(Math.max(0,page),20,Sort.by("updatedAt").descending());
        var result=received ? links.findByProviderId(accounts.requireProviderId(subject),pagination)
            : links.findByOrganizationId(tenant.getRequiredOrganizationId(),pagination);
        return result.map(n->dto(n,received));
    }
    public Invitation invite(Long providerId,String subject) {
        Long org=tenant.getRequiredOrganizationId();organizations.validateOrgManagement(subject,org);
        // Lock the provider first to serialize creation of the unique relation.
        var provider=providers.findForRating(providerId).orElseThrow(BaitlyNetworkService::missing);
        if(!exposure.isVisibleTo(provider,org))throw missing();
        if(provider.getUserId()==null)throw new ResponseStatusException(HttpStatus.CONFLICT,"Ce prestataire doit activer son compte.");
        var n=links.lockPair(org,providerId).orElseGet(BaitlyNetworkLink::new);
        if("ACTIVE".equals(n.getStatus()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Ce prestataire est déjà dans le réseau.");
        if("INVITED".equals(n.getStatus()) && n.getUpdatedAt().plusSeconds(60).isAfter(clock.instant()))
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Attendez avant de renouveler l'invitation.");
        String token=UUID.randomUUID().toString()+UUID.randomUUID();
        n.setOrganizationId(org);n.setProviderId(providerId);n.setStatus("INVITED");
        n.setTokenHash(hash(token));n.setExpiresAt(clock.instant().plus(Duration.ofDays(7)));n.setUpdatedAt(clock.instant());
        links.saveAndFlush(n);
        return new Invitation(dto(n,false),"clenzy://network-invitation?token="+token);
    }
    public Link accept(String token,String subject) {
        if(token==null || token.length()!=72)throw missing();
        var n=links.lockToken(hash(token)).orElseThrow(BaitlyNetworkService::missing);
        authorizeRecipient(n,subject);
        if(!"INVITED".equals(n.getStatus()) || n.getExpiresAt()==null || !n.getExpiresAt().isAfter(clock.instant()))
            throw new ResponseStatusException(HttpStatus.GONE,"Invitation expirée ou déjà utilisée.");
        n.setStatus("ACTIVE");n.setTokenHash(null);n.setExpiresAt(null);n.setUpdatedAt(clock.instant());
        return dto(links.save(n),true);
    }
    public Link decide(Long id,boolean accept,String subject) {
        var n=links.lockId(id).orElseThrow(BaitlyNetworkService::missing);authorizeRecipient(n,subject);
        if(accept) {
            if(!"INVITED".equals(n.getStatus()) || !n.getExpiresAt().isAfter(clock.instant()))
                throw new ResponseStatusException(HttpStatus.GONE,"Invitation expirée ou déjà utilisée.");
            n.setStatus("ACTIVE");
        } else n.setStatus("REVOKED");
        n.setTokenHash(null);n.setExpiresAt(null);n.setUpdatedAt(clock.instant());return dto(links.save(n),true);
    }
    public void revoke(Long id,String subject) {
        Long org=tenant.getRequiredOrganizationId();organizations.validateOrgManagement(subject,org);
        var n=links.lockId(id).orElseThrow(BaitlyNetworkService::missing);
        if(!org.equals(n.getOrganizationId()))throw missing();
        n.setStatus("REVOKED");n.setTokenHash(null);n.setExpiresAt(null);n.setUpdatedAt(clock.instant());links.save(n);
    }
    private void authorizeRecipient(BaitlyNetworkLink n,String subject) {
        if(!n.getProviderId().equals(accounts.requireProviderId(subject)))throw missing();
    }
    private Link dto(BaitlyNetworkLink n,boolean received) {
        var p=providers.findById(n.getProviderId()).orElse(null);
        boolean visible=p!=null && (received || exposure.isVisibleTo(p,n.getOrganizationId()));
        var entry=visible && !received && "ACTIVE".equals(n.getStatus()) ? catalog.getCatalogEntry(n.getProviderId(),n.getOrganizationId()).orElse(null) : null;
        var org=organizationRepository.findById(n.getOrganizationId()).map(o->o.getName()).orElse("");
        String status="INVITED".equals(n.getStatus()) && !n.getExpiresAt().isAfter(clock.instant()) ? "EXPIRED" : n.getStatus();
        return new Link(n.getId(),n.getProviderId(),visible?p.getDisplayName():null,org,status,n.getExpiresAt(),entry);
    }
    static String hash(String token) {
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));}
        catch(NoSuchAlgorithmException impossible){throw new IllegalStateException(impossible);}
    }
    private static ResponseStatusException missing(){return new ResponseStatusException(HttpStatus.NOT_FOUND,"Relation indisponible.");}
}
