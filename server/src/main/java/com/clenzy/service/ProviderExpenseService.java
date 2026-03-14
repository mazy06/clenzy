package com.clenzy.service;

import com.clenzy.dto.CreateProviderExpenseRequest;
import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ProviderExpenseRepository;
import com.clenzy.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class ProviderExpenseService {

    private static final Logger log = LoggerFactory.getLogger(ProviderExpenseService.class);

    private final ProviderExpenseRepository expenseRepository;
    private final UserRepository userRepository;
    private final PropertyRepository propertyRepository;
    private final InterventionRepository interventionRepository;

    public ProviderExpenseService(ProviderExpenseRepository expenseRepository,
                                  UserRepository userRepository,
                                  PropertyRepository propertyRepository,
                                  InterventionRepository interventionRepository) {
        this.expenseRepository = expenseRepository;
        this.userRepository = userRepository;
        this.propertyRepository = propertyRepository;
        this.interventionRepository = interventionRepository;
    }

    // ── Read ────────────────────────────────────────────────────────────────

    public List<ProviderExpense> getAll(Long orgId) {
        return expenseRepository.findAllByOrgId(orgId);
    }

    public ProviderExpense getById(Long id, Long orgId) {
        return expenseRepository.findByIdAndOrgId(id, orgId)
                .orElseThrow(() -> new IllegalArgumentException("Depense introuvable : " + id));
    }

    public List<ProviderExpense> getByProviderId(Long providerId, Long orgId) {
        return expenseRepository.findByProviderIdAndOrgId(providerId, orgId);
    }

    public List<ProviderExpense> getByPropertyIdAndStatuses(Long propertyId, List<ExpenseStatus> statuses, Long orgId) {
        return expenseRepository.findByPropertyIdAndStatusIn(propertyId, statuses, orgId);
    }

    public List<ProviderExpense> getByPayoutId(Long payoutId, Long orgId) {
        return expenseRepository.findByPayoutIdAndOrgId(payoutId, orgId);
    }

    public List<ProviderExpense> getByStatus(ExpenseStatus status, Long orgId) {
        return expenseRepository.findByStatusAndOrgId(status, orgId);
    }

    /**
     * Trouve les depenses APPROVED liees aux proprietes d'un owner sur une periode.
     * Utilisee par AccountingService lors de la generation du payout.
     */
    public List<ProviderExpense> getApprovedForPayout(Long ownerId, LocalDate from, LocalDate to, Long orgId) {
        return expenseRepository.findApprovedByPropertyOwnerAndPeriod(ownerId, from, to, orgId);
    }

    // ── Write ───────────────────────────────────────────────────────────────

    @Transactional
    public ProviderExpense create(CreateProviderExpenseRequest request, Long orgId) {
        User provider = userRepository.findById(request.providerId())
                .orElseThrow(() -> new IllegalArgumentException("Prestataire introuvable : " + request.providerId()));
        Property property = propertyRepository.findById(request.propertyId())
                .orElseThrow(() -> new IllegalArgumentException("Logement introuvable : " + request.propertyId()));

        ProviderExpense expense = new ProviderExpense();
        expense.setOrganizationId(orgId);
        expense.setProvider(provider);
        expense.setProperty(property);
        expense.setDescription(request.description());
        expense.setAmountHt(request.amountHt());
        expense.setTaxRate(request.taxRate() != null ? request.taxRate() : BigDecimal.ZERO);
        expense.setCategory(request.category());
        expense.setExpenseDate(request.expenseDate());
        expense.setInvoiceReference(request.invoiceReference());
        expense.setNotes(request.notes());
        expense.setStatus(ExpenseStatus.DRAFT);

        // Link optional intervention
        if (request.interventionId() != null) {
            interventionRepository.findById(request.interventionId())
                    .ifPresent(expense::setIntervention);
        }

        computeTaxAndTtc(expense);

        log.info("Created provider expense: {} {} for property {} (provider {})",
                expense.getAmountTtc(), expense.getCurrency(),
                property.getName(), provider.getFullName());
        return expenseRepository.save(expense);
    }

    @Transactional
    public ProviderExpense update(Long id, CreateProviderExpenseRequest request, Long orgId) {
        ProviderExpense expense = getById(id, orgId);
        if (expense.getStatus() != ExpenseStatus.DRAFT) {
            throw new IllegalStateException("Seules les depenses en brouillon peuvent etre modifiees");
        }

        User provider = userRepository.findById(request.providerId())
                .orElseThrow(() -> new IllegalArgumentException("Prestataire introuvable : " + request.providerId()));
        Property property = propertyRepository.findById(request.propertyId())
                .orElseThrow(() -> new IllegalArgumentException("Logement introuvable : " + request.propertyId()));

        expense.setProvider(provider);
        expense.setProperty(property);
        expense.setDescription(request.description());
        expense.setAmountHt(request.amountHt());
        expense.setTaxRate(request.taxRate() != null ? request.taxRate() : BigDecimal.ZERO);
        expense.setCategory(request.category());
        expense.setExpenseDate(request.expenseDate());
        expense.setInvoiceReference(request.invoiceReference());
        expense.setNotes(request.notes());

        if (request.interventionId() != null) {
            interventionRepository.findById(request.interventionId())
                    .ifPresent(expense::setIntervention);
        } else {
            expense.setIntervention(null);
        }

        computeTaxAndTtc(expense);

        return expenseRepository.save(expense);
    }

    @Transactional
    public ProviderExpense approve(Long id, Long orgId) {
        ProviderExpense expense = getById(id, orgId);
        if (expense.getStatus() != ExpenseStatus.DRAFT) {
            throw new IllegalStateException("Seules les depenses en brouillon peuvent etre approuvees");
        }
        expense.setStatus(ExpenseStatus.APPROVED);
        log.info("Approved provider expense #{} ({})", id, expense.getAmountTtc());
        return expenseRepository.save(expense);
    }

    @Transactional
    public ProviderExpense cancel(Long id, Long orgId) {
        ProviderExpense expense = getById(id, orgId);
        if (expense.getStatus() == ExpenseStatus.PAID || expense.getStatus() == ExpenseStatus.INCLUDED) {
            throw new IllegalStateException("Impossible d'annuler une depense deja incluse ou payee");
        }
        expense.setStatus(ExpenseStatus.CANCELLED);
        log.info("Cancelled provider expense #{}", id);
        return expenseRepository.save(expense);
    }

    @Transactional
    public ProviderExpense markAsPaid(Long id, String paymentReference, Long orgId) {
        ProviderExpense expense = getById(id, orgId);
        if (expense.getStatus() != ExpenseStatus.APPROVED && expense.getStatus() != ExpenseStatus.INCLUDED) {
            throw new IllegalStateException("Seules les depenses approuvees ou incluses peuvent etre marquees comme payees");
        }
        expense.setStatus(ExpenseStatus.PAID);
        expense.setPaymentReference(paymentReference);
        log.info("Marked provider expense #{} as paid (ref: {})", id, paymentReference);
        return expenseRepository.save(expense);
    }

    // ── Receipt ──────────────────────────────────────────────────────────────

    @Transactional
    public ProviderExpense attachReceipt(Long id, String receiptPath, Long orgId) {
        ProviderExpense expense = getById(id, orgId);
        expense.setReceiptPath(receiptPath);
        log.info("Attached receipt to expense #{}: {}", id, receiptPath);
        return expenseRepository.save(expense);
    }

    @Transactional
    public ProviderExpense removeReceipt(Long id, Long orgId) {
        ProviderExpense expense = getById(id, orgId);
        expense.setReceiptPath(null);
        log.info("Removed receipt from expense #{}", id);
        return expenseRepository.save(expense);
    }

    // ── Private helpers ─────────────────────────────────────────────────────

    private void computeTaxAndTtc(ProviderExpense expense) {
        BigDecimal amountHt = expense.getAmountHt();
        BigDecimal taxRate = expense.getTaxRate();
        BigDecimal taxAmount = amountHt.multiply(taxRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal amountTtc = amountHt.add(taxAmount);

        expense.setTaxAmount(taxAmount);
        expense.setAmountTtc(amountTtc);
    }
}
