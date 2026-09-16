package com.clenzy.service.pricing;

import com.clenzy.marketplace.model.PricingModel;
import com.clenzy.model.ProviderTariff;
import com.clenzy.repository.ProviderTariffRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.List;

/** Autorité tarifaire Baitly : aucun paramètre client, organisation ou logement. */
@Service
public class ProviderTariffService {
    public static final String CLEANING = "cleaning-turnover";
    private final ProviderTariffRepository repository;
    private final com.clenzy.service.catalog.ServiceCatalogReference catalog;
    public ProviderTariffService(ProviderTariffRepository repository, com.clenzy.service.catalog.ServiceCatalogReference catalog) {
        this.repository = repository; this.catalog = catalog;
    }
    public String legacyTypeForKey(String key) {
        if (key.startsWith("type:")) return key.substring(5);
        String legacy = catalog.legacyType(key);
        return "OTHER".equals(legacy) ? "catalog:" + key : legacy;
    }

    public String keyForType(String type) {
        if (type.startsWith("catalog:")) return type.substring(8);
        String code = catalog.legacyCode(type);
        return code != null ? code : "type:" + type;
    }

    @Transactional(readOnly = true)
    public List<ProviderTariff> list(Long userId) { return repository.findByUserIdOrderByServiceKeyAsc(userId); }

    @Transactional
    public ProviderTariff set(Long userId, String key, PricingModel model, BigDecimal amount, String currency, boolean enabled) {
        return set(userId, key, model, amount, currency, enabled, null);
    }

    @Transactional
    public ProviderTariff set(Long userId, String key, PricingModel model, BigDecimal amount, String currency, boolean enabled, String unitLabel) {
        if (userId == null || key == null || key.isBlank() || key.length() > 200)
            throw new IllegalArgumentException("Prestation invalide");
        if (model == null) throw new IllegalArgumentException("Modèle de prix requis");
        if (currency == null || !currency.matches("[A-Z]{3}"))
            throw new IllegalArgumentException("Devise requise (code ISO)");
        java.util.Currency.getInstance(currency);
        if (model == PricingModel.PER_UNIT && amount != null && (unitLabel == null || unitLabel.isBlank() || unitLabel.length() > 40))
            throw new IllegalArgumentException("Unité facturée requise");
        if (amount != null && (amount.signum() < 0 || amount.compareTo(new BigDecimal("1000000")) > 0 || amount.stripTrailingZeros().scale() > 2))
            throw new IllegalArgumentException("Montant invalide (0 à 1000000, deux décimales)");
        repository.lockUser(userId);
        ProviderTariff tariff = repository.findByUserIdAndServiceKey(userId, key).orElseGet(() -> {
            ProviderTariff created = new ProviderTariff();
            created.setUserId(userId); created.setServiceKey(key); return created;
        });
        tariff.setPricingModel(amount == null ? PricingModel.ON_QUOTE : model);
        tariff.setAmount(model == PricingModel.ON_QUOTE ? null : amount);
        tariff.setCurrency(currency);
        tariff.setUnitLabel(model == PricingModel.PER_UNIT ? unitLabel : null);
        tariff.setEnabled(enabled);
        tariff.setNeedsReview(false);
        return repository.save(tariff);
    }
}
