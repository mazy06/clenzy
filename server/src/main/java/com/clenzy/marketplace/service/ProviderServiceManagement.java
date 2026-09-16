package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.*;
import com.clenzy.model.ProviderTariff;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.pricing.ProviderTariffService;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

/** Édition personnelle des prestations ; le prix reste exclusivement dans provider_tariffs. */
@Service
public class ProviderServiceManagement {
    private final ProviderDocumentaryService documentary;
    private final UserRepository users;
    private final ProviderTariffService tariffs;
    private final MarketplaceProviderRepository providers;
    private final MarketplaceProviderOfferRepository offers;
    private final MarketplaceServiceItemRepository items;

    public ProviderServiceManagement(UserRepository users, ProviderTariffService tariffs,
            MarketplaceProviderRepository providers, MarketplaceProviderOfferRepository offers,
            MarketplaceServiceItemRepository items, ProviderDocumentaryService documentary) {
        this.documentary=documentary;
        this.users=users; this.tariffs=tariffs; this.providers=providers; this.offers=offers; this.items=items;
    }
    public record Command(PricingModel pricingModel, BigDecimal amount, String currency, String unitLabel, boolean enabled) {}
    public record Option(String key, String labelFr, String labelEn) {}
    public record Row(String key, String label, PricingModel pricingModel, BigDecimal amount,
                      String currency, String unitLabel, boolean enabled, boolean needsReview) {}
    public record View(List<Row> services, List<Option> options) {}

    @Transactional(readOnly=true)
    public View mine(String subject) {
        Long userId=owner(subject);
        var catalogue=items.findAllActiveWithCategory();
        var labels=catalogue.stream().collect(java.util.stream.Collectors.toMap(MarketplaceServiceItem::getCode, MarketplaceServiceItem::getLabelFr));
        return new View(tariffs.list(userId).stream().map(t -> row(t,labels.getOrDefault(t.getServiceKey(),t.getServiceKey()))).toList(),
            catalogue.stream().map(i -> new Option(i.getCode(),i.getLabelFr(),i.getLabelEn())).toList());
    }

    @Transactional
    public Row replace(String subject, String key, Command command) {
        Long userId=owner(subject);
        if (command==null || command.pricingModel()==null) throw new IllegalArgumentException("Tarif requis");
        var item=items.findByCode(key).orElse(null);
        boolean existing=tariffs.list(userId).stream().anyMatch(t -> t.getServiceKey().equals(key));
        if (!existing && (item==null || !item.isActive() || !item.getCategory().isActive()))
            throw new IllegalArgumentException("Prestation inconnue ou inactive");
        if (command.pricingModel()!=PricingModel.ON_QUOTE && command.amount()==null)
            throw new IllegalArgumentException("Montant requis");
        var profile=providers.findByUserId(userId).orElse(null);
        if(profile!=null && profile.getStatus()==ProviderStatus.ACTIVE && command.enabled()
                && !documentary.hasReviewedScope(profile.getId(),"ITEM:"+key))
            throw new IllegalStateException("Revue documentaire requise avant activation de cette prestation");
        var tariff=tariffs.set(userId,key,command.pricingModel(),command.amount(),command.currency(),command.enabled(),command.unitLabel());
        // Référence vers le tarif canonique ; aucune copie de prix sur la fiche.
        var provider=providers.findByUserId(userId).orElse(null);
        if (provider!=null) {
            var linked=offers.findAllByProviderIdWithCategory(provider.getId()).stream()
                .filter(o -> o.getTariff()!=null && Objects.equals(o.getTariff().getId(),tariff.getId())).toList();
            if (linked.isEmpty() && item!=null && item.isActive() && item.getCategory().isActive()) {
                var offer=new MarketplaceProviderOffer();
                offer.setProvider(provider); offer.setServiceItem(item); offer.setCategory(item.getCategory());
                offer.setLabel(item.getLabelFr()); offer.setTariff(tariff); offer.setActive(command.enabled());
                offers.save(offer);
            } else for (var offer:linked) {
                offer.setActive(command.enabled()); offers.save(offer);
            }
        }
        return row(tariff,item==null ? key : item.getLabelFr());
    }
    private Row row(ProviderTariff t,String label) {
        return new Row(t.getServiceKey(),label,t.getPricingModel(),t.getAmount(),t.getCurrency(),t.getUnitLabel(),t.isEnabled(),t.isNeedsReview());
    }
    private Long owner(String subject) {
        if(subject==null || subject.isBlank()) throw new AccessDeniedException("Identité requise");
        return users.findByKeycloakId(subject).orElseThrow(() -> new AccessDeniedException("Compte introuvable")).getId();
    }
}

