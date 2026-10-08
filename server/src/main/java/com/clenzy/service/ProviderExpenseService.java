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
import java.util.Objects;
import org.springframework.security.access.AccessDeniedException;

@Service
@Transactional(readOnly = true)
public class ProviderExpenseService {

    private static final Logger log = LoggerFactory.getLogger(ProviderExpenseService.class);

    private final ProviderExpenseRepository expenseRepository;
    private final UserRepository userRepository;
    private final PropertyRepository propertyRepository;
    private final InterventionRepository interventionRepository;
    private final com.clenzy.repository.OrganizationMemberRepository memberships;

    public ProviderExpenseService(ProviderExpenseRepository expenseRepository,
                                  UserRepository userRepository,
                                  PropertyRepository propertyRepository,
                                  InterventionRepository interventionRepository,
                                  com.clenzy.repository.OrganizationMemberRepository memberships) {
        this.expenseRepository = expenseRepository;
        this.userRepository = userRepository;
        this.propertyRepository = propertyRepository;
        this.interventionRepository = interventionRepository;
        this.memberships = memberships;
    }

    // ── Read ────────────────────────────────────────────────────────────────

    public List<ProviderExpense> getAll(Long orgId) {
        return expenseRepository.findAllByOrgId(orgId);
    }

    public ProviderExpense getById(Long id, Long orgId) {
        return expenseRepository.findByIdAndOrgId(id, orgId)
                .orElseThrow(() -> new IllegalArgumentException("Depense introuvable : " + id));
    }

    public List<ProviderExpense> getVisible(String subject, Long orgId, Long providerId, Long propertyId,
            ExpenseStatus status, boolean mine) {
        User me = requester(subject);
        List<ProviderExpense> visible = mine ? getByProviderId(me.getId(), orgId)
                : staff(me) ? getAll(orgId) : expenseRepository.findVisibleToUser(orgId, me.getId());
        return visible.stream().filter(e -> providerId == null || e.getProvider() != null && providerId.equals(e.getProvider().getId()))
                .filter(e -> propertyId == null || e.getProperty() != null && propertyId.equals(e.getProperty().getId()))
                .filter(e -> status == null || status == e.getStatus()).toList();
    }

    public ProviderExpense getReadable(Long id, Long orgId, String subject) {
        User me = requester(subject);
        ProviderExpense expense = getById(id, orgId);
        boolean ownExpense = expense.getProvider() != null && me.getId().equals(expense.getProvider().getId());
        boolean ownProperty = expense.getProperty() != null && Objects.equals(orgId, expense.getProperty().getOrganizationId())
                && expense.getProperty().getOwner() != null && me.getId().equals(expense.getProperty().getOwner().getId());
        if (!staff(me) && !ownExpense && !ownProperty) throw new AccessDeniedException("Dépense inaccessible.");
        return expense;
    }

    private User requester(String subject) {
        if (subject == null || subject.isBlank()) throw new AccessDeniedException("Session utilisateur requise.");
        return userRepository.findByKeycloakId(subject).orElseThrow(() -> new AccessDeniedException("Utilisateur inconnu."));
    }

    private boolean staff(User user) { return user.getRole() != null && user.getRole().isPlatformStaff(); }

    public List<ProviderExpense> getByProviderId(Long providerId, Long orgId) {
        return expenseRepository.findByProviderIdAndOrgId(providerId, orgId);
    }

    /**
     * Mes frais — l'intervenant lit les SIENS.
     *
     * <p>Le fournisseur est resolu depuis le JWT et jamais depuis un parametre :
     * passer un {@code providerId} en requete laisserait n'importe quel compte
     * authentifie lire les frais d'un autre.</p>
     */
    public List<ProviderExpense> getMine(String keycloakId, Long orgId) {
        User me = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));
        return expenseRepository.findByProviderIdAndOrgId(me.getId(), orgId);
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
    @Transactional
    public List<ProviderExpense> getApprovedForPayout(Long ownerId, LocalDate from, LocalDate to, Long orgId) {
        return expenseRepository.findApprovedByPropertyOwnerAndPeriod(ownerId, from, to, orgId);
    }

    // ── Write ───────────────────────────────────────────────────────────────

    @Transactional
    public ProviderExpense create(CreateProviderExpenseRequest request, Long orgId) {
        validateRequest(request);
        User provider = userRepository.findById(request.providerId())
                .orElseThrow(() -> new IllegalArgumentException("Prestataire introuvable : " + request.providerId()));
        Property property = propertyRepository.findById(request.propertyId())
                .orElseThrow(() -> new IllegalArgumentException("Logement introuvable : " + request.propertyId()));
        Intervention intervention = validateLinks(request, orgId, provider, property);

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

        expense.setIntervention(intervention);

        computeTaxAndTtc(expense);

        log.info("Created provider expense: {} {} for property {} (provider {})",
                expense.getAmountTtc(), expense.getCurrency(),
                property.getName(), provider.getFullName());
        return expenseRepository.save(expense);
    }

    @Transactional
    public ProviderExpense update(Long id, CreateProviderExpenseRequest request, Long orgId) {
        validateRequest(request);
        ProviderExpense expense = lock(id, orgId);
        if (expense.getStatus() != ExpenseStatus.DRAFT) {
            throw new IllegalStateException("Seules les depenses en brouillon peuvent etre modifiees");
        }

        User provider = userRepository.findById(request.providerId())
                .orElseThrow(() -> new IllegalArgumentException("Prestataire introuvable : " + request.providerId()));
        Property property = propertyRepository.findById(request.propertyId())
                .orElseThrow(() -> new IllegalArgumentException("Logement introuvable : " + request.propertyId()));
        Intervention intervention = validateLinks(request, orgId, provider, property);

        expense.setProvider(provider);
        expense.setProperty(property);
        expense.setDescription(request.description());
        expense.setAmountHt(request.amountHt());
        expense.setTaxRate(request.taxRate() != null ? request.taxRate() : BigDecimal.ZERO);
        expense.setCategory(request.category());
        expense.setExpenseDate(request.expenseDate());
        expense.setInvoiceReference(request.invoiceReference());
        expense.setNotes(request.notes());

        expense.setIntervention(intervention);

        computeTaxAndTtc(expense);

        return expenseRepository.save(expense);
    }

    @Transactional
    public ProviderExpense approve(Long id, Long orgId) {
        ProviderExpense expense = lock(id, orgId);
        if (expense.getStatus() != ExpenseStatus.DRAFT) {
            throw new IllegalStateException("Seules les depenses en brouillon peuvent etre approuvees");
        }
        expense.setStatus(ExpenseStatus.APPROVED);
        log.info("Approved provider expense #{} ({})", id, expense.getAmountTtc());
        return expenseRepository.save(expense);
    }

    @Transactional
    public ProviderExpense cancel(Long id, Long orgId) {
        ProviderExpense expense = lock(id, orgId);
        if (expense.getStatus() == ExpenseStatus.PAID || expense.getStatus() == ExpenseStatus.INCLUDED) {
            throw new IllegalStateException("Impossible d'annuler une depense deja incluse ou payee");
        }
        expense.setStatus(ExpenseStatus.CANCELLED);
        log.info("Cancelled provider expense #{}", id);
        return expenseRepository.save(expense);
    }

    @Transactional
    public ProviderExpense markAsPaid(Long id, String paymentReference, Long orgId) {
        getById(id, orgId);
        throw new com.clenzy.exception.PaymentEvidenceRequiredException(
                "La confirmation manuelle est désactivée. Une dépense retenue sur un reversement "
                + "ne prouve pas le règlement de son bénéficiaire.");
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

    private ProviderExpense lock(Long id, Long orgId) {
        return expenseRepository.lockByIdAndOrgId(id, orgId)
                .orElseThrow(() -> new IllegalArgumentException("Dépense introuvable : " + id));
    }

    private void validateRequest(CreateProviderExpenseRequest request) {
        if (request == null || request.providerId() == null || request.providerId() <= 0
                || request.propertyId() == null || request.propertyId() <= 0 || request.category() == null
                || request.expenseDate() == null || request.description() == null || request.description().isBlank()
                || request.description().length() > 500 || request.amountHt() == null || request.amountHt().signum() <= 0
                || request.amountHt().stripTrailingZeros().scale() > 2
                || request.taxRate() != null && (request.taxRate().signum() < 0 || request.taxRate().compareTo(BigDecimal.ONE) > 0))
            throw new IllegalArgumentException("Dépense incomplète : montant positif au centime et taux de taxe entre 0 et 1 requis.");
    }

    private Intervention validateLinks(CreateProviderExpenseRequest request, Long orgId, User provider, Property property) {
        if (orgId == null || !Objects.equals(property.getOrganizationId(), orgId)) throw new AccessDeniedException("Logement hors organisation.");
        Intervention mission = request.interventionId() == null ? null : interventionRepository.findById(request.interventionId())
                .orElseThrow(() -> new IllegalArgumentException("Intervention introuvable."));
        if (mission != null && (!Objects.equals(mission.getOrganizationId(), orgId) || mission.getProperty() == null
                || !Objects.equals(mission.getProperty().getId(), property.getId())))
            throw new AccessDeniedException("Intervention et logement incompatibles.");
        boolean assigned = mission != null && (mission.getAssignedUser() != null && provider.getId().equals(mission.getAssignedUser().getId())
                || provider.getId().equals(mission.getAssignedTechnicianId())
                || "USER".equals(mission.getAssignedToType()) && provider.getId().equals(mission.getAssignedToId()));
        if (!Objects.equals(provider.getOrganizationId(), orgId) && !assigned
                && !memberships.existsByOrganizationIdAndUserId(orgId, provider.getId()))
            throw new AccessDeniedException("Prestataire sans rattachement à cette organisation ou à cette mission.");
        return mission;
    }

    private void computeTaxAndTtc(ProviderExpense expense) {
        BigDecimal amountHt = expense.getAmountHt();
        BigDecimal taxRate = expense.getTaxRate();
        BigDecimal taxAmount = amountHt.multiply(taxRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal amountTtc = amountHt.add(taxAmount);

        expense.setTaxAmount(taxAmount);
        expense.setAmountTtc(amountTtc);
    }
}
