package com.clenzy.integration.twilio.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration Twilio pour les envois SMS et WhatsApp.
 * Active uniquement si clenzy.twilio.account-sid est defini.
 */
@Configuration
@ConfigurationProperties(prefix = "clenzy.twilio")
@ConditionalOnProperty(name = "clenzy.twilio.account-sid")
public class TwilioConfig {

    private String accountSid;
    private String authToken;
    private String messagingServiceSid;
    private String whatsappFrom;
    private String verifyServiceSid;

    public String getAccountSid() {
        return accountSid;
    }

    public void setAccountSid(String accountSid) {
        this.accountSid = accountSid;
    }

    public String getAuthToken() {
        return authToken;
    }

    public void setAuthToken(String authToken) {
        this.authToken = authToken;
    }

    public String getMessagingServiceSid() {
        return messagingServiceSid;
    }

    public void setMessagingServiceSid(String messagingServiceSid) {
        this.messagingServiceSid = messagingServiceSid;
    }

    public String getWhatsappFrom() {
        return whatsappFrom;
    }

    public void setWhatsappFrom(String whatsappFrom) {
        this.whatsappFrom = whatsappFrom;
    }

    public String getVerifyServiceSid() {
        return verifyServiceSid;
    }

    public void setVerifyServiceSid(String verifyServiceSid) {
        this.verifyServiceSid = verifyServiceSid;
    }

    /**
     * Verifie que la configuration minimale est presente.
     */
    public boolean isConfigured() {
        return accountSid != null && !accountSid.isBlank()
            && authToken != null && !authToken.isBlank();
    }
}
