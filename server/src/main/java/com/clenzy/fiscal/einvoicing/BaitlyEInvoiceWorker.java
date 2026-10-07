package com.clenzy.fiscal.einvoicing;

import com.clenzy.repository.CountryRepository;
import com.clenzy.tenant.TenantScopedExecutor;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;

@Service
public class BaitlyEInvoiceWorker {
    private final BaitlyEInvoiceStore store;private final EInvoicingService service;private final CountryRepository countries;private final TenantScopedExecutor tenants;
    public BaitlyEInvoiceWorker(BaitlyEInvoiceStore store,EInvoicingService service,CountryRepository countries,TenantScopedExecutor tenants){this.store=store;this.service=service;this.countries=countries;this.tenants=tenants;}
    @Scheduled(initialDelayString="${baitly.einvoice.scan-ms:60000}",fixedDelayString="${baitly.einvoice.scan-ms:60000}")
    @SchedulerLock(name="baitly-einvoice-submissions",lockAtMostFor="PT10M")
    public void resume(){for(var c:store.candidates())try {tenants.runAsOrganization(c.org(),()->{var i=store.invoice(c.org(),c.invoice());service.process(i,countries.findByCountryCode(i.getCountryCode()).orElse(null));});}
        catch(Exception e){org.slf4j.LoggerFactory.getLogger(getClass()).warn("Facture {} : contrôle déclaratif à reprendre ({})",c.invoice(),e.getClass().getSimpleName());}}
}
