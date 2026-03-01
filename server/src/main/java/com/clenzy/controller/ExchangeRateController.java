package com.clenzy.controller;

import com.clenzy.service.CurrencyConverterService;
import com.clenzy.service.ExchangeRateProviderService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

/**
 * Controller REST pour les taux de change et conversions.
 *
 * Endpoints :
 * - GET  /api/exchange-rates/rate       → taux de change entre deux devises
 * - GET  /api/exchange-rates/convert    → convertir un montant
 * - POST /api/exchange-rates/refresh    → forcer la mise a jour des taux
 */
@RestController
@RequestMapping("/api/exchange-rates")
public class ExchangeRateController {

    private final CurrencyConverterService currencyConverter;
    private final ExchangeRateProviderService exchangeRateProvider;

    public ExchangeRateController(CurrencyConverterService currencyConverter,
                                   ExchangeRateProviderService exchangeRateProvider) {
        this.currencyConverter = currencyConverter;
        this.exchangeRateProvider = exchangeRateProvider;
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
     * Force la mise a jour des taux de change depuis la BCE.
     */
    @PostMapping("/refresh")
    public ResponseEntity<Map<String, String>> refresh() {
        exchangeRateProvider.refreshRates();
        return ResponseEntity.ok(Map.of("status", "refreshed"));
    }
}
