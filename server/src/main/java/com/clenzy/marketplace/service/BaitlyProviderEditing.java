package com.clenzy.marketplace.service;

import com.clenzy.marketplace.repository.*;
import com.clenzy.marketplace.model.MarketplaceProviderOffer;
import com.clenzy.marketplace.model.MarketplaceServiceItem;
import com.clenzy.repository.ProviderTariffRepository;
import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

/** Édition administrative explicite ; tarifs et décisions restent dans leurs parcours dédiés. */
@Service
public class BaitlyProviderEditing {
    private final MarketplaceProviderRepository providers;
    private final MarketplaceServiceItemRepository items;
    private final MarketplaceProviderOfferRepository offers;
    private final ProviderTariffRepository tariffs;
    private final MarketplaceDecisionJournal journal;
    public BaitlyProviderEditing(MarketplaceProviderRepository providers, MarketplaceServiceItemRepository items,
            MarketplaceProviderOfferRepository offers, ProviderTariffRepository tariffs, MarketplaceDecisionJournal journal) {
        this.providers=providers; this.items=items; this.offers=offers; this.tariffs=tariffs; this.journal=journal;
    }
    public record Reference(@NotNull Long offerId, @NotBlank @Size(max=60) String serviceItemCode) {}
    public record Services(@NotNull @Size(max=200) List<@NotBlank @Size(max=60) String> codes) {}

    /** Sélection multi-métiers : désactiver conserve les prix et l'historique des offres. */
    @Transactional
    public void selectServices(Long id, Services selection, String actor) {
        var provider=providers.findById(id).orElseThrow(() -> new EntityNotFoundException("Prestataire introuvable"));
        if(provider.getUserId()!=null) tariffs.lockUser(provider.getUserId());
        var current=offers.findAllByProviderIdWithCategory(id);
        var codes=new LinkedHashSet<>(selection.codes());
        if(codes.size()!=selection.codes().size()) throw new IllegalArgumentException("Prestation en double");
        var selected=new LinkedHashMap<String,MarketplaceServiceItem>();
        for(String code:codes) {
            var item=items.findByCode(code).filter(i -> i.isActive() && i.getCategory().isActive())
                .orElseThrow(() -> new IllegalArgumentException("Prestation inconnue ou inactive : "+code));
            selected.put(code,item);
        }
        // Un tarif désactivé reste la source de vérité ; ne pas le contourner avec une offre sans tarif.
        for(String code:codes) {
            if(current.stream().anyMatch(o -> o.getServiceItem()!=null && code.equals(o.getServiceItem().getCode())
                    && o.getTariff()!=null && !o.getTariff().isEnabled()))
                throw new IllegalArgumentException("Activez d'abord le tarif de cette prestation dans les prestations du compte : "+code);
            if(provider.getUserId()!=null && tariffs.findByUserIdAndServiceKey(provider.getUserId(),code).filter(t -> !t.isEnabled()).isPresent())
                throw new IllegalArgumentException("Activez d'abord le tarif de cette prestation dans les prestations du compte : "+code);
        }
        for(var offer:current) {
            var item=offer.getServiceItem();
            if(item==null || !item.isActive() || !item.getCategory().isActive()) continue;
            offer.setActive(codes.contains(item.getCode()));
            offers.save(offer);
        }
        for(var item:selected.values()) {
            if(current.stream().anyMatch(o -> o.getServiceItem()!=null && item.getCode().equals(o.getServiceItem().getCode()))) continue;
            var offer=new MarketplaceProviderOffer();
            offer.setProvider(provider); offer.setServiceItem(item); offer.setCategory(item.getCategory());
            String label=item.getLabelFr(); offer.setLabel(label.length()>120 ? label.substring(0,120) : label);
            offer.setCurrency(provider.getCurrency()==null ? "EUR" : provider.getCurrency());
            if(provider.getUserId()!=null) tariffs.findByUserIdAndServiceKey(provider.getUserId(),item.getCode()).ifPresent(offer::setTariff);
            offer.setSortOrder(current.size()+selected.size()); offers.save(offer);
        }
        journal.record(id,"SERVICES_EDIT",null,String.join(",",codes),actor);
    }
    public record Command(@NotBlank @Size(max=120) String displayName, @Size(max=120) String legalName,
            @Size(max=200) String headline, @Size(max=2000) String bio, @Size(max=40) String phone,
            @Size(max=200) String baseAddress, @Size(max=80) String baseCity, @Size(max=10) String basePostalCode,
            @NotBlank String baseCountryCode, @Min(0) @Max(1000) Integer travelRadiusKm,
            @Size(max=20) List<@Pattern(regexp="[a-z]{2}") String> languages, boolean acceptsUrgent,
            @NotNull @Size(max=100) List<@Valid Reference> references,
            @Size(max=200) List<@NotBlank @Size(max=60) String> selectedServiceCodes) {
        public Command(String displayName,String legalName,String headline,String bio,String phone,String baseAddress,
                String baseCity,String basePostalCode,String baseCountryCode,Integer travelRadiusKm,List<String> languages,
                boolean acceptsUrgent,List<Reference> references) {
            this(displayName,legalName,headline,bio,phone,baseAddress,baseCity,basePostalCode,baseCountryCode,
                travelRadiusKm,languages,acceptsUrgent,references,null);
        }
    }

    @Transactional
    public void update(Long id, Command command, String actor) {
        var provider=providers.findById(id).orElseThrow(() -> new EntityNotFoundException("Prestataire introuvable"));
        String country=ProviderDocumentaryService.country(command.baseCountryCode());
        var current=offers.findAllByProviderIdWithCategory(id);
        var byId=current.stream().collect(java.util.stream.Collectors.toMap(o -> o.getId(),o -> o));
        var seen=new HashSet<Long>();
        if(provider.getUserId()!=null) tariffs.lockUser(provider.getUserId());
        for(var reference:command.references()) {
            if(!seen.add(reference.offerId())) throw new IllegalArgumentException("Prestation en double");
            var offer=byId.get(reference.offerId());
            if(offer==null) throw new AccessDeniedException("Cette prestation appartient à un autre prestataire");
            var item=items.findByCode(reference.serviceItemCode()).filter(i -> i.isActive() && i.getCategory().isActive())
                .orElseThrow(() -> new IllegalArgumentException("Prestation inconnue ou inactive"));
            if(offer.getServiceItem()!=null && item.getCode().equals(offer.getServiceItem().getCode())) continue;
            if(offer.getTariff()!=null) {
                var tariff=offer.getTariff();
                if(!Objects.equals(tariff.getUserId(),provider.getUserId())) throw new AccessDeniedException("Tarif d'un autre compte");
                var target=tariffs.findByUserIdAndServiceKey(provider.getUserId(),item.getCode());
                if(target.isPresent() && !target.get().getId().equals(tariff.getId()))
                    throw new IllegalArgumentException("Un tarif existe déjà pour cette prestation. Modifiez-le dans les prestations du compte.");
                if(current.stream().anyMatch(o -> !o.getId().equals(offer.getId()) && o.getTariff()!=null && Objects.equals(o.getTariff().getId(),tariff.getId())))
                    throw new IllegalArgumentException("Ce tarif est partagé entre plusieurs offres. Modifiez-le dans les prestations du compte.");
                tariff.setServiceKey(item.getCode()); tariffs.save(tariff);
            }
            offer.setServiceItem(item); offer.setCategory(item.getCategory()); offers.save(offer);
        }
        String before=provider.getDisplayName();
        provider.setDisplayName(command.displayName().trim()); provider.setLegalName(text(command.legalName()));
        provider.setHeadline(text(command.headline())); provider.setBio(text(command.bio())); provider.setPhone(text(command.phone()));
        provider.setBaseAddress(text(command.baseAddress())); provider.setBaseCity(text(command.baseCity()));
        provider.setBasePostalCode(text(command.basePostalCode())); provider.setBaseCountryCode(country);
        provider.setTravelRadiusKm(command.travelRadiusKm());
        provider.setLanguages(command.languages()==null ? null : String.join(",",new LinkedHashSet<>(command.languages())));
        provider.setAcceptsUrgent(command.acceptsUrgent()); providers.save(provider);
        if(command.selectedServiceCodes()!=null) selectServices(id,new Services(command.selectedServiceCodes()),actor);
        journal.record(id,"PROFILE_EDIT",before,provider.getDisplayName(),actor);
    }
    private static String text(String value) { return value==null || value.isBlank() ? null : value.trim(); }
}
