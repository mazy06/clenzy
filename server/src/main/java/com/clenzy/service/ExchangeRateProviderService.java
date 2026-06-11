package com.clenzy.service;

import com.clenzy.dto.ExchangeRateDto;
import com.clenzy.model.ExchangeRate;
import com.clenzy.repository.ExchangeRateRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import jakarta.annotation.PostConstruct;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
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

    /** Matrice des derniers taux base EUR (deplace de ExchangeRateController, T-ARCH-01). */
    public record RateMatrix(LocalDate date, Map<String, BigDecimal> rates) {}

    /**
     * Matrice de tous les taux actuels (base EUR) pour les devises supportees.
     * Un seul appel pour alimenter la conversion cote client.
     */
    @Transactional(readOnly = true)
    public RateMatrix getLatestMatrix() {
        LocalDate today = LocalDate.now();
        Map<String, BigDecimal> rates = new LinkedHashMap<>();
        rates.put("EUR", BigDecimal.ONE);

        LocalDate latestDate = null;
        for (String target : TARGET_CURRENCIES) {
            var rateOpt = exchangeRateRepository.findLatestRate("EUR", target, today);
            if (rateOpt.isPresent()) {
                rates.put(target, rateOpt.get().getRate());
                if (latestDate == null) {
                    latestDate = rateOpt.get().getRateDate();
                }
            }
        }

        return new RateMatrix(latestDate, rates);
    }

    /**
     * Historique des taux de change (deplace de ExchangeRateController, T-ARCH-01).
     *
     * Gere les paires directes (EUR→MAD), inverses (MAD→EUR)
     * et croisees (MAD→SAR) a partir des taux EUR stockes en base.
     */
    @Transactional(readOnly = true)
    public List<ExchangeRateDto> getHistory(String baseCurrency, String targetCurrency,
                                            LocalDate from, LocalDate to, int page, int size) {
        LocalDate fromDate = from != null ? from : LocalDate.now().minusMonths(3);
        LocalDate toDate = to != null ? to : LocalDate.now();
        int cappedSize = Math.min(size, 200);
        String base = baseCurrency != null ? baseCurrency.toUpperCase() : null;
        String target = targetCurrency != null ? targetCurrency.toUpperCase() : null;

        // Cas sans filtre : toutes les paires directes
        if (base == null || target == null) {
            PageRequest pageRequest = PageRequest.of(page, cappedSize, Sort.by(Sort.Direction.DESC, "rateDate"));
            Page<ExchangeRate> rates = exchangeRateRepository.findByRateDateBetween(fromDate, toDate, pageRequest);
            return rates.map(this::toDto).getContent();
        }

        // Paire directe stockee en DB (ex: EUR→MAD)
        if ("EUR".equals(base)) {
            PageRequest pageRequest = PageRequest.of(page, cappedSize, Sort.by(Sort.Direction.DESC, "rateDate"));
            Page<ExchangeRate> rates = exchangeRateRepository.findHistory(base, target, fromDate, toDate, pageRequest);
            return rates.map(this::toDto).getContent();
        }

        // Paire inverse (ex: MAD→EUR) : 1 / EUR→MAD
        if ("EUR".equals(target)) {
            PageRequest pageRequest = PageRequest.of(page, cappedSize, Sort.by(Sort.Direction.DESC, "rateDate"));
            Page<ExchangeRate> rates = exchangeRateRepository.findHistory("EUR", base, fromDate, toDate, pageRequest);
            return rates.stream().map(r -> {
                BigDecimal inverse = BigDecimal.ONE.divide(r.getRate(), 6, RoundingMode.HALF_UP);
                return new ExchangeRateDto(r.getId(), base, "EUR", inverse, r.getRateDate(), r.getSource() + " (calc)");
            }).toList();
        }

        // Paire croisee (ex: MAD→SAR) : EUR→SAR / EUR→MAD par date
        List<ExchangeRate> baseRates = exchangeRateRepository.findAllByBaseCurrencyAndTargetCurrencyAndRateDateBetween(
            "EUR", base, fromDate, toDate);
        List<ExchangeRate> targetRates = exchangeRateRepository.findAllByBaseCurrencyAndTargetCurrencyAndRateDateBetween(
            "EUR", target, fromDate, toDate);

        // Index par date
        Map<LocalDate, BigDecimal> baseByDate = new HashMap<>();
        for (ExchangeRate r : baseRates) {
            baseByDate.put(r.getRateDate(), r.getRate());
        }

        List<ExchangeRateDto> crossDtos = new ArrayList<>();
        for (ExchangeRate r : targetRates) {
            BigDecimal baseRate = baseByDate.get(r.getRateDate());
            if (baseRate != null && baseRate.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal crossRate = r.getRate().divide(baseRate, 6, RoundingMode.HALF_UP);
                crossDtos.add(new ExchangeRateDto(r.getId(), base, target, crossRate, r.getRateDate(), r.getSource() + " (calc)"));
            }
        }

        // Tri par date decroissante + pagination manuelle
        crossDtos.sort((a, b) -> b.rateDate().compareTo(a.rateDate()));
        int fromIndex = Math.min(page * cappedSize, crossDtos.size());
        int toIndex = Math.min(fromIndex + cappedSize, crossDtos.size());

        return crossDtos.subList(fromIndex, toIndex);
    }

    private ExchangeRateDto toDto(ExchangeRate r) {
        return new ExchangeRateDto(r.getId(), r.getBaseCurrency(), r.getTargetCurrency(),
                r.getRate(), r.getRateDate(), r.getSource());
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
