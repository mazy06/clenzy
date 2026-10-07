package com.clenzy.service.payout;

import com.clenzy.dto.BeneficiaryTransferDto;
import com.clenzy.service.paymentconnect.PaymentConnectAccess;
import com.clenzy.service.paymentconnect.PaymentConnectAccess.Scope;
import com.clenzy.tenant.TenantContext;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import java.util.function.Supplier;

/** Les identifiants de bénéficiaire proviennent du JWT et des droits en base, jamais de la requête. */
@Service
public class BeneficiaryPayoutService {
    private final PaymentConnectAccess access;
    private final BeneficiaryPayoutReader reader;
    private final TenantContext tenant;
    public BeneficiaryPayoutService(PaymentConnectAccess access,BeneficiaryPayoutReader reader,TenantContext tenant) {
        this.access=access;this.reader=reader;this.tenant=tenant;
    }
    public Page<BeneficiaryTransferDto> list(String subject,Scope scope,int page) {
        var beneficiary=access.resolve(subject,scope);
        return readAuthorized(() -> reader.list(beneficiary.userId(),scope==Scope.ORGANIZATION ? beneficiary.orgId() : null,page));
    }
    public BeneficiaryTransferDto.Detail detail(String subject,Scope scope,Long id) {
        var beneficiary=access.resolve(subject,scope);
        return readAuthorized(() -> reader.detail(beneficiary.userId(),scope==Scope.ORGANIZATION ? beneficiary.orgId() : null,id));
    }
    private <T> T readAuthorized(Supplier<T> read) {
        // Un prestataire peut recevoir de plusieurs organisations. La transaction de lecture
        // interne contourne uniquement leur cloisonnement après résolution de SON bénéficiaire.
        // Chaque requête conserve le prédicat bénéficiaire et ne sérialise pas les entités internes.
        boolean previous=tenant.isSystemOrg();
        try { tenant.setSystemOrg(true); return read.get(); }
        finally { tenant.setSystemOrg(previous); }
    }
}
