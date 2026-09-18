package com.clenzy.marketplace.repository;

import com.clenzy.model.*;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * Lectures transverses de la place de marche : reprise des comptes existants,
 * et resolution de la photo des fiches rattachees a un compte.
 *
 * <h2>Pourquoi un depot dedie</h2>
 * <p>Les donnees a reprendre vivent dans six tables org-scopees
 * ({@code users}, {@code technician_prestations}, {@code housekeeper_rates},
 * {@code teams}, {@code provider_documents}, {@code interventions}) dont les
 * depots exposent deja des methodes bornees a une organisation. Ajouter des
 * variantes transverses a chacun aurait mis six methodes cross-org a portee de
 * tout le produit. Elles sont donc rassemblees ici, ou leur portee se lit d'un
 * coup.</p>
 *
 * <h2>Ce qui borne reellement la lecture</h2>
 * <p>Ces entites portent le filtre Hibernate {@code organizationFilter}. Le
 * {@code TenantFilter} ne l'active PAS pour le staff plateforme — c'est ce qui
 * rend l'import transverse possible, et c'est la seule voie prevue puisque
 * l'endpoint est garde par {@code SUPER_ADMIN} / {@code SUPER_MANAGER}.</p>
 *
 * <p><b>Le filtre n'est jamais desactive a la main.</b> Si un appelant sans ce
 * role atteignait ce code, le filtre resterait actif et l'import ne verrait que
 * son organisation : un import incomplet, jamais une fuite. C'est le sens de la
 * defaillance qu'on veut.</p>
 */
public interface MarketplaceImportRepository extends Repository<User, Long> {

    /**
     * Comptes dont le metier est une prestation de terrain.
     *
     * <p>Les comptes sans adresse ne sont pas ecartes ici : l'appelant les
     * compte comme ignores et le dit, plutot qu'ils disparaissent en silence
     * d'un ecart entre deux chiffres.</p>
     */
    @Query("SELECT u FROM User u WHERE u.role IN :roles ORDER BY u.id ASC")
    List<User> findProviderUsers(@Param("roles") List<UserRole> roles);

    @Query("SELECT COUNT(u) FROM User u WHERE u.role IN :roles")
    long countProviderUsers(@Param("roles") List<UserRole> roles);

    /**
     * Equipe plateforme, toutes organisations confondues.
     *
     * <p>{@code NotificationService.notifyAdminsAndManagers} ne convient pas ici :
     * il exige un {@code TenantContext}, que la surface publique n'a pas, et
     * echoue alors en silence. Une candidature s'adresse de toute facon a
     * l'equipe PLATEFORME, pas aux administrateurs d'une organisation.</p>
     */
    @Query("SELECT u FROM User u WHERE u.role IN :roles AND u.keycloakId IS NOT NULL "
         + "AND u.status = 'ACTIVE' ORDER BY u.id ASC")
    List<User> findPlatformStaff(@Param("roles") List<UserRole> roles);

    /**
     * Comptes qui ont reellement une photo.
     *
     * <p>{@code UserService.publicAvatarUrl} fabrique une adresse pour
     * n'importe quel identifiant, y compris un compte sans photo : l'endpoint
     * repondrait alors 404 et la carte afficherait une image cassee au lieu des
     * initiales. Cette requete dit lesquels en ont une, en une seule fois pour
     * toute la page.</p>
     */
    @Query("SELECT u.id FROM User u WHERE u.id IN :userIds AND u.profilePictureUrl IS NOT NULL")
    List<Long> findUserIdsWithPhoto(@Param("userIds") List<Long> userIds);

    @Query("SELECT t FROM ProviderTariff t WHERE t.userId IN :userIds AND t.enabled = true")
    List<ProviderTariff> findProviderTariffs(@Param("userIds") List<Long> userIds);

    /**
     * Pieces justificatives VALIDEES portant une echeance.
     *
     * <p>Seules les pieces approuvees comptent : une piece deposee mais non
     * examinee ne prouve rien, et la reprendre comme valide donnerait une
     * conformite qu'aucun gestionnaire n'a constatee.</p>
     */
    @Query("SELECT d FROM ProviderDocument d WHERE d.userId IN :userIds "
         + "AND d.status = com.clenzy.model.ProviderDocument$Status.APPROVED "
         + "AND d.expiresAt IS NOT NULL ORDER BY d.expiresAt DESC")
    List<ProviderDocument> findApprovedDocumentsWithExpiry(@Param("userIds") List<Long> userIds);

    /**
     * Missions terminees par intervenant.
     *
     * <p>Les deux chemins d'affectation sont couverts : {@code assignedTechnicianId}
     * (identifiant nu) et l'association {@code assignedUser}. N'en lire qu'un
     * sous-compterait les missions d'une partie des intervenants selon l'epoque
     * ou elles ont ete creees.</p>
     *
     * @return lignes {@code [userId, count]}
     */
    @Query("""
           SELECT COALESCE(i.assignedTechnicianId, au.id), COUNT(i)
           FROM Intervention i LEFT JOIN i.assignedUser au
           WHERE i.status = com.clenzy.model.InterventionStatus.COMPLETED
             AND (i.assignedTechnicianId IN :userIds OR au.id IN :userIds)
           GROUP BY COALESCE(i.assignedTechnicianId, au.id)
           """)
    List<Object[]> countCompletedInterventionsByUser(@Param("userIds") List<Long> userIds);
}
