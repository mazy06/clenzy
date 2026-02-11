package com.clenzy.dto;

/**
 * DTO de réponse pour les demandes de devis.
 * Inclut le package recommandé basé sur les réponses du formulaire.
 */
public class QuoteResponseDto {

    private String status;
    private String message;
    private String recommendedPackage;
    private int recommendedRate;

    public QuoteResponseDto() {}

    public QuoteResponseDto(String status, String message, String recommendedPackage, int recommendedRate) {
        this.status = status;
        this.message = message;
        this.recommendedPackage = recommendedPackage;
        this.recommendedRate = recommendedRate;
    }

    // --- Getters & Setters ---

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getRecommendedPackage() { return recommendedPackage; }
    public void setRecommendedPackage(String recommendedPackage) { this.recommendedPackage = recommendedPackage; }

    public int getRecommendedRate() { return recommendedRate; }
    public void setRecommendedRate(int recommendedRate) { this.recommendedRate = recommendedRate; }
}
