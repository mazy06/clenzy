package com.clenzy.service.agent.portfolio;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration centralisee des seuils analytics portfolio.
 *
 * <p>Properties (prefix {@code clenzy.assistant.portfolio}) :
 * <ul>
 *   <li>{@code under-performer-occupancy} : occupancy en dessous → flag (defaut 0.50)</li>
 *   <li>{@code high-cancellation-rate} : ratio cancel/total au-dessus → pattern (defaut 0.20)</li>
 *   <li>{@code low-rating-threshold} : rating moyen ville en dessous → pattern (defaut 3.5)</li>
 *   <li>{@code top-n} : nombre de top performers a remonter (defaut 3)</li>
 *   <li>{@code min-reservations-for-volatility} : sample size mini avant evaluer la
 *       cancellation rate (defaut 3 — sous ce seuil c'est du bruit statistique)</li>
 * </ul>
 *
 * <p>Override possible par org via la table {@code org_portfolio_config} (a venir
 * dans une iteration ulterieure si besoin).</p>
 */
@Component
@ConfigurationProperties(prefix = "clenzy.assistant.portfolio")
public class PortfolioConfig {

    private double underPerformerOccupancy = 0.50;
    private double highCancellationRate = 0.20;
    private double lowRatingThreshold = 3.5;
    private int topN = 3;
    private int minReservationsForVolatility = 3;

    public double getUnderPerformerOccupancy() { return underPerformerOccupancy; }
    public void setUnderPerformerOccupancy(double v) { this.underPerformerOccupancy = v; }
    public double getHighCancellationRate() { return highCancellationRate; }
    public void setHighCancellationRate(double v) { this.highCancellationRate = v; }
    public double getLowRatingThreshold() { return lowRatingThreshold; }
    public void setLowRatingThreshold(double v) { this.lowRatingThreshold = v; }
    public int getTopN() { return topN; }
    public void setTopN(int v) { this.topN = v; }
    public int getMinReservationsForVolatility() { return minReservationsForVolatility; }
    public void setMinReservationsForVolatility(int v) { this.minReservationsForVolatility = v; }
}
