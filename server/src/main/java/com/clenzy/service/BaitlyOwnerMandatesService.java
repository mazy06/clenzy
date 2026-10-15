package com.clenzy.service;

import com.clenzy.model.ContractSignatureRequest;
import com.clenzy.repository.ContractSignatureRequestRepository;
import com.clenzy.repository.ManagementContractRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Mandats Baitly du propriétaire authentifié, dans l'organisation courante uniquement. */
@Service
@Transactional(readOnly = true)
public class BaitlyOwnerMandatesService {
    private final UserRepository users;
    private final ManagementContractRepository contracts;
    private final ContractSignatureRequestRepository signatures;
    private final TenantContext tenant;

    public BaitlyOwnerMandatesService(UserRepository users, ManagementContractRepository contracts,
                                     ContractSignatureRequestRepository signatures, TenantContext tenant) {
        this.users = users; this.contracts = contracts; this.signatures = signatures; this.tenant = tenant;
    }

    public record Mandate(Long id, Long propertyId, String contractNumber, String status,
                          String startDate, String endDate, String signatureStatus, UUID signatureToken) {}

    public List<Mandate> list(String subject) {
        Long organizationId = tenant.getOrganizationId();
        if (organizationId == null || subject == null || subject.isBlank()) {
            throw new AccessDeniedException("Organisation ou identité absente");
        }
        var owner = users.findByKeycloakId(subject)
                .orElseThrow(() -> new AccessDeniedException("Propriétaire inconnu"));
        var owned = contracts.findByOwnerId(owner.getId(), organizationId);
        if (owned.isEmpty()) return List.of();
        Map<Long, ContractSignatureRequest> latest = signatures.findByContractIdIn(
                owned.stream().map(c -> c.getId()).toList()).stream()
                .filter(s -> organizationId.equals(s.getOrganizationId()))
                .collect(Collectors.toMap(ContractSignatureRequest::getContractId, Function.identity(),
                        (a, b) -> a.getId() > b.getId() ? a : b));
        return owned.stream()
                // Défense supplémentaire : aucun rôle plateforme ne contourne l'ownership ici.
                .filter(c -> owner.getId().equals(c.getOwnerId()) && organizationId.equals(c.getOrganizationId()))
                .sorted(Comparator.comparing(c -> c.getId(), Comparator.reverseOrder()))
                .map(c -> {
                    var signature = latest.get(c.getId());
                    return new Mandate(c.getId(), c.getPropertyId(), c.getContractNumber(), c.getStatus().name(),
                            c.getStartDate() == null ? null : c.getStartDate().toString(),
                            c.getEndDate() == null ? null : c.getEndDate().toString(),
                            signature == null ? null : signature.isExpired() ? "EXPIRED" : signature.getStatus().name(),
                            signature == null ? null : signature.getToken());
                }).toList();
    }
}
