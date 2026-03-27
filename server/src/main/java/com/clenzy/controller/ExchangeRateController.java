package com.clenzy.controller;

import com.clenzy.dto.ExchangeRateDto;
import com.clenzy.model.ExchangeRate;
import com.clenzy.repository.ExchangeRateRepository;
import com.clenzy.service.CurrencyConverterService;
import com.clenzy.service.ExchangeRateProviderService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Controller REST pour les taux de change et conversions.
 *
 * Endpoints :
 * - GET  /api/exchange-rates/rate       → taux de change entre deux devises
 * - GET  /api/exchange-rates/convert    → convertir un montant
 * - GET  /api/exchange-rates/matrix     → matrice de tous les taux actuels
 * - GET  /api/exchange-rates/history    → historique des taux (admin)
 * - POST /api/exchange-rates/refresh    → forcer la mise a jour des taux (admin)
 */
@RestController
@RequestMapping("/api/exchange-rates")
@PreAuthorize("isAuthenticated()")
public class ExchangeRateController {

    private static final String[] SUPPORTED_CURRENCIES = {"MAD", "SAR"};

    private final CurrencyConverterService currencyConverter;
    private final ExchangeRateProviderService exchangeRateProvider;
    private final ExchangeRateRepository exchangeRateRepository;

    public ExchangeRateController(CurrencyConverterService currencyConverter,
                                   ExchangeRateProviderService exchangeRateProvider,
                                   ExchangeRateRepository exchangeRateRepository) {
        this.currencyConverter = currencyConverter;
        this.exchangeRateProvider = exchangeRateProvider;
        this.exchangeRateRepository = exchangeRateRepository;
    }

    /**
     * Retourne le taux de change entre deux devises.
     */
    @GetMapping("/rate")
    public ResponseEntity<Map<String, Object>> getRate(
            @RequestParam String from,
            @RequestParam String to,
            @RequestParam(required = false) LocalDate date) {
        LocalDate effectiveDate = date != null ? date : LocalDate.now();
        BigDecimal rate = currencyConverter.getRate(from.toUpperCase(), to.toUpperCase(), effectiveDate);
        return ResponseEntity.ok(Map.of(
            "from", from.toUpperCase(),
            "to", to.toUpperCase(),
            "rate", rate,
            "date", effectiveDate
        ));
    }

    /**
     * Convertit un montant d'une devise vers une autre.
     */
    @GetMapping("/convert")
    public ResponseEntity<Map<String, Object>> convert(
            @RequestParam BigDecimal amount,
            @RequestParam String from,
            @RequestParam String to,
            @RequestParam(required = false) LocalDate date) {
        LocalDate effectiveDate = date != null ? date : LocalDate.now();
        BigDecimal converted = currencyConverter.convert(
            amount, from.toUpperCase(), to.toUpperCase(), effectiveDate);
        BigDecimal rate = currencyConverter.getRate(from.toUpperCase(), to.toUpperCase(), effectiveDate);
        return ResponseEntity.ok(Map.of(
            "amount", amount,
            "from", from.toUpperCase(),
            "to", to.toUpperCase(),
            "converted", converted,
            "rate", rate,
            "date", effectiveDate
        ));
    }

    /**
     * Retourne la matrice de tous les taux actuels (base EUR).
     * Un seul appel pour alimenter la conversion cote client.
     */
    @GetMapping("/matrix")
    public ResponseEntity<Map<String, Object>> getMatrix() {
        LocalDate today = LocalDate.now();
        Map<String, Object> rates = new LinkedHashMap<>();
        rates.put("EUR", BigDecimal.ONE);

        LocalDate latestDate = null;
        for (String target : SUPPORTED_CURRENCIES) {
            var rateOpt = exchangeRateRepository.findLatestRate("EUR", target, today);
            if (rateOpt.isPresent()) {
                rates.put(target, rateOpt.get().getRate());
                if (latestDate == null) {
                    latestDate = rateOpt.get().getRateDate();
                }
            }
        }

        return ResponseEntity.ok(Map.of(
            "base", "EUR",
            "date", latestDate != null ? latestDate.toString() : "",
            "rates", rates
        ));
    }

    /**
     * Retourne l'historique des taux de change (admin seulement).
     *
     * Gere les paires directes (EUR→MAD), inverses (MAD→EUR)
     * et croisees (MAD→SAR) a partir des taux EUR stockes en base.
     */
    @GetMapping("/history")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<List<ExchangeRateDto>> getHistory(
            @RequestParam(required = false) String baseCurrency,
            @RequestParam(required = false) String targetCurrency,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        LocalDate fromDate = from != null ? from : LocalDate.now().minusMonths(3);
        LocalDate toDate = to != null ? to : LocalDate.now();
        int cappedSize = Math.min(size, 200);
        String base = baseCurrency != null ? baseCurrency.toUpperCase() : null;
        String target = targetCurrency != null ? targetCurrency.toUpperCase() : null;

        // Cas sans filtre : toutes les paires directes
        if (base == null || target == null) {
            PageRequest pageRequest = PageRequest.of(page, cappedSize, Sort.by(Sort.Direction.DESC, "rateDate"));
            Page<ExchangeRate> rates = exchangeRateRepository.findByRateDateBetween(fromDate, toDate, pageRequest);
            List<ExchangeRateDto> dtos = rates.map(r -> new ExchangeRateDto(
                r.getId(), r.getBaseCurrency(), r.getTargetCurrency(),
                r.getRate(), r.getRateDate(), r.getSource())).getContent();
            return ResponseEntity.ok(dtos);
        }

        // Paire directe stockee en DB (ex: EUR→MAD)
        if ("EUR".equals(base)) {
            PageRequest pageRequest = PageRequest.of(page, cappedSize, Sort.by(Sort.Direction.DESC, "rateDate"));
            Page<ExchangeRate> rates = exchangeRateRepository.findHistory(base, target, fromDate, toDate, pageRequest);
            List<ExchangeRateDto> dtos = rates.map(r -> new ExchangeRateDto(
                r.getId(), r.getBaseCurrency(), r.getTargetCurrency(),
                r.getRate(), r.getRateDate(), r.getSource())).getContent();
            return ResponseEntity.ok(dtos);
        }

        // Paire inverse (ex: MAD→EUR) : 1 / EUR→MAD
        if ("EUR".equals(target)) {
            PageRequest pageRequest = PageRequest.of(page, cappedSize, Sort.by(Sort.Direction.DESC, "rateDate"));
            Page<ExchangeRate> rates = exchangeRateRepository.findHistory("EUR", base, fromDate, toDate, pageRequest);
            List<ExchangeRateDto> dtos = rates.stream().map(r -> {
                BigDecimal inverse = BigDecimal.ONE.divide(r.getRate(), 6, java.math.RoundingMode.HALF_UP);
                return new ExchangeRateDto(r.getId(), base, "EUR", inverse, r.getRateDate(), r.getSource() + " (calc)");
            }).toList();
            return ResponseEntity.ok(dtos);
        }

        // Paire croisee (ex: MAD→SAR) : EUR→SAR / EUR→MAD par date
        List<ExchangeRate> baseRates = exchangeRateRepository.findAllByBaseCurrencyAndTargetCurrencyAndRateDateBetween(
            "EUR", base, fromDate, toDate);
        List<ExchangeRate> targetRates = exchangeRateRepository.findAllByBaseCurrencyAndTargetCurrencyAndRateDateBetween(
            "EUR", target, fromDate, toDate);

        // Index par date
        Map<LocalDate, BigDecimal> baseByDate = new java.util.HashMap<>();
        for (ExchangeRate r : baseRates) {
            baseByDate.put(r.getRateDate(), r.getRate());
        }

        List<ExchangeRateDto> crossDtos = new java.util.ArrayList<>();
        for (ExchangeRate r : targetRates) {
            BigDecimal baseRate = baseByDate.get(r.getRateDate());
            if (baseRate != null && baseRate.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal crossRate = r.getRate().divide(baseRate, 6, java.math.RoundingMode.HALF_UP);
                crossDtos.add(new ExchangeRateDto(r.getId(), base, target, crossRate, r.getRateDate(), r.getSource() + " (calc)"));
            }
        }

        // Tri par date decroissante + pagination manuelle
        crossDtos.sort((a, b) -> b.rateDate().compareTo(a.rateDate()));
        int fromIndex = Math.min(page * cappedSize, crossDtos.size());
        int toIndex = Math.min(fromIndex + cappedSize, crossDtos.size());

        return ResponseEntity.ok(crossDtos.subList(fromIndex, toIndex));
    }

    /**
     * Force la mise a jour des taux de change depuis la BCE.
     */
    @PostMapping("/refresh")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<Map<String, String>> refresh() {
        exchangeRateProvider.refreshRates();
        return ResponseEntity.ok(Map.of("status", "refreshed"));
    }
}
