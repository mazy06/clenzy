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
