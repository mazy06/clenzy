package com.clenzy.service.assignment;

import com.clenzy.model.ServiceRequest;
import com.clenzy.repository.ProviderTariffRepository;
import com.clenzy.repository.TeamRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;

/** Le tarif canonique est lu à l'émission ; la proposition conserve les conditions annoncées. */
@Service
public class AssignmentCommercialTerms {
    public record Terms(BigDecimal amount,String currency,Long tariffId) {}
    private final ProviderTariffRepository tariffs;
    private final TeamRepository teams;
    private final JdbcTemplate db;
    private final com.clenzy.service.pricing.CleaningPricingEngine cleaning;
    public AssignmentCommercialTerms(ProviderTariffRepository tariffs,TeamRepository teams,JdbcTemplate db,
            com.clenzy.service.pricing.CleaningPricingEngine cleaning) {
        this.tariffs=tariffs; this.teams=teams; this.db=db;
        this.cleaning=cleaning;
    }
    /** Le guide ménage a une devise explicite EUR. Ne jamais deviner celle d'un ancien montant isolé. */
    public Terms offered(ServiceRequest need,String kind,Long target) {
        var suggested=suggestion(need);
        return suggested!=null?suggested:resolve(need,kind,target);
    }
    public Terms suggestion(ServiceRequest need) {
        if (need.getProperty()!=null && need.getServiceType()!=null && java.util.Set.of("CLEANING","EXPRESS_CLEANING","DEEP_CLEANING").contains(need.getServiceType().name())) {
            var guide=cleaning.resolveCleaningPrice(need.getProperty(),need.getServiceType().name(),null,
                need.getDesiredDate()==null?null:need.getDesiredDate().toLocalDate());
            String currency=guide.source()==com.clenzy.service.pricing.CleaningPricingEngine.CleaningPriceSource.PROPERTY_OVERRIDE
                ?need.getProperty().getDefaultCurrency():"EUR";
            if (currency!=null) {
                java.util.Currency.getInstance(currency);
                return new Terms(guide.amount(),currency,null);
            }
        }
        return null;
    }
    public Terms resolve(ServiceRequest need,String kind,Long target) {
        return resolve(need,kind,target,true);
    }
    public Terms preview(ServiceRequest need,String kind,Long target) {
        return resolve(need,kind,target,false);
    }
    private Terms resolve(ServiceRequest need,String kind,Long target,boolean lock) {
        if (target==null) return null;
        Long user="user".equals(kind)?target:teams.findById(target).map(t -> t.getPersonalUserId()).orElse(null);
        // Une équipe collective émet un devis ; ne pas additionner ou inventer les tarifs de ses membres.
        if (user==null) return null;
        if (lock) tariffs.lockUser(user);
        var tariff=tariffs.findByUserIdAndServiceKey(user,need.getServiceItemCode()).orElse(null);
        if (tariff==null || !tariff.isEnabled() || tariff.isNeedsReview() || tariff.getAmount()==null
                || tariff.getAmount().signum()<0 || tariff.getCurrency()==null) return null;
        try { java.util.Currency.getInstance(tariff.getCurrency()); }
        catch (IllegalArgumentException invalid) { return null; }
        BigDecimal amount=switch(tariff.getPricingModel()) {
            case FLAT -> tariff.getAmount();
            case HOURLY -> need.getEstimatedDurationHours()==null || need.getEstimatedDurationHours()<=0 ? null : tariff.getAmount().multiply(BigDecimal.valueOf(need.getEstimatedDurationHours()));
            case PER_SQM -> need.getProperty()==null || need.getProperty().getSquareMeters()==null
                    || need.getProperty().getSquareMeters()<=0?null:tariff.getAmount().multiply(BigDecimal.valueOf(need.getProperty().getSquareMeters()));
            default -> null; // Quantité non renseignée : devis explicite.
        };
        return amount==null?null:new Terms(amount.setScale(2,java.math.RoundingMode.HALF_UP),tariff.getCurrency(),tariff.getId());
    }
    public void snapshot(Long proposal,Terms terms) {
        if (terms!=null) db.update("UPDATE service_assignment_proposals SET agreed_amount=?,agreed_currency=?,tariff_id=? WHERE id=?",terms.amount(),terms.currency(),terms.tariffId(),proposal);
    }
    public Terms snapshot(Long proposal) {
        return db.query("SELECT agreed_amount,agreed_currency,tariff_id FROM service_assignment_proposals WHERE id=? AND agreed_amount IS NOT NULL",
            (r,n) -> new Terms(r.getBigDecimal(1),r.getString(2),r.getObject(3,Long.class)),proposal).stream().findFirst().orElse(null);
    }
    public boolean same(Terms announced,Terms current) {
        return announced!=null && current!=null && announced.amount().compareTo(current.amount())==0
            && java.util.Objects.equals(announced.currency(),current.currency()) && java.util.Objects.equals(announced.tariffId(),current.tariffId());
    }
}
