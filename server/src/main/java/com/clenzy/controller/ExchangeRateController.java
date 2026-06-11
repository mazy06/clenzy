package com.clenzy.controller;

import com.clenzy.dto.ExchangeRateDto;
import com.clenzy.service.CurrencyConverterService;
import com.clenzy.service.ExchangeRateProviderService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
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
 *
 * Acces donnees et calculs (matrice, paires inverses/croisees) au niveau
 * service ({@link ExchangeRateProviderService}) — audit T-ARCH-01.
 */
@RestController
@RequestMapping("/api/exchange-rates")
@PreAuthorize("isAuthenticated()")
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
     * Retourne la matrice de tous les taux actuels (base EUR).
     * Un seul appel pour alimenter la conversion cote client.
     */
    @GetMapping("/matrix")
    public ResponseEntity<Map<String, Object>> getMatrix() {
        ExchangeRateProviderService.RateMatrix matrix = exchangeRateProvider.getLatestMatrix();
        return ResponseEntity.ok(Map.of(
            "base", "EUR",
            "date", matrix.date() != null ? matrix.date().toString() : "",
            "rates", matrix.rates()
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

        return ResponseEntity.ok(exchangeRateProvider.getHistory(baseCurrency, targetCurrency, from, to, page, size));
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
