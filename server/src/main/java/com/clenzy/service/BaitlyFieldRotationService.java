package com.clenzy.service;

import com.clenzy.util.BaitlySecretValueCodec;
import com.clenzy.config.EncryptedFieldConverter;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.*;
import org.springframework.transaction.support.TransactionTemplate;

/** Explicit bounded rotation primitive. No boot runner, provider, plaintext persistence or key guessing. */
@Service
public class BaitlyFieldRotationService {
    public enum Target {
        USER_FIRST_NAME("users","first_name","firstName",com.clenzy.model.User.class),
        USER_LAST_NAME("users","last_name","lastName",com.clenzy.model.User.class),
        USER_EMAIL("users","email","email",com.clenzy.model.User.class),
        USER_PHONE("users","phone_number","phoneNumber",com.clenzy.model.User.class),
        CHECKIN_ACCESS("check_in_instructions","access_code","accessCode",com.clenzy.model.CheckInInstructions.class),
        CHECKIN_WIFI("check_in_instructions","wifi_password","wifiPassword",com.clenzy.model.CheckInInstructions.class),
        CHECKIN_EXTRA("check_in_instructions","extra_access_codes","extraAccessCodes",com.clenzy.model.CheckInInstructions.class);
        final String table,column;
        Target(String table,String column,String field,Class<?> entity) {
            try {
                var attribute=entity.getDeclaredField(field); var col=attribute.getAnnotation(Column.class);
                var convert=attribute.getAnnotation(Convert.class);
                if(!entity.getAnnotation(Table.class).name().equals(table) || col==null
                    || !(col.name().isEmpty()?field:col.name()).equals(column)
                    || convert==null || convert.converter()!=EncryptedFieldConverter.class
                    || !"organization_id".equals(entity.getDeclaredField("organizationId").getAnnotation(Column.class).name()))
                    throw new IllegalArgumentException();
            } catch(Exception invalid) { throw new IllegalStateException("Baitly rotation mapping unavailable"); }
            this.table=table;this.column=column;
        }
    }
    public enum Outcome { REWRAPPED, ALREADY_CURRENT, ABSENT, CONFLICT, UNCERTAIN }
    private final JdbcTemplate jdbc;
    private final BaitlySecretValueCodec codec;
    private final TenantContext tenant;
    private final TransactionTemplate tx;
    public BaitlyFieldRotationService(JdbcTemplate jdbc,BaitlySecretValueCodec codec,TenantContext tenant,PlatformTransactionManager manager) {
        this.jdbc=jdbc;this.codec=codec;this.tenant=tenant;this.tx=new TransactionTemplate(manager);
        tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }
    /** Repeatable per-cell CAS; a lost response is reconciled by reading the authenticated current value. */
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Outcome rotate(Target target,long id) {
        if(target==null || id<=0) throw new IllegalArgumentException("Baitly rotation target unavailable");
        Long org=tenant.getRequiredOrganizationId();
        try {
            return tx.execute(status->{
                var rows=jdbc.queryForList("SELECT "+target.column+" FROM "+target.table+" WHERE id=? AND organization_id=?",String.class,id,org);
                if(rows.isEmpty() || rows.getFirst()==null || rows.getFirst().isEmpty()) return Outcome.ABSENT;
                String source=rows.getFirst();
                if("ANONYMIZED".equals(source) || source.startsWith("anon_")) return Outcome.ABSENT;
                if(codec.current(source)) { codec.decrypt(source);return Outcome.ALREADY_CURRENT; }
                String next=codec.rewrap(source);
                int changed=jdbc.update("UPDATE "+target.table+" SET "+target.column+"=? WHERE id=? AND organization_id=? AND "+target.column+"=?",next,id,org,source);
                return changed==1?Outcome.REWRAPPED:Outcome.CONFLICT;
            });
        } catch(Exception unavailable) { return Outcome.UNCERTAIN; }
    }
}
