package com.clenzy.fiscal;

/**
 * Exception levee lorsqu'un code pays n'est pas supporte
 * par le moteur fiscal.
 */
public class UnsupportedCountryException extends RuntimeException {

    private final String countryCode;

    public UnsupportedCountryException(String countryCode) {
        super("Unsupported country code: " + countryCode +
              ". Supported countries can be found via TaxCalculatorRegistry.getSupportedCountries()");
        this.countryCode = countryCode;
    }

    public String getCountryCode() {
        return countryCode;
    }
}
