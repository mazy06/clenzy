package com.clenzy.service;

import com.clenzy.model.PaymentStatus;
import com.clenzy.model.User;
import com.clenzy.repository.BaitlyPaymentHistoryRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.Map;

/** Pagination et agrégats Baitly sur le même périmètre organisation / propriétaire. */
@Service
public class BaitlyPaymentHistoryReader {
    private final BaitlyPaymentHistoryRepository repository;
    private final PaymentQueryService payments;
    private final TenantContext tenant;

    public BaitlyPaymentHistoryReader(BaitlyPaymentHistoryRepository repository, PaymentQueryService payments, TenantContext tenant) {
        this.repository=repository; this.payments=payments; this.tenant=tenant;
    }

    @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> page(User user, Long host, PaymentStatus status, LocalDate from, LocalDate to,
                                   String search, int page, int size, boolean includeAmounts) {
        if (page<0 || size<1 || size>500 || (from!=null && to!=null && from.isAfter(to))
                || (search!=null && search.length()>200) || (to!=null && to.equals(LocalDate.MAX)))
            throw new IllegalArgumentException("Filtres de paiement invalides");
        Long owner=user.getRole().isOwnerScoped()?user.getId():host;
        if (user.getRole().isOwnerScoped() && owner==null) throw new org.springframework.security.access.AccessDeniedException("Propriétaire inconnu");
        var filter=repository.prepare(new BaitlyPaymentHistoryRepository.Filter(tenant.getRequiredOrganizationId(),owner,
                status==null?null:status.name(),from,to,search));
        long total=repository.count(filter);
        var keys=repository.page(filter,page,size);
        var result=new java.util.LinkedHashMap<String,Object>();
        result.put("content",payments.hydrateBaitlyPaymentPage(keys));
        result.put("totalElements",total);
        result.put("totalPages",total/size+(total%size==0?0:1));
        result.put("number",page);result.put("size",size);
        if(includeAmounts)result.put("amountGroups",repository.amounts(filter));
        return result;
    }
}
