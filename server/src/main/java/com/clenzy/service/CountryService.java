package com.clenzy.service;

import com.clenzy.config.FiscalProperties;
import com.clenzy.model.Country;
import com.clenzy.repository.CountryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Seam de resolution du socle multi-pays.
 *
 * Source unique pour lire la configuration d'un pays et savoir s'il est exploitable,
 * en respectant le flag {@code fiscal.multi-country.enabled} (rollout progressif).
 *
 * Non-regression France : la France reste toujours operationnelle, meme flag desactive.
 * Quand le flag est OFF, seule la France est consideree active ; quand il est ON,
 * les pays exploitables sont ceux marques {@code enabled=true} en base.
 */
@Service
public class CountryService {

    private static final String DEFAULT_COUNTRY = "FR";

    private final CountryRepository countryRepository;
    private final FiscalProperties fiscalProperties;

    public CountryService(CountryRepository countryRepository, FiscalProperties fiscalProperties) {
        this.countryRepository = countryRepository;
        this.fiscalProperties = fiscalProperties;
    }

    @Transactional(readOnly = true)
    public Optional<Country> findByCode(String countryCode) {
        if (countryCode == null || countryCode.isBlank()) {
            return Optional.empty();
        }
        return countryRepository.findByCountryCode(countryCode.trim().toUpperCase());
    }

    /**
     * Pays actifs pour l'exploitation. Si le multi-pays est desactive, seule la France.
     */
    @Transactional(readOnly = true)
    public List<Country> getActiveCountries() {
        if (!fiscalProperties.isEnabled()) {
            return countryRepository.findByCountryCode(DEFAULT_COUNTRY)
                    .map(List::of)
                    .orElseGet(List::of);
        }
        return countryRepository.findByEnabledTrue();
    }

    /**
     * Un pays est exploitable s'il s'agit de la France (toujours), ou si le multi-pays
     * est active ET que le pays est marque {@code enabled}.
     */
    @Transactional(readOnly = true)
    public boolean isOperational(String countryCode) {
        if (countryCode == null || countryCode.isBlank()) {
            return false;
        }
        String code = countryCode.trim().toUpperCase();
        if (DEFAULT_COUNTRY.equals(code)) {
            return true;
        }
        if (!fiscalProperties.isEnabled()) {
            return false;
        }
        return countryRepository.findByCountryCode(code)
                .map(Country::isEnabled)
                .orElse(false);
    }
}
