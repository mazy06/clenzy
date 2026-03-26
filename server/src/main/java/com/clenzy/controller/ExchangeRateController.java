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

    private static final String[] SUPPORTED_CURRENCIES = {"MAD", "SAR", "USD", "GBP"};

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
     */
    @GetMapping("/history")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<ExchangeRateDto>> getHistory(
            @RequestParam(required = false) String baseCurrency,
            @RequestParam(required = false) String targetCurrency,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        LocalDate fromDate = from != null ? from : LocalDate.now().minusMonths(3);
        LocalDate toDate = to != null ? to : LocalDate.now();
        int cappedSize = Math.min(size, 200);

        Page<ExchangeRate> rates;
        PageRequest pageRequest = PageRequest.of(page, cappedSize, Sort.by(Sort.Direction.DESC, "rateDate"));

        if (baseCurrency != null && targetCurrency != null) {
            rates = exchangeRateRepository.findHistory(
                baseCurrency.toUpperCase(), targetCurrency.toUpperCase(),
                fromDate, toDate, pageRequest);
        } else {
            rates = exchangeRateRepository.findByRateDateBetween(fromDate, toDate, pageRequest);
        }

        Page<ExchangeRateDto> dtos = rates.map(r -> new ExchangeRateDto(
            r.getId(), r.getBaseCurrency(), r.getTargetCurrency(),
            r.getRate(), r.getRateDate(), r.getSource()));

        return ResponseEntity.ok(dtos);
    }

    /**
     * Force la mise a jour des taux de change depuis la BCE.
     */
    @PostMapping("/refresh")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> refresh() {
        exchangeRateProvider.refreshRates();
        return ResponseEntity.ok(Map.of("status", "refreshed"));
    }
}
