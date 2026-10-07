package com.clenzy.service.payout;

import com.clenzy.dto.PayoutTransferDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.repository.PayoutTransferRepository;
import com.clenzy.repository.PayoutTransferEventRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly = true)
public class PayoutTransferQueryService {
    private final PayoutTransferRepository transfers;
    private final PayoutTransferEventRepository events;
    private final com.clenzy.repository.BankPayoutObservationRepository bankPayouts;
    private final com.clenzy.repository.UserRepository users;
    private final com.clenzy.repository.OrganizationRepository organizations;
    private final com.clenzy.repository.BaitlyTransferRecoveryRepository recoveries;
    private final com.clenzy.repository.BaitlyCommerceRecoveryRepository commerceRecoveries;
    public PayoutTransferQueryService(PayoutTransferRepository transfers, PayoutTransferEventRepository events,
            com.clenzy.repository.BankPayoutObservationRepository bankPayouts,
            com.clenzy.repository.UserRepository users, com.clenzy.repository.OrganizationRepository organizations,
            com.clenzy.repository.BaitlyTransferRecoveryRepository recoveries,com.clenzy.repository.BaitlyCommerceRecoveryRepository commerceRecoveries) {
        this.transfers = transfers; this.events = events; this.bankPayouts = bankPayouts;
        this.users = users; this.organizations = organizations;
        this.recoveries = recoveries;
        this.commerceRecoveries = commerceRecoveries;
    }
    public Page<PayoutTransferDto> list(Long orgId, int page, int size) {
        return list(orgId, page, size, null, null, "");
    }
    public Page<PayoutTransferDto> list(Long orgId, int page, int size, com.clenzy.model.PayoutTransfer.State state,
            com.clenzy.model.PayoutTransfer.Source source, String search) {
        if (orgId == null || page < 0 || size < 1 || size > 100) throw new IllegalArgumentException("Pagination ou organisation invalide.");
        if (search != null && search.length() > 120) throw new IllegalArgumentException("Recherche trop longue.");
        String term = search == null ? "" : search.trim().toLowerCase(java.util.Locale.ROOT);
        String number = term.startsWith("#") ? term.substring(1) : term;
        Long searchedId = number.matches("[0-9]{1,18}") ? Long.valueOf(number) : null;
        return transfers.findAll((root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.equal(root.get("organizationId"), orgId));
            if (state != null) predicates.add(cb.equal(root.get("state"), state));
            if (source != null) predicates.add(cb.equal(root.get("source"), source));
            if (!term.isEmpty()) {
                String pattern = "%" + term.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
                predicates.add(cb.or(cb.like(cb.lower(root.get("description")), pattern, '!'),
                        cb.like(cb.lower(root.get("externalReference")), pattern, '!'),
                        searchedId == null ? cb.disjunction() : cb.equal(root.get("id"), searchedId)));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        }, PageRequest.of(page, size, org.springframework.data.domain.Sort.by("createdAt", "id").descending())).map(PayoutTransferDto::from);
    }
    public PayoutTransferDto.Detail detail(Long orgId, Long id) {
        if (orgId == null) throw new IllegalArgumentException("Organisation requise.");
        var transfer = transfers.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new NotFoundException("Transfert introuvable dans cette organisation."));
        return new PayoutTransferDto.Detail(PayoutTransferDto.from(transfer),
                events.findByOrganizationIdAndTransferIdOrderByIdAsc(orgId, id).stream().map(PayoutTransferDto.Event::from).toList(),
                bankPayouts.findForTransfer(orgId, id).stream().map(PayoutTransferDto.BankPayout::from).toList(),
                // Seul le bénéficiaire du transfert autorisé est résolu, pas une liste globale de contacts.
                transfer.getBeneficiaryOrganizationId() != null
                    ? organizations.findById(transfer.getBeneficiaryOrganizationId()).map(com.clenzy.model.Organization::getName).orElse(null)
                    : users.findById(transfer.getBeneficiaryUserId()).map(com.clenzy.model.User::getFullName).orElse(null),
                java.util.stream.Stream.concat(recoveries.findHistory(orgId,id).stream().map(PayoutTransferDto.Recovery::from),
                    commerceRecoveries.findByOrganizationIdAndTransferIdOrderById(orgId,id).stream().map(r->new PayoutTransferDto.Recovery(
                        switch(r.getState()){case "RECOVERED"->com.clenzy.model.BaitlyTransferRecovery.State.RECOVERED;case "REVIEW_REQUIRED"->com.clenzy.model.BaitlyTransferRecovery.State.REVIEW_REQUIRED;default->com.clenzy.model.BaitlyTransferRecovery.State.RECOVERING;},
                        r.getAmount(),java.math.BigDecimal.ZERO,transfer.getCurrency(),r.getReference(),r.getCreatedAt(),r.getCreatedAt()))).toList());
    }
}
