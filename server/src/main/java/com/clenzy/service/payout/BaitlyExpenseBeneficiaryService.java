package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

/** Le staff désigne la société du créancier ; aucun compte PSP n'est fourni par le navigateur. */
@Service @Transactional(readOnly=true)
public class BaitlyExpenseBeneficiaryService {
    public record Choice(Long userId,Long organizationId,String name,Long companyId,String companyName,boolean locked) {}
    private final ProviderExpenseRepository expenses;
    private final BaitlyExpenseBeneficiaryRepository choices;
    private final UserRepository users;
    public BaitlyExpenseBeneficiaryService(ProviderExpenseRepository expenses,BaitlyExpenseBeneficiaryRepository choices,UserRepository users) {
        this.expenses=expenses; this.choices=choices; this.users=users;
    }
    public Choice choice(Long id,Long org) { return choice(expense(id,org)); }
    private Choice choice(ProviderExpense expense) {
        var selected=choices.findByExpenseIdAndOrganizationId(expense.getId(),expense.getOrganizationId());
        var company=choices.company(expense.getId(),expense.getOrganizationId());
        if(selected.isPresent()) {
            var saved=selected.get();
            require(expense.getProvider()!=null && Objects.equals(saved.getProviderId(),expense.getProvider().getId())
                    && company.isPresent() && Objects.equals(company.get().getId(),saved.getBeneficiaryOrganizationId()),
                    "La société du créancier a changé. Rapprochement requis.");
        }
        require(expense.getProvider()!=null,"Créancier de la dépense absent.");
        return new Choice(selected.isEmpty()?expense.getProvider().getId():null,
                selected.map(BaitlyExpenseBeneficiary::getBeneficiaryOrganizationId).orElse(null),
                selected.isEmpty()?expense.getProvider().getFullName():company.orElseThrow().getName(),
                company.map(BaitlyExpenseBeneficiaryRepository.Company::getId).orElse(null),
                company.map(BaitlyExpenseBeneficiaryRepository.Company::getName).orElse(null),
                selected.isPresent() || expense.getStatus()==ExpenseStatus.PAID || expense.getStatus()==ExpenseStatus.CANCELLED
                        || expense.getPaymentReference()!=null || choices.hasTransfer(expense.getId(),expense.getOrganizationId()));
    }
    public PayoutBeneficiary resolve(ProviderExpense expense) {
        var choice=choice(expense); return new PayoutBeneficiary(choice.userId(),choice.organizationId());
    }
    @Transactional
    public Choice selectCompany(Long id,Long org,Long expectedCompany,String subject) {
        var actor=users.findByKeycloakId(subject).orElseThrow(() -> new com.clenzy.exception.NotFoundException("Utilisateur introuvable."));
        if(actor.getRole()==null || !actor.getRole().isPlatformStaff())
            throw new org.springframework.security.access.AccessDeniedException("Cette décision exige un administrateur plateforme.");
        var expense=expenses.lockByIdAndOrgId(id,org).orElseThrow(() -> new com.clenzy.exception.NotFoundException("Dépense introuvable."));
        var choice=choice(expense);
        require(expectedCompany!=null && expectedCompany.equals(choice.companyId()),"La société ne correspond pas au créancier de cette dépense.");
        if(Objects.equals(choice.organizationId(),expectedCompany)) return choice;
        require(!choice.locked() && Set.of(ExpenseStatus.DRAFT,ExpenseStatus.APPROVED,ExpenseStatus.INCLUDED).contains(expense.getStatus()),
                "Le bénéficiaire est figé par une décision ou un transfert existant.");
        choices.saveAndFlush(new BaitlyExpenseBeneficiary(expense,expectedCompany,actor.getId()));
        return choice(expense);
    }
    private ProviderExpense expense(Long id,Long org) {
        return expenses.findByIdAndOrgId(id,org).orElseThrow(() -> new com.clenzy.exception.NotFoundException("Dépense introuvable."));
    }
    private static void require(boolean valid,String message) { if(!valid) throw new IllegalStateException(message); }
}
