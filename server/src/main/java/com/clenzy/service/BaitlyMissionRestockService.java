package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

@Service @Transactional
public class BaitlyMissionRestockService {
    public record Line(Long itemId,int expected,int observed,int added,BigDecimal unitPrice){}
    public record Request(UUID requestKey,List<Line> lines){}
    public record Entry(Long itemId,String name,String unit,int before,int observed,int added,int after,BigDecimal unitPrice,BigDecimal amount,String currency,Long expenseId){}
    public record Receipt(String requestKey,Instant date,String actor,List<Entry> entries){}
    public record Stock(Long id,String name,String unit,int quantity,int threshold,int suggested,String photoUrl,String catalogKey){}
    public record Overview(List<Stock> items,String currency,List<Receipt> history){}
    private final InterventionRepository missions;
    private final InterventionAccessPolicy access;
    private final PropertyStockItemRepository stocks;
    private final BaitlyRestockLedgerRepository ledger;
    private final ProviderExpenseRepository expenses;
    private final UserService users;
    private final ObjectMapper json;
    private final Clock clock;
    public BaitlyMissionRestockService(InterventionRepository missions,InterventionAccessPolicy access,PropertyStockItemRepository stocks,
        BaitlyRestockLedgerRepository ledger,ProviderExpenseRepository expenses,UserService users,ObjectMapper json,Clock clock) {
        this.missions=missions;this.access=access;this.stocks=stocks;this.ledger=ledger;this.expenses=expenses;this.users=users;this.json=json;this.clock=clock;
    }
    private Intervention authorized(Long id,Jwt jwt) {
        var mission=missions.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        access.assertCanAccess(mission,jwt);return mission;
    }
    @Transactional(readOnly=true)
    public Overview list(Long id,Jwt jwt) {
        var mission=authorized(id,jwt);var property=mission.getProperty();
        if(property==null)return new Overview(List.of(),"EUR",List.of());
        return new Overview(stocks.findByPropertyIdAndOrganizationIdOrderByNameAsc(property.getId(),property.getOrganizationId()).stream()
            .map(item -> new Stock(item.getId(),item.getName(),item.getUnit(),item.getQuantity(),item.getReorderThreshold(),item.getReorderQuantity(),item.getPhotoUrl(),item.getCatalogKey())).toList(),
            property.getDefaultCurrency(),ledger.findByInterventionIdAndOrganizationIdOrderByCreatedAtAsc(id,mission.getOrganizationId()).stream().map(row -> read(row.getReceipt())).toList());
    }
    public Receipt record(Long id,Request request,Jwt jwt) {
        var initial=authorized(id,jwt); access.requireAssignee(initial,jwt);
        var mission=missions.findForReview(id,initial.getOrganizationId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        access.requireAssignee(mission,jwt);
        if(request==null || request.requestKey()==null || request.lines()==null || request.lines().isEmpty() || request.lines().size()>200) bad("Réassort invalide.");
        var sorted=request.lines().stream().sorted(Comparator.comparing(Line::itemId,Comparator.nullsFirst(Comparator.naturalOrder()))).toList();
        var seen=new HashSet<Long>();
        for(var line:sorted) {
            if(line.itemId()==null || !seen.add(line.itemId()) || line.expected()<0 || line.observed()<0 || line.added()<0 || line.observed()>10000 || line.added()>10000
                || (line.added()>0 && (line.unitPrice()==null || line.unitPrice().signum()<0 || line.unitPrice().scale()>2 || line.unitPrice().compareTo(new BigDecimal("100000"))>0))) bad("Quantités ou prix invalides.");
        }
        String body=write(new Request(request.requestKey(),sorted));
        var previous=ledger.findByRequestKey(request.requestKey().toString());
        if(previous.isPresent()) {
            var row=previous.get();
            if(!row.getInterventionId().equals(id) || !row.getActorKey().equals(jwt.getSubject()) || !row.getRequestBody().equals(body)) throw new ResponseStatusException(HttpStatus.CONFLICT,"Référence déjà utilisée.");
            return read(row.getReceipt());
        }
        if(mission.getStatus()!=InterventionStatus.IN_PROGRESS || mission.getProperty()==null) bad("Le réassort nécessite une intervention en cours avec un logement.");
        if(mission.getBaitlyPausedAt()!=null) throw new ResponseStatusException(HttpStatus.CONFLICT,"Intervention en pause.");
        var property=mission.getProperty(); var provider=users.findByKeycloakId(jwt.getSubject());
        if(provider==null) throw new org.springframework.security.access.AccessDeniedException("Compte introuvable.");
        String currency=property.getDefaultCurrency();
        try { Currency.getInstance(currency); } catch(Exception invalid) { bad("Devise du logement non renseignée."); }
        var entries=new ArrayList<Entry>();
        for(var line:sorted) {
            var item=stocks.lockForRestock(line.itemId(),property.getOrganizationId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            if(!item.getPropertyId().equals(property.getId())) throw new org.springframework.security.access.AccessDeniedException("Article d’un autre logement.");
            if(item.getQuantity()!=line.expected()) throw new ResponseStatusException(HttpStatus.CONFLICT,"Le stock a changé. Rechargez les articles avant de confirmer.");
            int before=item.getQuantity(); int after=Math.addExact(line.observed(),line.added());
            BigDecimal price=line.added()>0?line.unitPrice():BigDecimal.ZERO;
            BigDecimal amount=price.multiply(BigDecimal.valueOf(line.added())); Long expenseId=null;
            if(amount.signum()>0) {
                var expense=new ProviderExpense(); expense.setOrganizationId(mission.getOrganizationId());expense.setProvider(provider);expense.setProperty(property);expense.setIntervention(mission);
                expense.setDescription("Réassort : "+line.added()+" × "+item.getName()); expense.setAmountHt(amount);expense.setAmountTtc(amount);expense.setTaxRate(BigDecimal.ZERO);expense.setTaxAmount(BigDecimal.ZERO);
                expense.setCurrency(currency);expense.setCategory(ExpenseCategory.SUPPLIES);expense.setExpenseDate(LocalDate.now(clock));expense.setStatus(ExpenseStatus.DRAFT);
                expense.setInvoiceReference("BAITLY-RESTOCK-"+request.requestKey());
                expense.setNotes("Prix déclaré TTC, TVA non ventilée. Quantités et coût à valider avant facturation.");
                expenseId=expenses.save(expense).getId();
            }
            item.setQuantity(after); if(line.added()>0)item.setLastRestockedAt(clock.instant()); stocks.save(item);
            entries.add(new Entry(item.getId(),item.getName(),item.getUnit(),before,line.observed(),line.added(),after,price,amount,currency,expenseId));
        }
        var receipt=new Receipt(request.requestKey().toString(),clock.instant(),jwt.getSubject(),entries);
        ledger.save(new BaitlyRestockLedger(request.requestKey().toString(),mission.getOrganizationId(),id,property.getId(),jwt.getSubject(),body,write(receipt),clock.instant()));
        return receipt;
    }
    private static void bad(String message){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,message);}
    private String write(Object value){try{return json.writeValueAsString(value);}catch(Exception error){throw new IllegalArgumentException("Réassort illisible.",error);}}
    private Receipt read(String value){try{return json.readValue(value,Receipt.class);}catch(Exception error){throw new IllegalStateException("Historique de réassort illisible.",error);}}
}
