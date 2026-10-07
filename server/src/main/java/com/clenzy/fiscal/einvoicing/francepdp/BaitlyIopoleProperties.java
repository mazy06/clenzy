package com.clenzy.fiscal.einvoicing.francepdp;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** Accès opérateur distincts des mandats de chaque société Baitly. Aucun accès activé par défaut. */
@Component
@ConfigurationProperties(prefix = "baitly.einvoice.iopole")
public class BaitlyIopoleProperties {
    public enum Environment {
        SANDBOX("https://api.ppd.iopole.fr", "https://auth.preprod.iopole.fr"),
        LIVE("https://api.iopole.com", "https://auth.iopole.com");

        private final String api;
        private final String auth;
        Environment(String api, String auth) { this.api = api; this.auth = auth; }
        public String api() { return api; }
        public String tokenUrl() { return auth + "/realms/iopole/protocol/openid-connect/token"; }
    }

    private boolean enabled;
    private Environment environment = Environment.SANDBOX;
    private String clientId;
    private String clientSecret;
    private Map<Long, Customer> customers = new HashMap<>();

    public static class Customer {
        private UUID customerId;
        private String sellerTaxId;
        private boolean pullModeConfirmed;
        public UUID getCustomerId() { return customerId; }
        public void setCustomerId(UUID value) { customerId = value; }
        public String getSellerTaxId() { return sellerTaxId; }
        public void setSellerTaxId(String value) { sellerTaxId = value; }
        public boolean isPullModeConfirmed() { return pullModeConfirmed; }
        public void setPullModeConfirmed(boolean value) { pullModeConfirmed = value; }
    }

    public boolean ready() {
        return enabled && environment != null && present(clientId) && present(clientSecret);
    }
    public static boolean present(String value) { return value != null && !value.isBlank(); }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean value) { enabled = value; }
    public Environment getEnvironment() { return environment; }
    public void setEnvironment(Environment value) { environment = value; }
    public String getClientId() { return clientId; }
    public void setClientId(String value) { clientId = value; }
    public String getClientSecret() { return clientSecret; }
    public void setClientSecret(String value) { clientSecret = value; }
    public Map<Long, Customer> getCustomers() { return customers; }
    public void setCustomers(Map<Long, Customer> value) { customers = value == null ? new HashMap<>() : value; }
}
