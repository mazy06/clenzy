package com.clenzy.service;

import com.clenzy.dto.CreateProviderExpenseRequest;
import com.clenzy.dto.ProviderExpenseDto;
import com.clenzy.model.ExpenseStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

/** Construit les réponses de Finance pendant que les relations JPA sont encore accessibles. */
@Service
@Transactional(readOnly = true)
public class BaitlyExpenseViews {
    private final ProviderExpenseService expenses;
    public BaitlyExpenseViews(ProviderExpenseService expenses) { this.expenses = expenses; }

    public List<ProviderExpenseDto> visible(String subject, Long org, Long provider, Long property, ExpenseStatus status, boolean mine) {
        return expenses.getVisible(subject, org, provider, property, status, mine).stream().map(ProviderExpenseDto::from).toList();
    }
    public ProviderExpenseDto readable(Long id, Long org, String subject) {
        return ProviderExpenseDto.from(expenses.getReadable(id, org, subject));
    }
    @Transactional
    public ProviderExpenseDto create(CreateProviderExpenseRequest request, Long org) {
        return ProviderExpenseDto.from(expenses.create(request, org));
    }
    @Transactional
    public ProviderExpenseDto update(Long id, CreateProviderExpenseRequest request, Long org) {
        return ProviderExpenseDto.from(expenses.update(id, request, org));
    }
    @Transactional
    public ProviderExpenseDto approve(Long id, Long org) { return ProviderExpenseDto.from(expenses.approve(id, org)); }
    @Transactional
    public ProviderExpenseDto cancel(Long id, Long org) { return ProviderExpenseDto.from(expenses.cancel(id, org)); }
    @Transactional
    public ProviderExpenseDto attachReceipt(Long id, String path, Long org) {
        return ProviderExpenseDto.from(expenses.attachReceipt(id, path, org));
    }
    @Transactional
    public ProviderExpenseDto removeReceipt(Long id, Long org) {
        return ProviderExpenseDto.from(expenses.removeReceipt(id, org));
    }
}
