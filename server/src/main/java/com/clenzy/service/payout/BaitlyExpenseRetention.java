package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.repository.ProviderExpenseRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

/** Les dépenses justifient exactement la retenue, sans valoir preuve de paiement au prestataire. */
@Service
public class BaitlyExpenseRetention {
    private final ProviderExpenseRepository expenses;
    private final EntityManager em;
    public BaitlyExpenseRetention(ProviderExpenseRepository expenses, EntityManager em) {
        this.expenses = expenses; this.em = em;
    }

    public List<ProviderExpense> validate(OwnerPayout payout, boolean lock) {
        var rows = expenses.findByPayoutIdAndOrgId(payout.getId(), payout.getOrganizationId()).stream()
                .sorted(java.util.Comparator.comparing(ProviderExpense::getId)).toList();
        BigDecimal total = BigDecimal.ZERO;
        for (var expense : rows) {
            if (lock) em.refresh(expense, LockModeType.PESSIMISTIC_WRITE);
            var property = expense.getProperty();
            if (lock && property != null) em.refresh(property, LockModeType.PESSIMISTIC_WRITE);
            if (!Objects.equals(expense.getOrganizationId(), payout.getOrganizationId())
                    || expense.getOwnerPayout() == null || !Objects.equals(expense.getOwnerPayout().getId(), payout.getId())
                    || property == null || !Objects.equals(property.getOrganizationId(), payout.getOrganizationId())
                    || property.getOwner() == null || !Objects.equals(property.getOwner().getId(), payout.getOwnerId())
                    || expense.getProvider() == null || expense.getAmountTtc() == null || expense.getAmountTtc().signum() <= 0
                    || expense.getAmountHt() == null || expense.getTaxAmount() == null || expense.getTaxAmount().signum() < 0
                    || expense.getAmountHt().signum() <= 0
                    || expense.getAmountHt().add(expense.getTaxAmount()).compareTo(expense.getAmountTtc()) != 0
                    || !payout.getCurrency().equals(expense.getCurrency())
                    || expense.getExpenseDate() == null || expense.getExpenseDate().isBefore(payout.getPeriodStart())
                    || expense.getExpenseDate().isAfter(payout.getPeriodEnd())
                    || (expense.getStatus() != ExpenseStatus.INCLUDED && expense.getStatus() != ExpenseStatus.PAID)) {
                throw new IllegalStateException("Une dépense retenue a changé : rapprochement requis.");
            }
            total = total.add(expense.getAmountTtc());
        }
        if (payout.getExpenses() == null || total.compareTo(payout.getExpenses()) != 0)
            throw new IllegalStateException("La retenue doit correspondre exactement aux dépenses liées au reversement.");
        return rows;
    }
}
