package com.clenzy.booking.security;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Paramétrage du scoring de risque/fraude léger au checkout du booking engine public
 * (P2). <b>Inerte par défaut</b> : {@code enabled=false} → le scoring n'est jamais
 * calculé ni appelé. Même activé, {@code enforcement=false} (défaut) garde le service
 * en mode <b>advisory</b> : le score est journalisé et transmis à Stripe Radar en
 * metadata, mais aucune décision (caution renforcée / revue / refus) n'est appliquée.
 *
 * <p>Le scoring s'appuie uniquement sur des signaux <b>non bloquants</b> disponibles
 * côté serveur — il ne duplique pas la logique de Stripe Radar (lui-même alimenté en
 * metadata). Aucun montant client n'est jamais utilisé : le montant atypique est
 * comparé au total <b>recalculé serveur</b> de la réservation.</p>
 *
 * <p>Préfixe : {@code clenzy.booking.fraud-scoring}.</p>
 */
@Configuration
@ConfigurationProperties(prefix = "clenzy.booking.fraud-scoring")
public class BookingFraudScoringProperties {

    /** Active le calcul du score. Défaut {@code false} → service totalement inerte (non appelé). */
    private boolean enabled = false;

    /**
     * Active l'<b>enforcement</b> de la décision graduée. Défaut {@code false} → mode advisory :
     * on score, on logge et on transmet la metadata Radar, mais on ne bloque ni n'altère JAMAIS
     * un paiement légitime. {@code true} = MEDIUM exige une caution / marque pour revue, HIGH passe
     * en revue manuelle (refus si {@link #refuseHighRisk}).
     */
    private boolean enforcement = false;

    /** En enforcement, refuser (409) un checkout évalué HIGH au lieu de seulement le marquer pour revue. */
    private boolean refuseHighRisk = false;

    /** Fenêtre de vélocité (minutes) pour le comptage des tentatives par IP / par email. */
    private int velocityWindowMinutes = 60;

    /** Seuil de tentatives sur la fenêtre au-delà duquel la vélocité contribue au score (par clé). */
    private int velocityThreshold = 5;

    /** Points ajoutés au score quand la vélocité IP dépasse le seuil. */
    private int velocityIpPoints = 35;

    /** Points ajoutés au score quand la vélocité email dépasse le seuil. */
    private int velocityEmailPoints = 35;

    /** Points ajoutés quand l'email appartient à un domaine jetable connu. */
    private int disposableEmailPoints = 30;

    /**
     * Multiplicateur au-delà duquel un montant (recalculé serveur) est jugé atypique vs la moyenne
     * des réservations passées de la propriété (ex. 3.0 = total > 3× la moyenne).
     */
    private double atypicalAmountMultiplier = 3.0d;

    /** Points ajoutés quand le montant serveur dépasse {@link #atypicalAmountMultiplier} × moyenne. */
    private int atypicalAmountPoints = 20;

    /** Points ajoutés quand le pays de l'IP diffère du pays déclaré (mismatch). */
    private int countryMismatchPoints = 15;

    /** Seuil de score (inclus) à partir duquel le niveau est MEDIUM. */
    private int mediumThreshold = 40;

    /** Seuil de score (inclus) à partir duquel le niveau est HIGH. */
    private int highThreshold = 70;

    /**
     * Domaines email considérés comme jetables. Liste courte par défaut ; étendue par configuration
     * ({@code clenzy.booking.fraud-scoring.disposable-domains[0]=...}). Comparaison insensible à la casse.
     */
    private List<String> disposableDomains = List.of(
        "mailinator.com", "yopmail.com", "guerrillamail.com", "10minutemail.com",
        "tempmail.com", "trashmail.com", "throwawaymail.com", "getnada.com",
        "sharklasers.com", "maildrop.cc", "dispostable.com", "fakeinbox.com");

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public boolean isEnforcement() { return enforcement; }
    public void setEnforcement(boolean enforcement) { this.enforcement = enforcement; }

    public boolean isRefuseHighRisk() { return refuseHighRisk; }
    public void setRefuseHighRisk(boolean refuseHighRisk) { this.refuseHighRisk = refuseHighRisk; }

    public int getVelocityWindowMinutes() { return velocityWindowMinutes; }
    public void setVelocityWindowMinutes(int velocityWindowMinutes) { this.velocityWindowMinutes = velocityWindowMinutes; }

    public int getVelocityThreshold() { return velocityThreshold; }
    public void setVelocityThreshold(int velocityThreshold) { this.velocityThreshold = velocityThreshold; }

    public int getVelocityIpPoints() { return velocityIpPoints; }
    public void setVelocityIpPoints(int velocityIpPoints) { this.velocityIpPoints = velocityIpPoints; }

    public int getVelocityEmailPoints() { return velocityEmailPoints; }
    public void setVelocityEmailPoints(int velocityEmailPoints) { this.velocityEmailPoints = velocityEmailPoints; }

    public int getDisposableEmailPoints() { return disposableEmailPoints; }
    public void setDisposableEmailPoints(int disposableEmailPoints) { this.disposableEmailPoints = disposableEmailPoints; }

    public double getAtypicalAmountMultiplier() { return atypicalAmountMultiplier; }
    public void setAtypicalAmountMultiplier(double atypicalAmountMultiplier) { this.atypicalAmountMultiplier = atypicalAmountMultiplier; }

    public int getAtypicalAmountPoints() { return atypicalAmountPoints; }
    public void setAtypicalAmountPoints(int atypicalAmountPoints) { this.atypicalAmountPoints = atypicalAmountPoints; }

    public int getCountryMismatchPoints() { return countryMismatchPoints; }
    public void setCountryMismatchPoints(int countryMismatchPoints) { this.countryMismatchPoints = countryMismatchPoints; }

    public int getMediumThreshold() { return mediumThreshold; }
    public void setMediumThreshold(int mediumThreshold) { this.mediumThreshold = mediumThreshold; }

    public int getHighThreshold() { return highThreshold; }
    public void setHighThreshold(int highThreshold) { this.highThreshold = highThreshold; }

    public List<String> getDisposableDomains() { return disposableDomains; }
    public void setDisposableDomains(List<String> disposableDomains) { this.disposableDomains = disposableDomains; }
}
