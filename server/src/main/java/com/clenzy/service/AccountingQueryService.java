package com.clenzy.service;

import com.clenzy.dto.OwnerPayoutDto;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.User;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Requetes de lecture transverses du module comptabilite : resolution des noms
 * de proprietaires pour les DTOs de payout, compteurs de reversements en
 * attente et lookup du nom d'organisation.
 *
 * <p>Lookups transverses (UserRepository, OrganizationRepository) places ici
 * car les services transverses n'exposent pas de methode publique adaptee
 * (UserService.getById retourne un UserDto complet, OrganizationService n'a
 * pas de getById simple).</p>
 */
@Service
@Transactional(readOnly = true)
public class AccountingQueryService {

    private final OwnerPayoutRepository payoutRepository;
    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;

    public AccountingQueryService(OwnerPayoutRepository payoutRepository,
                                  UserRepository userRepository,
                                  OrganizationRepository organizationRepository) {
        this.payoutRepository = payoutRepository;
        this.userRepository = userRepository;
        this.organizationRepository = organizationRepository;
    }

    /** Compteur + montant des reversements PENDING (org ou owner). */
    public record PendingPayoutSummary(long pendingCount, BigDecimal totalPendingAmount) {}

    /** Mappe un payout en DTO avec le nom complet de son proprietaire. */
    public OwnerPayoutDto toDtoWithOwnerName(OwnerPayout payout) {
        String ownerName = userRepository.findById(payout.getOwnerId())
            .map(User::getFullName).orElse(null);
        return OwnerPayoutDto.from(payout, ownerName);
    }

    /**
     * Resout les noms des proprietaires en batch pour eviter les N+1 queries.
     */
    public List<OwnerPayoutDto> toDtosWithOwnerNames(List<OwnerPayout> payouts) {
        Set<Long> ownerIds = payouts.stream()
            .map(OwnerPayout::getOwnerId)
            .collect(Collectors.toSet());
        Map<Long, String> namesByOwnerId = userRepository.findAllById(ownerIds).stream()
            .collect(Collectors.toMap(User::getId, User::getFullName, (a, b) -> a));
        return payouts.stream()
            .map(p -> OwnerPayoutDto.from(p, namesByOwnerId.get(p.getOwnerId())))
            .toList();
    }

    /** Reversements PENDING de l'organisation (dashboard admin). */
    public PendingPayoutSummary getPendingPayoutSummary(Long orgId) {
        return new PendingPayoutSummary(
            payoutRepository.countPendingByOrgId(orgId),
            payoutRepository.sumPendingAmountByOrgId(orgId));
    }

    /**
     * Reversements PENDING de l'utilisateur courant (prestataire), resolu par
     * son keycloakId — l'ownerId n'est jamais fourni par le client.
     */
    public PendingPayoutSummary getMyPendingPayoutSummary(String keycloakId) {
        final User user = userRepository.findByKeycloakId(keycloakId)
            .orElseThrow(() -> new IllegalStateException("User not found"));
        return new PendingPayoutSummary(
            payoutRepository.countPendingByOwnerId(user.getId()),
            payoutRepository.sumPendingAmountByOwnerId(user.getId()));
    }

    /** Nom de l'organisation (pour l'en-tete des releves proprietaires). */
    public Optional<String> getOrganizationName(Long orgId) {
        return organizationRepository.findById(orgId)
            .map(com.clenzy.model.Organization::getName);
    }
}
