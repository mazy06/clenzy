package com.clenzy.service;

import com.clenzy.model.ServiceQuote;
import com.clenzy.model.ServiceQuoteAmendment;
import com.clenzy.repository.ServiceQuoteAmendmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.Objects;

/** Lecture de l'accord courant ; le devis initial reste inchangé. */
@Service
@Transactional(readOnly = true)
public class ServiceQuoteAgreementService {
    private final ServiceQuoteAmendmentRepository amendments;

    public ServiceQuoteAgreementService(ServiceQuoteAmendmentRepository amendments) {
        this.amendments = amendments;
    }

    public record Agreement(Long quoteId, BigDecimal originalAmount, BigDecimal agreedAmount,
                            String currency, Long amendmentId) {}

    /** Le service appelant doit vérifier les droits de lecture du devis. */
    public Agreement current(ServiceQuote quote) {
        if (quote.getStatus() != ServiceQuote.Status.APPROVED) {
            throw new IllegalStateException("Ce devis ne constitue pas un accord accepté");
        }
        return amendments.findFirstByQuoteIdAndOrganizationIdAndStatusOrderByDecidedAtDescIdDesc(
                quote.getId(), quote.getOrganizationId(), ServiceQuoteAmendment.Status.ACCEPTED)
                .map(amendment -> {
                    if (!Objects.equals(amendment.getInterventionId(), quote.getInterventionId())
                            || !Objects.equals(amendment.getCurrency(), quote.getCurrency())) {
                        throw new IllegalStateException("L'avenant accepté ne correspond pas au devis");
                    }
                    return new Agreement(quote.getId(), quote.getAmount(), amendment.getProposedAmount(),
                            quote.getCurrency(), amendment.getId());
                })
                .orElseGet(() -> new Agreement(quote.getId(), quote.getAmount(), quote.getAmount(), quote.getCurrency(), null));
    }
}
