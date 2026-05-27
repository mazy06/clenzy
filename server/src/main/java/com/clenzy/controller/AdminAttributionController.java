package com.clenzy.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Rapports d'attribution marketing pour les admins.
 *
 * <p>Expose des aggregations simples sur les champs collectes a l'inscription
 * (referral_source, promo_code) pour mesurer l'efficacite des canaux et des
 * campagnes promo. Lecture uniquement, agregations en pure SQL.</p>
 *
 * <p>Securite : SUPER_ADMIN uniquement (data cross-tenant).</p>
 */
@RestController
@RequestMapping("/api/admin/attribution")
@PreAuthorize("hasRole('SUPER_ADMIN')")
@Tag(name = "Admin - Attribution", description = "Rapports d'acquisition (source, codes promo)")
public class AdminAttributionController {

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Repartition des inscriptions par {@code referral_source}.
     *
     * <p>Renvoie une liste ordonnee par decompte decroissant. NULL est groupe
     * sous la cle "(non renseigne)" pour distinguer "pas de reponse" vs.
     * "autre" (l'utilisateur a explicitement coche "Autre").</p>
     */
    @GetMapping("/by-source")
    @Operation(summary = "Repartition des inscriptions par source d'acquisition")
    public ResponseEntity<List<Map<String, Object>>> getInscriptionsBySource() {
        @SuppressWarnings("unchecked")
        List<Object[]> raw = entityManager.createNativeQuery("""
                SELECT COALESCE(referral_source, '(non renseigne)') AS source, COUNT(*) AS total
                FROM users
                GROUP BY referral_source
                ORDER BY total DESC
                """).getResultList();

        var result = raw.stream().<Map<String, Object>>map(row -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("source", row[0]);
            m.put("count", ((Number) row[1]).longValue());
            return m;
        }).toList();

        return ResponseEntity.ok(result);
    }

    /**
     * Repartition des inscriptions par {@code promo_code}.
     *
     * <p>Ne renvoie que les utilisateurs ayant saisi un code (promo_code IS NOT NULL).
     * Utile pour mesurer l'usage reel d'une campagne.</p>
     */
    @GetMapping("/by-promo-code")
    @Operation(summary = "Repartition des inscriptions par code promo utilise")
    public ResponseEntity<List<Map<String, Object>>> getInscriptionsByPromoCode() {
        @SuppressWarnings("unchecked")
        List<Object[]> raw = entityManager.createNativeQuery("""
                SELECT promo_code, COUNT(*) AS total
                FROM users
                WHERE promo_code IS NOT NULL
                GROUP BY promo_code
                ORDER BY total DESC
                """).getResultList();

        var result = raw.stream().<Map<String, Object>>map(row -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("promoCode", row[0]);
            m.put("count", ((Number) row[1]).longValue());
            return m;
        }).toList();

        return ResponseEntity.ok(result);
    }

    /**
     * Vue d'ensemble : totaux + breakdown des consentements newsletter.
     */
    @GetMapping("/summary")
    @Operation(summary = "Vue d'ensemble de l'acquisition")
    public ResponseEntity<Map<String, Object>> getSummary() {
        Number totalUsers = (Number) entityManager.createNativeQuery(
                "SELECT COUNT(*) FROM users").getSingleResult();
        Number newsletterOptIns = (Number) entityManager.createNativeQuery(
                "SELECT COUNT(*) FROM users WHERE newsletter_opt_in = true").getSingleResult();
        Number withPromoCode = (Number) entityManager.createNativeQuery(
                "SELECT COUNT(*) FROM users WHERE promo_code IS NOT NULL").getSingleResult();
        Number withReferralSource = (Number) entityManager.createNativeQuery(
                "SELECT COUNT(*) FROM users WHERE referral_source IS NOT NULL").getSingleResult();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalUsers", totalUsers.longValue());
        result.put("newsletterOptIns", newsletterOptIns.longValue());
        result.put("withPromoCode", withPromoCode.longValue());
        result.put("withReferralSource", withReferralSource.longValue());

        // Taux d'opt-in newsletter (en pourcentage)
        double newsletterRate = totalUsers.longValue() == 0
                ? 0.0
                : (newsletterOptIns.doubleValue() / totalUsers.doubleValue()) * 100;
        result.put("newsletterOptInRate", Math.round(newsletterRate * 10) / 10.0);

        return ResponseEntity.ok(result);
    }
}
