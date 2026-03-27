package com.clenzy.service;

import com.clenzy.model.ExchangeRate;
import com.clenzy.repository.ExchangeRateRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import jakarta.annotation.PostConstruct;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

/**
 * Service de fourniture des taux de change.
 *
 * Responsabilites :
 * - Recuperer les taux de change depuis open.er-api.com
 * - Persister les taux journaliers en base
 * - Fournir le taux le plus recent pour une paire de devises
 * - Job planifie quotidien pour mise a jour automatique
 *
 * Devises cibles : MAD (Dirham marocain), SAR (Riyal saoudien)
 * Devise de base : EUR
 */
@Service
public class ExchangeRateProviderService {

    private static final Logger log = LoggerFactory.getLogger(ExchangeRateProviderService.class);
    private static final String OPEN_ER_API = "https://open.er-api.com/v6/latest/EUR";
    private static final String[] TARGET_CURRENCIES = {"MAD", "SAR"};

    private final ExchangeRateRepository exchangeRateRepository;
    private final RestTemplate restTemplate;

    public ExchangeRateProviderService(ExchangeRateRepository exchangeRateRepository,
                                        RestTemplate restTemplate) {
        this.exchangeRateRepository = exchangeRateRepository;
        this.restTemplate = restTemplate;
    }

    /**
     * Charge les taux manquants au demarrage de l'application.
     * Verifie si les taux du jour existent, sinon les recupere.
     */
    @PostConstruct
    public void initRatesOnStartup() {
        LocalDate today = LocalDate.now();
        boolean allPresent = true;

        for (String cur : TARGET_CURRENCIES) {
            if (exchangeRateRepository.findLatestRate("EUR", cur, today).isEmpty()) {
                allPresent = false;
                break;
            }
        }

        if (!allPresent) {
            log.info("Missing exchange rates for MAD/SAR — fetching on startup...");
            try {
                fetchRates(today);
            } catch (Exception e) {
                log.warn("Failed to fetch rates on startup: {}", e.getMessage());
            }
        }
    }

    /**
     * Retourne le taux de change le plus recent pour une paire de devises.
     * Si base == target, retourne 1.0.
     */
    @Transactional(readOnly = true)
    public BigDecimal getRate(String baseCurrency, String targetCurrency, LocalDate date) {
        if (baseCurrency.equalsIgnoreCase(targetCurrency)) {
            return BigDecimal.ONE;
        }

        Optional<ExchangeRate> rateOpt = exchangeRateRepository.findLatestRate(
            baseCurrency.toUpperCase(), targetCurrency.toUpperCase(), date);

        if (rateOpt.isPresent()) {
            return rateOpt.get().getRate();
        }

        // Essayer la paire inverse
        Optional<ExchangeRate> inverseOpt = exchangeRateRepository.findLatestRate(
            targetCurrency.toUpperCase(), baseCurrency.toUpperCase(), date);

        if (inverseOpt.isPresent()) {
            BigDecimal inverseRate = inverseOpt.get().getRate();
            if (inverseRate.compareTo(BigDecimal.ZERO) > 0) {
                return BigDecimal.ONE.divide(inverseRate, 6, java.math.RoundingMode.HALF_UP);
            }
        }

        log.warn("No exchange rate found for {}/{} at {}", baseCurrency, targetCurrency, date);
        throw new IllegalStateException(
            "Taux de change introuvable pour " + baseCurrency + "/" + targetCurrency
            + " a la date " + date);
    }

    /**
     * Recupere et persiste les taux de change depuis open.er-api.com.
     * Execute quotidiennement a 07:00 UTC.
     */
    @Scheduled(cron = "0 0 7 * * *")
    @Transactional
    public void fetchDailyRates() {
        log.info("Fetching daily exchange rates...");
        fetchRates(LocalDate.now());
    }

    private void fetchRates(LocalDate today) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.getForObject(OPEN_ER_API, Map.class);

            if (response == null || !response.containsKey("rates")) {
                log.warn("Empty response from Open Exchange Rates API");
                return;
            }

            @SuppressWarnings("unchecked")
            Map<String, Number> allRates = (Map<String, Number>) response.get("rates");

            for (String cur : TARGET_CURRENCIES) {
                if (allRates.containsKey(cur)) {
                    BigDecimal rate = new BigDecimal(allRates.get(cur).toString());

                    if (exchangeRateRepository.findByBaseCurrencyAndTargetCurrencyAndRateDate(
                            "EUR", cur, today).isEmpty()) {
                        ExchangeRate exchangeRate = new ExchangeRate("EUR", cur, rate, today);
                        exchangeRate.setSource("OPEN_ER");
                        exchangeRateRepository.save(exchangeRate);
                        log.info("Saved exchange rate: EUR/{} = {} ({})", cur, rate, today);
                    }
                }
            }

            log.info("Exchange rates updated for {} (MAD, SAR)", today);
        } catch (Exception e) {
            log.error("Failed to fetch exchange rates: {}", e.getMessage(), e);
        }
    }

    /**
     * Force la mise a jour des taux (appel manuel depuis l'API admin).
     */
    @Transactional
    public void refreshRates() {
        fetchDailyRates();
    }
}
