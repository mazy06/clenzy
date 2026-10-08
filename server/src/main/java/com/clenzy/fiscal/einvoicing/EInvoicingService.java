package com.clenzy.fiscal.einvoicing;

import com.clenzy.model.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/** Prépare la soumission durablement, puis appelle le partenaire hors transaction SQL. */
@Service
public class EInvoicingService {
    private final EInvoicingProviderRegistry registry;private final BaitlyEInvoiceStore store;
    public EInvoicingService(EInvoicingProviderRegistry registry,BaitlyEInvoiceStore store){this.registry=registry;this.store=store;}
    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    public EInvoiceSubmission process(Invoice invoice,Country country){
        var provider=registry.resolve(country);
        var prepared=store.prepare(invoice.getOrganizationId(),invoice.getId(),country==null?null:country.getCountryCode(),provider);
        if(!prepared.send() && !prepared.reconcile())return prepared.submission();
        EInvoiceResult result;
        try {result=prepared.reconcile()?provider.reconcile(prepared.invoice(),prepared.submission().getExternalRef()):switch(provider.mode()){
            case NONE->EInvoiceResult.notRequired();
            case DGI_CLEARANCE,ZATCA_CLEARANCE->provider.clear(prepared.invoice());
            case FACTURX_PDP,ZATCA_REPORTING->provider.report(prepared.invoice());
        };}catch(Exception e){result=EInvoiceResult.pending("Résultat de transmission inconnu : rapprocher auprès du partenaire avant tout nouvel envoi");}
        return store.finish(invoice.getOrganizationId(),prepared.submission().getId(),result);
    }
}
