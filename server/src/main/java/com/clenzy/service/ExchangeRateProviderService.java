package com.clenzy.service;

import com.clenzy.model.ExchangeRate;
import com.clenzy.repository.ExchangeRateRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

/**
 * Service de fourniture des taux de change.
 *
 * Responsabilites :
 * - Recuperer les taux de change depuis la BCE (European Central Bank)
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
    private static final String ECB_API = "https://api.frankfurter.app";
    private static final String[] TARGET_CURRENCIES = {"MAD", "SAR", "USD", "GBP"};

    private final ExchangeRateRepository exchangeRateRepository;
    private final RestTemplate restTemplate;

    public ExchangeRateProviderService(ExchangeRateRepository exchangeRateRepository,
                                        RestTemplate restTemplate) {
        this.exchangeRateRepository = exchangeRateRepository;
        this.restTemplate = restTemplate;
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

        // Chercher dans la base
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
     * Recupere et persiste les taux de change depuis la BCE.
     * Execute quotidiennement a 07:00 UTC (apres publication BCE a ~16:00 CET J-1).
     */
    @Scheduled(cron = "0 0 7 * * *")
    @Transactional
    public void fetchDailyRates() {
        log.info("Fetching daily exchange rates from ECB...");
        LocalDate today = LocalDate.now();

        try {
            String url = ECB_API + "/latest?from=EUR&to=" + String.join(",", TARGET_CURRENCIES);

            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);

            if (response == null || !response.containsKey("rates")) {
                log.warn("Empty response from ECB API");
                return;
            }

            @SuppressWarnings("unchecked")
            Map<String, Number> rates = (Map<String, Number>) response.get("rates");
            String dateStr = (String) response.get("date");
            LocalDate rateDate = dateStr != null ? LocalDate.parse(dateStr) : today;

            for (Map.Entry<String, Number> entry : rates.entrySet()) {
                String targetCurrency = entry.getKey();
                BigDecimal rate = new BigDecimal(entry.getValue().toString());

                // Upsert : ignorer si deja present pour cette date
                if (exchangeRateRepository.findByBaseCurrencyAndTargetCurrencyAndRateDate(
                        "EUR", targetCurrency, rateDate).isEmpty()) {
                    ExchangeRate exchangeRate = new ExchangeRate("EUR", targetCurrency, rate, rateDate);
                    exchangeRate.setSource("ECB");
                    exchangeRateRepository.save(exchangeRate);
                    log.info("Saved exchange rate: EUR/{} = {} ({})", targetCurrency, rate, rateDate);
                }
            }

            log.info("Exchange rates updated successfully for {}", rateDate);
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
