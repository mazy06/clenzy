package com.clenzy.service;

import com.clenzy.fiscal.MoneyUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Service de conversion de devises.
 *
 * Responsabilites :
 * - Convertir un montant d'une devise source vers une devise cible
 * - Utiliser les taux de change historiques (a la date de la transaction)
 * - Arrondir selon les regles bancaires (HALF_UP, 2 decimales)
 *
 * Usage typique :
 *   BigDecimal eurAmount = currencyConverter.convert(madAmount, "MAD", "EUR", reservationDate);
 */
@Service
public class CurrencyConverterService {

    private static final Logger log = LoggerFactory.getLogger(CurrencyConverterService.class);

    private final ExchangeRateProviderService exchangeRateProvider;

    public CurrencyConverterService(ExchangeRateProviderService exchangeRateProvider) {
        this.exchangeRateProvider = exchangeRateProvider;
    }

    /**
     * Convertit un montant d'une devise vers une autre.
     *
     * @param amount         Montant a convertir
     * @param fromCurrency   Devise source (ex: "MAD")
     * @param toCurrency     Devise cible (ex: "EUR")
     * @param transactionDate Date de la transaction (pour le taux historique)
     * @return Montant converti arrondi a 2 decimales
     */
    public BigDecimal convert(BigDecimal amount, String fromCurrency,
                               String toCurrency, LocalDate transactionDate) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }

        if (fromCurrency.equalsIgnoreCase(toCurrency)) {
            return MoneyUtils.round(amount);
        }

        BigDecimal rate = exchangeRateProvider.getRate(fromCurrency, toCurrency, transactionDate);
        BigDecimal converted = amount.multiply(rate);
        BigDecimal result = MoneyUtils.round(converted);

        log.debug("Currency conversion: {} {} → {} {} (rate={}, date={})",
            amount, fromCurrency, result, toCurrency, rate, transactionDate);

        return result;
    }

    /**
     * Convertit vers la devise par defaut de l'organisation (pour le reporting consolide).
     */
    public BigDecimal convertToBase(BigDecimal amount, String fromCurrency,
                                     String baseCurrency, LocalDate date) {
        return convert(amount, fromCurrency, baseCurrency, date);
    }

    /**
     * Retourne le taux de change entre deux devises.
     */
    public BigDecimal getRate(String from, String to, LocalDate date) {
        return exchangeRateProvider.getRate(from, to, date);
    }
}
