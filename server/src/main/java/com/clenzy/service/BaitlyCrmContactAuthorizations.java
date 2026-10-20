package com.clenzy.service;
import com.clenzy.model.*;
import com.clenzy.repository.BaitlyCrmContactAuthorizationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;
import static com.clenzy.service.BaitlyCrmIdentity.*;

@Service
@Transactional
public class BaitlyCrmContactAuthorizations {
    public record Command(String channel,String purpose,String basis,String decision,String evidence,Instant occurredAt,Instant expiresAt) {}
    public record Entry(Long id,String channel,String purpose,String basis,String decision,String evidence,
                        Instant occurredAt,Instant recordedAt,Instant expiresAt,String recordedBy,boolean currentIdentity) {}
    private final ProspectService contacts;
    private final BaitlyCrmContactAuthorizationRepository repository;
    public BaitlyCrmContactAuthorizations(ProspectService contacts,BaitlyCrmContactAuthorizationRepository repository) {
        this.contacts=contacts;this.repository=repository;
    }
    @Transactional(readOnly=true)
    public List<Entry> history(Long id) {
        Prospect p=contacts.require(id);
        return repository.findByOrganizationIdAndProspectIdOrderByIdDesc(p.getOrganizationId(),id).stream().map(e -> entry(e,p)).toList();
    }
    public Entry record(Long id,Command c,String subject) {
        Prospect p=contacts.require(id);
        if(p.isArchived()) throw new IllegalArgumentException("Contact archivé");
        validate(p,c);
        if ("GRANTED".equals(c.decision())) {
            boolean olderThanWithdrawal=repository.findByOrganizationIdAndDestinationHashAndPurposeAndChannelOrderByIdDesc(
                    p.getOrganizationId(),destination(p,c.channel()),c.purpose(),c.channel()).stream()
                .filter(previous -> "REVOKED".equals(previous.getDecision()))
                .anyMatch(previous -> !c.occurredAt().isAfter(previous.getOccurredAt()));
            if(olderThanWithdrawal) throw new IllegalArgumentException("Un nouvel accord doit être postérieur au retrait enregistré");
        }
        var e=new BaitlyCrmContactAuthorization();
        e.setOrganizationId(p.getOrganizationId());e.setProspectId(id);
        e.setChannel(c.channel());e.setPurpose(c.purpose());e.setBasis(c.basis());e.setDecision(c.decision());
        e.setEvidence(text(c.evidence(),4000));e.setOccurredAt(c.occurredAt());e.setExpiresAt(c.expiresAt());
        e.setRecordedAt(Instant.now());e.setRecordedBy(subject);
        e.setDestinationHash(destination(p,c.channel()));e.setIdentityVersion(p.getIdentityVersion());
        return entry(repository.saveAndFlush(e),p);
    }
    static void validate(Prospect p,Command c) {
        BaitlyCrmContactValidation.choice(c.channel(),Set.of("EMAIL","SMS","PHONE"));
        BaitlyCrmContactValidation.choice(c.purpose(),Set.of("MANAGEMENT","PROVIDER_RECRUITMENT"));
        BaitlyCrmContactValidation.choice(c.decision(),Set.of("GRANTED","REVOKED"));
        BaitlyCrmContactValidation.choice(c.basis(),Set.of("CONSENT","REQUESTED_CONTACT","B2B_LEGITIMATE_INTEREST"));
        if(text(c.evidence(),4000)==null) throw new IllegalArgumentException("Preuve ou motif obligatoire");
        Instant now=Instant.now();
        if(c.occurredAt()==null || c.occurredAt().isAfter(now)) throw new IllegalArgumentException("Date de recueil invalide");
        if(c.expiresAt()!=null && (!c.expiresAt().isAfter(now) || !c.expiresAt().isAfter(c.occurredAt())))
            throw new IllegalArgumentException("Date d’expiration invalide");
        if(destination(p,c.channel())==null) throw new IllegalArgumentException("Coordonnée absente pour ce canal");
        if("REVOKED".equals(c.decision())) return;
        if(("MANAGEMENT".equals(c.purpose())) != "OWNER".equals(p.getContactType()))
            throw new IllegalArgumentException("Finalité incompatible avec le contact");
        if("B2B_LEGITIMATE_INTEREST".equals(c.basis()) && (!"PROFESSIONAL".equals(p.getContactNature()) || !"EMAIL".equals(c.channel())))
            throw new IllegalArgumentException("L’intérêt légitime B2B exige un contact professionnel et le canal email");
    }
    private static String destination(Prospect p,String channel) {
        return hash("EMAIL".equals(channel)?p.getNormalizedEmail():p.getNormalizedPhone());
    }
    private Entry entry(BaitlyCrmContactAuthorization e,Prospect p) {
        boolean current=!p.isArchived() && e.getIdentityVersion()==p.getIdentityVersion()
            && Objects.equals(e.getDestinationHash(),destination(p,e.getChannel()));
        return new Entry(e.getId(),e.getChannel(),e.getPurpose(),e.getBasis(),e.getDecision(),e.getEvidence(),
            e.getOccurredAt(),e.getRecordedAt(),e.getExpiresAt(),e.getRecordedBy(),current);
    }
}
