package com.clenzy.dto;

/**
 * DTO pour les preferences utilisateur (timezone, devise, langue, notifications).
 */
public class UserPreferencesDto {

    private String timezone = "Europe/Paris";
    private String currency = "EUR";
    private String language = "fr";
    private boolean notifyEmail = true;
    private boolean notifyPush = false;
    private boolean notifySms = false;

    public UserPreferencesDto() {}

    public UserPreferencesDto(String timezone, String currency, String language,
                              boolean notifyEmail, boolean notifyPush, boolean notifySms) {
        this.timezone = timezone;
        this.currency = currency;
        this.language = language;
        this.notifyEmail = notifyEmail;
        this.notifyPush = notifyPush;
        this.notifySms = notifySms;
    }

    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public boolean isNotifyEmail() { return notifyEmail; }
    public void setNotifyEmail(boolean notifyEmail) { this.notifyEmail = notifyEmail; }

    public boolean isNotifyPush() { return notifyPush; }
    public void setNotifyPush(boolean notifyPush) { this.notifyPush = notifyPush; }

    public boolean isNotifySms() { return notifySms; }
    public void setNotifySms(boolean notifySms) { this.notifySms = notifySms; }
}
