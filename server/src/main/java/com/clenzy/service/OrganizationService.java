package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.OrganizationMemberRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Service de gestion des organisations multi-tenant.
 *
 * Responsabilites :
 * - Creation d'organisation (auto a l'inscription, manuelle pour conciergeries)
 * - Gestion des membres (ajout, suppression, changement de role)
 * - Generation de slugs uniques
 * - Upgrade de type d'organisation (INDIVIDUAL → CONCIERGE)
 */
@Service
@Transactional
public class OrganizationService {

    private static final Logger logger = LoggerFactory.getLogger(OrganizationService.class);
    private static final Pattern SLUG_PATTERN = Pattern.compile("[^a-z0-9-]");

    private final OrganizationRepository organizationRepository;
    private final OrganizationMemberRepository memberRepository;
    private final UserRepository userRepository;

    public OrganizationService(OrganizationRepository organizationRepository,
                                OrganizationMemberRepository memberRepository,
                                UserRepository userRepository) {
        this.organizationRepository = organizationRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
    }

    /**
     * Cree une organisation pour un utilisateur lors de l'inscription.
     * L'utilisateur devient automatiquement OWNER de l'organisation.
     *
     * @param user L'utilisateur (deja persiste en base)
     * @param name Le nom de l'organisation (companyName ou fullName)
     * @param type Le type d'organisation
     * @return L'organisation creee
     */
    public Organization createForUser(User user, String name, OrganizationType type) {
        logger.info("Creation d'organisation '{}' (type={}) pour l'utilisateur {}", name, type, user.getEmail());

        // Creer l'organisation
        Organization org = new Organization();
        org.setName(name);
        org.setType(type);
        org.setSlug(generateUniqueSlug(name));
        org = organizationRepository.save(org);

        // Creer le membership OWNER
        OrganizationMember member = new OrganizationMember(org, user, OrgMemberRole.OWNER);
        memberRepository.save(member);

        // Mettre a jour l'organization_id sur l'utilisateur
        user.setOrganizationId(org.getId());
        userRepository.save(user);

        logger.info("Organisation creee : id={}, slug={}, user={}", org.getId(), org.getSlug(), user.getEmail());
        return org;
    }

    /**
     * Cree une organisation avec les champs billing (utilise lors de l'inscription Stripe).
     */
    public Organization createForUserWithBilling(User user, String name, OrganizationType type,
                                                   String stripeCustomerId, String stripeSubscriptionId,
                                                   String forfait, String billingPeriod) {
        Organization org = createForUser(user, name, type);
        org.setStripeCustomerId(stripeCustomerId);
        org.setStripeSubscriptionId(stripeSubscriptionId);
        org.setForfait(forfait);
        org.setBillingPeriod(billingPeriod);
        return organizationRepository.save(org);
    }

    /**
     * Ajoute un membre a une organisation.
     */
    public OrganizationMember addMember(Long orgId, Long userId, OrgMemberRole role) {
        if (memberRepository.existsByOrganizationIdAndUserId(orgId, userId)) {
            throw new IllegalStateException("L'utilisateur est deja membre de cette organisation");
        }

        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new RuntimeException("Organisation non trouvee: " + orgId));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Utilisateur non trouve: " + userId));

        OrganizationMember member = new OrganizationMember(org, user, role);
        memberRepository.save(member);

        // Mettre a jour l'organization_id sur l'utilisateur
        user.setOrganizationId(orgId);
        userRepository.save(user);

        logger.info("Membre ajoute : orgId={}, userId={}, role={}", orgId, userId, role);
        return member;
    }

    /**
     * Retire un membre d'une organisation.
     * Le OWNER ne peut pas etre retire.
     */
    public void removeMember(Long orgId, Long userId) {
        OrganizationMember member = memberRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Membre non trouve"));

        if (member.isOwner()) {
            throw new IllegalStateException("Le proprietaire de l'organisation ne peut pas etre retire");
        }

        memberRepository.deleteByOrganizationIdAndUserId(orgId, userId);

        // Retirer l'organization_id de l'utilisateur
        User user = userRepository.findById(userId).orElse(null);
        if (user != null) {
            user.setOrganizationId(null);
            userRepository.save(user);
        }

        logger.info("Membre retire : orgId={}, userId={}", orgId, userId);
    }

    /**
     * Recupere l'organisation d'un utilisateur.
     */
    @Transactional(readOnly = true)
    public Optional<Organization> getByUserId(Long userId) {
        return memberRepository.findByUserId(userId)
                .map(OrganizationMember::getOrganization);
    }

    /**
     * Recupere l'organisation d'un utilisateur via son keycloakId.
     */
    @Transactional(readOnly = true)
    public Optional<Organization> getByUserKeycloakId(String keycloakId) {
        return memberRepository.findByUserKeycloakId(keycloakId)
                .map(OrganizationMember::getOrganization);
    }

    /**
     * Liste les membres d'une organisation.
     */
    @Transactional(readOnly = true)
    public List<OrganizationMember> getMembers(Long orgId) {
        return memberRepository.findByOrganizationId(orgId);
    }

    /**
     * Liste les membres d'une organisation avec les donnees utilisateur pre-chargees (JOIN FETCH).
     * Evite les N+1 queries sur User (LAZY + champs chiffres).
     */
    @Transactional(readOnly = true)
    public List<OrganizationMember> getMembersWithUser(Long orgId) {
        return memberRepository.findByOrganizationIdWithUser(orgId);
    }

    /**
     * Change le role d'un membre dans l'organisation.
     * Le OWNER ne peut pas etre modifie, et le role OWNER ne peut pas etre attribue.
     */
    public OrganizationMember changeMemberRole(Long orgId, Long memberId, OrgMemberRole newRole) {
        if (newRole == OrgMemberRole.OWNER) {
            throw new IllegalStateException("Le role OWNER ne peut pas etre attribue via cette operation");
        }

        OrganizationMember member = memberRepository.findByIdAndOrganizationId(memberId, orgId)
                .orElseThrow(() -> new RuntimeException("Membre non trouve dans cette organisation"));

        if (member.isOwner()) {
            throw new IllegalStateException("Le role du proprietaire ne peut pas etre modifie");
        }

        OrgMemberRole oldRole = member.getRoleInOrg();
        member.setRoleInOrg(newRole);
        memberRepository.save(member);

        logger.info("Role modifie : orgId={}, memberId={}, {} -> {}", orgId, memberId, oldRole, newRole);
        return member;
    }

    /**
     * Retire un membre par son ID de membership.
     * Le OWNER ne peut pas etre retire.
     */
    public void removeMemberById(Long orgId, Long memberId) {
        OrganizationMember member = memberRepository.findByIdAndOrganizationId(memberId, orgId)
                .orElseThrow(() -> new RuntimeException("Membre non trouve dans cette organisation"));

        if (member.isOwner()) {
            throw new IllegalStateException("Le proprietaire de l'organisation ne peut pas etre retire");
        }

        Long userId = member.getUserId();
        memberRepository.delete(member);

        // Retirer l'organization_id de l'utilisateur
        User user = userRepository.findById(userId).orElse(null);
        if (user != null) {
            user.setOrganizationId(null);
            userRepository.save(user);
        }

        logger.info("Membre retire : orgId={}, memberId={}, userId={}", orgId, memberId, userId);
    }

    /**
     * Verifie que l'appelant (identifie par son keycloakId) a le droit de gerer les membres de l'organisation.
     * Autorise : SUPER_ADMIN (bypass), ou membre de l'org avec canManageOrg() (OWNER/ADMIN).
     *
     * @throws org.springframework.security.access.AccessDeniedException si non autorise
     */
    @Transactional(readOnly = true)
    public void validateOrgManagement(String keycloakId, Long orgId) {
        User caller = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException("Utilisateur non trouve"));

        // Platform staff bypass (SUPER_ADMIN + SUPER_MANAGER)
        if (caller.getRole() != null && caller.getRole().isPlatformStaff()) {
            return;
        }

        // Verifier que l'appelant est membre de l'org avec droits de gestion
        OrganizationMember callerMember = memberRepository.findByUserId(caller.getId())
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException(
                        "Vous n'etes pas membre de cette organisation"));

        if (!callerMember.getOrganization().getId().equals(orgId)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Vous n'etes pas membre de cette organisation");
        }

        if (!callerMember.getRoleInOrg().canManageOrg()) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Vous n'avez pas les droits de gestion sur cette organisation");
        }
    }

    /**
     * Change le type d'une organisation (ex: INDIVIDUAL → CONCIERGE).
     */
    public Organization upgradeType(Long orgId, OrganizationType newType) {
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new RuntimeException("Organisation non trouvee: " + orgId));

        OrganizationType oldType = org.getType();
        org.setType(newType);
        organizationRepository.save(org);

        logger.info("Organisation {} upgradee : {} → {}", orgId, oldType, newType);
        return org;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CRUD Admin — Gestion standalone des organisations
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Cree une organisation standalone (sans utilisateur proprietaire).
     * Utilisee par l'admin pour creer manuellement une organisation.
     */
    public Organization createStandalone(String name, OrganizationType type) {
        logger.info("Creation d'organisation standalone '{}' (type={})", name, type);

        Organization org = new Organization();
        org.setName(name);
        org.setType(type);
        org.setSlug(generateUniqueSlug(name));
        org = organizationRepository.save(org);

        logger.info("Organisation standalone creee : id={}, slug={}", org.getId(), org.getSlug());
        return org;
    }

    /**
     * Met a jour une organisation (nom et/ou type).
     * Re-genere le slug si le nom change.
     */
    public Organization updateOrganization(Long id, String name, OrganizationType type) {
        Organization org = organizationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Organisation non trouvee: " + id));

        boolean nameChanged = name != null && !name.equals(org.getName());
        if (name != null) org.setName(name);
        if (type != null) org.setType(type);
        if (nameChanged) {
            org.setSlug(generateUniqueSlug(name));
        }

        org = organizationRepository.save(org);
        logger.info("Organisation mise a jour : id={}, name={}, type={}", id, org.getName(), org.getType());
        return org;
    }

    /**
     * Supprime une organisation.
     * Refuse si l'organisation a des membres actifs.
     * Dissocie les utilisateurs rattaches.
     */
    public void deleteOrganization(Long id) {
        Organization org = organizationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Organisation non trouvee: " + id));

        // Verifier qu'il n'y a pas de membres actifs
        List<OrganizationMember> members = memberRepository.findByOrganizationId(id);
        if (!members.isEmpty()) {
            throw new IllegalStateException(
                    "Impossible de supprimer l'organisation '" + org.getName()
                    + "' : elle contient " + members.size() + " membre(s). "
                    + "Retirez tous les membres avant de supprimer l'organisation.");
        }

        // Dissocier les utilisateurs qui ont cet organizationId
        List<User> usersInOrg = userRepository.findByOrganizationId(id);
        for (User user : usersInOrg) {
            user.setOrganizationId(null);
            userRepository.save(user);
        }

        organizationRepository.delete(org);
        logger.info("Organisation supprimee : id={}, name={}", id, org.getName());
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Slug
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Genere un slug unique a partir d'un nom.
     * Ex: "Ma Conciergerie Paris" → "ma-conciergerie-paris"
     * Si le slug existe deja, ajoute un suffixe numerique.
     */
    public String generateUniqueSlug(String baseName) {
        String normalized = Normalizer.normalize(baseName, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        String slug = SLUG_PATTERN.matcher(normalized.toLowerCase().trim().replace(" ", "-")).replaceAll("");

        // Limiter la longueur
        if (slug.length() > 80) {
            slug = slug.substring(0, 80);
        }

        // Assurer l'unicite
        String candidateSlug = slug;
        int counter = 1;
        while (organizationRepository.existsBySlug(candidateSlug)) {
            candidateSlug = slug + "-" + counter;
            counter++;
        }

        return candidateSlug;
    }
}
