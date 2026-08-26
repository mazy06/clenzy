package com.clenzy.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.TaxFiling;
import com.clenzy.repository.TaxFilingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Registre des déclarations de taxe de séjour (vague M-A). Le scan trimestriel de la
 * constellation crée l'entrée DUE ; l'opérateur marque le dépôt (FILED) puis le
 * paiement (PAID) — transitions CAS, référence de dépôt/paiement tracée.
 */
@Service
public class TaxFilingService {

    private final TaxFilingRepository repository;
    private final Clock clock;

    public TaxFilingService(TaxFilingRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<TaxFiling> list(Long orgId) {
        return repository.findByOrganizationIdOrderByPeriodStartDesc(orgId);
    }

    /**
     * Crée (si absente) l'entrée DUE du trimestre — idempotent : la contrainte unique
     * (org, period_start) absorbe les scans répétés ; le montant n'est PAS re-touché
     * une fois l'entrée créée (le calcul de clôture fait foi).
     */
    @Transactional
    public TaxFiling ensureDueFiling(Long orgId, Long propertyId, LocalDate periodStart,
                                     LocalDate periodEnd, BigDecimal amount, String currency) {
        final Optional<TaxFiling> existing = repository
                .findByOrganizationIdAndPropertyIdAndPeriodStart(orgId, propertyId, periodStart);
        if (existing.isPresent()) {
            return existing.get();
        }
        final TaxFiling filing = new TaxFiling();
        filing.setOrganizationId(orgId);
        filing.setPropertyId(propertyId);
        filing.setPeriodStart(periodStart);
        filing.setPeriodEnd(periodEnd);
        filing.setAmount(amount);
        filing.setCurrency(currency != null ? currency : "EUR");
        try {
            return repository.save(filing);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // Course entre deux scans : l'unique a tranché, on relit le gagnant.
            return repository.findByOrganizationIdAndPropertyIdAndPeriodStart(
                            orgId, propertyId, periodStart)
                    .orElseThrow(() -> e);
        }
    }

    /** Dépôt déclaré (manuel pour l'instant). Échec explicite si déjà FILED/PAID. */
    @Transactional
    /**
     * @param depositedOn date du dépôt EFFECTIF déclarée par l'opérateur.
     *                    {@code null} = inconnue ; l'horodatage de saisie
     *                    ({@code filedAt}) est posé dans tous les cas et reste
     *                    la trace d'audit.
     */
    public void markFiled(Long id, Long orgId, java.time.LocalDate depositedOn, String reference) {
        if (repository.markFiled(id, orgId, clock.instant(), depositedOn, blankToNull(reference)) == 0) {
            throw new IllegalStateException("Déclaration introuvable ou déjà déposée");
        }
    }

    /** Paiement confirmé. Échec explicite si pas encore FILED. */
    @Transactional
    public void markPaid(Long id, Long orgId, String reference) {
        if (repository.markPaid(id, orgId, clock.instant(), blankToNull(reference)) == 0) {
            throw new IllegalStateException("Déclaration introuvable ou pas encore déposée");
        }
    }

    @Transactional(readOnly = true)
    public TaxFiling requireOwned(Long id, Long orgId) {
        return repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new NotFoundException("Déclaration introuvable : " + id));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
