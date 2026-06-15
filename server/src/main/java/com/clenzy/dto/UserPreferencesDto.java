package com.clenzy.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * DTO pour les preferences utilisateur (timezone, devise, langue, theme, accent, notifications).
 *
 * <p><b>Partial-safe :</b> tous les champs optionnels sont initialises a {@code null}.
 * Jackson execute les initialiseurs de champs dans le constructeur sans-arg, puis ne setter
 * QUE les proprietes presentes dans le JSON. Un initialiseur non-null survivrait donc et serait
 * applique a tort lors d'un PUT partiel. En laissant tout a {@code null}, un champ absent reste
 * {@code null} et le service le laisse inchange. Bean Validation ignore les valeurs {@code null},
 * donc seuls les champs reellement fournis sont valides.</p>
 */
public class UserPreferencesDto {

    @Size(max = 50)
    private String timezone;

    /** ISO 4217 (3 chars). */
    @Pattern(regexp = "^[A-Z]{3}$", message = "Currency must be a 3-letter ISO 4217 code")
    private String currency;

    /** Code langue (ex: fr, en, ar). */
    @Pattern(regexp = "^[a-z]{2,5}$", message = "Language must be a 2-5 letter code")
    private String language;

    /**
     * Mode d'affichage UI : {@code light}, {@code dark} ou {@code auto}.
     * Whitelist strict pour eviter qu'un client envoie n'importe quoi (Q3).
     */
    @Pattern(regexp = "^(light|dark|auto)$", message = "Theme mode must be 'light', 'dark' or 'auto'")
    private String themeMode;

    /** Teinte d'accent Signature (whitelist des 7 teintes). */
    @Pattern(regexp = "^(emeraude|terracotta|ambre|indigo|violet|ocean|slate)$",
             message = "Accent must be one of the 7 Signature tints")
    private String accent;

    private Boolean notifyEmail;
    private Boolean notifyPush;
    private Boolean notifySms;

    public UserPreferencesDto() {}

    public UserPreferencesDto(String timezone, String currency, String language, String themeMode,
                              String accent, Boolean notifyEmail, Boolean notifyPush, Boolean notifySms) {
        this.timezone = timezone;
        this.currency = currency;
        this.language = language;
        this.themeMode = themeMode;
        this.accent = accent;
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

    public String getThemeMode() { return themeMode; }
    public void setThemeMode(String themeMode) { this.themeMode = themeMode; }

    public String getAccent() { return accent; }
    public void setAccent(String accent) { this.accent = accent; }

    public Boolean getNotifyEmail() { return notifyEmail; }
    public void setNotifyEmail(Boolean notifyEmail) { this.notifyEmail = notifyEmail; }

    public Boolean getNotifyPush() { return notifyPush; }
    public void setNotifyPush(Boolean notifyPush) { this.notifyPush = notifyPush; }

    public Boolean getNotifySms() { return notifySms; }
    public void setNotifySms(Boolean notifySms) { this.notifySms = notifySms; }
}
