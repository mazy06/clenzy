package com.clenzy.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Parametrage du livret d'accueil numerique (lien guest borne a la reservation).
 *
 * <p>Le lien est accessible {@code leadDays} avant l'arrivee et reste valable
 * {@code graceDays} apres le depart. {@code manualTtlDays} s'applique aux tokens
 * generes sans reservation (apercu hote).</p>
 */
@Configuration
@ConfigurationProperties(prefix = "clenzy.guide")
public class GuideConfig {

    /** Base URL de la page guest publique (le token est concatene en suffixe). */
    private String baseUrl = "https://app.clenzy.fr/guide";

    /**
     * Nombre de jours avant le check-in ou le livret devient accessible.
     * 7 j pour que les liens envoyes en avance (confirmation, J-3…) ne soient pas morts ;
     * le code d'acces, lui, reste masque jusqu'a l'HEURE de check-in (accessCodeLocked).
     */
    private int leadDays = 7;

    /** Nombre de jours apres le check-out ou le livret reste accessible. */
    private int graceDays = 1;

    /** TTL (jours) d'un token genere sans reservation (apercu/partage manuel). */
    private int manualTtlDays = 60;

    /** Fenetre (jours apres le check-out) ou le lien de demande d'avis reste valide. */
    private int reviewWindowDays = 14;

    /** Chatbot guest : nombre max de messages par fenetre et par token (anti-abus). */
    private int chatMaxPerWindow = 20;
    /** Chatbot guest : duree de la fenetre de rate-limit (secondes). */
    private long chatWindowSeconds = 600;
    /** Chatbot guest : tokens max de la reponse LLM (cout). */
    private int chatMaxTokens = 400;
    /** Chatbot guest : provider IA prefere. */
    private String chatProvider = "anthropic";

    /** Ouverture guest : nombre max d'ouvertures par fenetre et par token (anti-abus). */
    private int unlockMaxPerWindow = 5;
    /** Ouverture guest : duree de la fenetre de rate-limit (secondes). */
    private long unlockWindowSeconds = 600;

    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
    public int getLeadDays() { return leadDays; }
    public void setLeadDays(int leadDays) { this.leadDays = leadDays; }
    public int getGraceDays() { return graceDays; }
    public void setGraceDays(int graceDays) { this.graceDays = graceDays; }
    public int getManualTtlDays() { return manualTtlDays; }
    public void setManualTtlDays(int manualTtlDays) { this.manualTtlDays = manualTtlDays; }
    public int getReviewWindowDays() { return reviewWindowDays; }
    public void setReviewWindowDays(int reviewWindowDays) { this.reviewWindowDays = reviewWindowDays; }
    public int getChatMaxPerWindow() { return chatMaxPerWindow; }
    public void setChatMaxPerWindow(int chatMaxPerWindow) { this.chatMaxPerWindow = chatMaxPerWindow; }
    public long getChatWindowSeconds() { return chatWindowSeconds; }
    public void setChatWindowSeconds(long chatWindowSeconds) { this.chatWindowSeconds = chatWindowSeconds; }
    public int getChatMaxTokens() { return chatMaxTokens; }
    public void setChatMaxTokens(int chatMaxTokens) { this.chatMaxTokens = chatMaxTokens; }
    public int getUnlockMaxPerWindow() { return unlockMaxPerWindow; }
    public void setUnlockMaxPerWindow(int unlockMaxPerWindow) { this.unlockMaxPerWindow = unlockMaxPerWindow; }
    public long getUnlockWindowSeconds() { return unlockWindowSeconds; }
    public void setUnlockWindowSeconds(long unlockWindowSeconds) { this.unlockWindowSeconds = unlockWindowSeconds; }
    public String getChatProvider() { return chatProvider; }
    public void setChatProvider(String chatProvider) { this.chatProvider = chatProvider; }
}
