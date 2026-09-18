package com.clenzy.marketplace.repository;

import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.model.ProviderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

/**
 * Acces aux fiches professionnelles.
 *
 * <p>Table PLATEFORME : aucun filtre tenant ne s'applique. Toute methode
 * ajoutee ici expose donc l'ensemble du catalogue — l'autorisation est la seule
 * barriere, et elle se pose au niveau du controleur.</p>
 */
public interface MarketplaceProviderRepository
        extends JpaRepository<MarketplaceProvider, Long>,
                JpaSpecificationExecutor<MarketplaceProvider> {

    interface ObservedMetrics {
        Long getId();
        Integer getCompleted();
        java.math.BigDecimal getPositiveResponsePct();
        Integer getResponseMinutes();
    }

    @Query(value = "SELECT p.id, public.baitly_provider_completed_missions(p.id) AS completed, "
        + "m.positive_response_pct AS positiveResponsePct, m.response_minutes AS responseMinutes "
        + "FROM marketplace_providers p LEFT JOIN public.baitly_provider_response_metrics(:ids) m ON m.provider_id=p.id "
        + "WHERE p.id=ANY(:ids)", nativeQuery = true)
    List<ObservedMetrics> observedMetrics(Long[] ids);

    Optional<MarketplaceProvider> findByPublicRef(UUID publicRef);

    /**
     * Recherche par empreinte du courriel.
     *
     * <p>Le courriel est chiffre au repos avec un vecteur aleatoire : deux
     * ecritures de la meme adresse donnent deux ciphertexts differents. Toute
     * recherche exacte passe donc par {@code emailHash}, jamais par la colonne
     * chiffree — une requete sur {@code email} ne trouverait jamais rien.</p>
     */
    Optional<MarketplaceProvider> findByEmailHash(String emailHash);

    /**
     * Fiche d'un utilisateur connecte.
     *
     * <p>C'est elle qui fait le lien entre un compte et son espace prestataire :
     * un prestataire accepte est un utilisateur comme un autre, sa fiche n'est
     * accessible que par ce rattachement.</p>
     */
    Optional<MarketplaceProvider> findByUserId(Long userId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM MarketplaceProvider p WHERE p.id = :id")
    Optional<MarketplaceProvider> findForErasure(@Param("id") Long id);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM MarketplaceProvider p WHERE p.id = :id")
    Optional<MarketplaceProvider> findForRating(@Param("id") Long id);

    /**
     * Candidature designee par un jeton de depot. La comparaison porte sur
     * l'EMPREINTE : la base ne detient jamais le jeton utilisable.
     */
    Optional<MarketplaceProvider> findByUploadTokenHash(String uploadTokenHash);

    /** Candidature designee par un jeton de confirmation d'adresse. */
    Optional<MarketplaceProvider> findByEmailConfirmTokenHash(String emailConfirmTokenHash);

    /** Candidature designee par un jeton d'activation de compte. */
    Optional<MarketplaceProvider> findByActivationTokenHash(String activationTokenHash);

    // ─── Retention ───────────────────────────────────────────────────────────
    //
    // Une candidature refusée et notifiée a epuise sa raison d'etre : elle porte
    // un nom, une adresse, un telephone et parfois une piece d'identite. Les
    // fiches PORTANT UN COMPTE sont exclues — leur effacement passe par celui du
    // compte, pas par un balayage de retention.

    @Query("SELECT COUNT(p) FROM MarketplaceProvider p WHERE p.userId IS NULL "
         + "AND p.status = com.clenzy.marketplace.model.ProviderStatus.REJECTED "
         + "AND p.retentionHoldReason IS NULL AND p.decisionSentAt <= :cutoff")
    long countPurgeableApplications(@Param("cutoff") LocalDateTime cutoff);

    /** Tri stable par identifiant : progression deterministe d'un lot a l'autre. */
    @Query("SELECT p.id FROM MarketplaceProvider p WHERE p.userId IS NULL "
         + "AND p.status = com.clenzy.marketplace.model.ProviderStatus.REJECTED "
         + "AND p.retentionHoldReason IS NULL AND p.decisionSentAt <= :cutoff ORDER BY p.id ASC")
    List<Long> findPurgeableApplicationIds(@Param("cutoff") LocalDateTime cutoff, Pageable pageable);

    boolean existsByEmailHash(String emailHash);

    List<MarketplaceProvider> findByHomeOrganizationId(Long organizationId);

    long countByStatus(ProviderStatus status);

    /**
     * Repartition par statut en une seule requete.
     *
     * <p>Une boucle de {@code countByStatus} aurait coute autant d'allers-retours
     * que de statuts pour une donnee affichee en permanence en tete d'ecran.</p>
     *
     * @return lignes {@code [ProviderStatus, Long]}
     */
    @Query("SELECT p.status, COUNT(p) FROM MarketplaceProvider p GROUP BY p.status")
    List<Object[]> countGroupedByStatus();

    /**
     * Repartition par mode d'engagement.
     *
     * @return lignes {@code [EngagementMode, Long]}
     */
    @Query("SELECT p.engagementMode, COUNT(p) FROM MarketplaceProvider p GROUP BY p.engagementMode")
    List<Object[]> countGroupedByEngagementMode();

    /**
     * Fiches dont une piece de conformite est expiree ou expire avant le seuil.
     *
     * <p>Une piece ABSENTE n'est pas comptee : la plupart des dossiers sont
     * incomplets a l'inscription, et les signaler tous rendrait le compteur
     * inexploitable.</p>
     */
    @Query("""
           SELECT COUNT(p) FROM MarketplaceProvider p
           WHERE p.insuranceExpiresAt < :threshold OR p.vigilanceExpiresAt < :threshold
           """)
    long countComplianceAlerts(LocalDate threshold);

    // ─── Volumes par dimension de filtre ─────────────────────────────────────
    //
    // COUNT(DISTINCT provider) et non COUNT(*) : un professionnel qui propose
    // trois prestations de menage compte pour UN, pas trois. Sans le DISTINCT,
    // la somme des compteurs depasserait le nombre de fiches et le chiffre
    // perdrait tout sens.

    /** @return lignes {@code [codeMetier, nbProfessionnels]} */
    @Query("""
           SELECT c.code, COUNT(DISTINCT o.provider.id)
           FROM MarketplaceProviderOffer o JOIN o.category c
           LEFT JOIN o.serviceItem i LEFT JOIN i.category ic LEFT JOIN o.tariff t
           WHERE o.active = true AND (t.id IS NULL OR t.enabled = true) AND c.active = true
             AND (i.id IS NULL OR (i.active = true AND ic.code = c.code))
           GROUP BY c.code
           """)
    List<Object[]> countProvidersByCategory();

    /**
     * @return lignes {@code [codePrestation, nbProfessionnels]}
     *
     * <p>Les offres hors referentiel sont ecartees : elles n'ont pas de code a
     * compter, et les regrouper sous une entree fourre-tout melerait des
     * prestations sans rapport.</p>
     */
    @Query("""
           SELECT i.code, COUNT(DISTINCT o.provider.id)
           FROM MarketplaceProviderOffer o JOIN o.serviceItem i
           JOIN o.category c JOIN i.category ic LEFT JOIN o.tariff t
           WHERE o.active = true AND (t.id IS NULL OR t.enabled = true) AND c.active = true AND i.active = true AND ic.code = c.code
           GROUP BY i.code
           """)
    List<Object[]> countProvidersByServiceItem();

    /** @return lignes {@code [ville, nbProfessionnels]} */
    @Query("""
           SELECT z.city, COUNT(DISTINCT p.id)
           FROM MarketplaceProvider p JOIN MarketplaceProviderZone z
             ON z.userId = p.userId OR (p.userId IS NULL AND z.provider = p)
           WHERE z.city IS NOT NULL AND z.city <> ''
           GROUP BY z.city
           """)
    List<Object[]> countProvidersByCity();
}
