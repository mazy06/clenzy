package com.clenzy.marketplace.service;

import org.apache.commons.csv.CSVParser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.io.IOException;
import java.sql.Connection;
import java.util.*;
import static com.clenzy.marketplace.service.BaitlyNationalDirectoryRecords.*;

/** One platform feed, no organization context or browser dependency. Checkpoints survive restarts. */
@Service
public class BaitlyNationalDirectorySync {
    private final JdbcTemplate db;
    private final BaitlyNationalDirectorySource source;
    private final TransactionTemplate tx;
    private final boolean enabled;
    public BaitlyNationalDirectorySync(JdbcTemplate db,BaitlyNationalDirectorySource source,PlatformTransactionManager manager,
        @Value("${baitly.directory.national.enabled:true}") boolean enabled) {
        this.db=db;this.source=source;this.tx=new TransactionTemplate(manager);this.enabled=enabled;
    }
    public Map<String,Object> status() {
        var result=new LinkedHashMap<String,Object>();result.put("enabled",enabled);
        var rows=db.queryForList("SELECT phase,scanned,selected,published,failures,retry_at,started_at,updated_at,completed_at FROM baitly_directory_sync WHERE id=true");
        if(!rows.isEmpty())result.putAll(rows.getFirst());
        return result;
    }
    private record Run(UUID revision,String phase,long cursor,String establishments,String units,String establishmentsEtag,String unitsEtag) {}
    private Run current() {
        var rows=db.queryForList("SELECT * FROM baitly_directory_sync WHERE id=true");if(rows.isEmpty())return null;
        var r=rows.getFirst();return new Run((UUID)r.get("revision"),(String)r.get("phase"),((Number)r.get("cursor")).longValue(),(String)r.get("establishments_url"),(String)r.get("units_url"),(String)r.get("establishments_etag"),(String)r.get("units_etag"));
    }
    /** Session-level singleton lock uses one dedicated connection; data writes use short transactions. */
    public void synchronize() throws Exception {
        if(!enabled)return;
        try(Connection lock=Objects.requireNonNull(db.getDataSource()).getConnection()) {
            try(var s=lock.createStatement();var rs=s.executeQuery("SELECT pg_try_advisory_lock(1875440583)")){rs.next();if(!rs.getBoolean(1))return;}
            try {
                if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM baitly_directory_sync WHERE retry_at>now())",Boolean.class)))return;
                Run run=current();
                if(run==null||run.phase().equals("COMPLETED")) {
                    var resources=source.resolve();
                    if(run!=null&&run.establishments().equals(resources.establishments())&&run.units().equals(resources.units())&&Objects.equals(run.establishmentsEtag(),resources.establishmentsEtag())&&Objects.equals(run.unitsEtag(),resources.unitsEtag()))return;
                    tx.executeWithoutResult(t->{
                        db.update("DELETE FROM baitly_directory_sync_stage");
                        db.update("DELETE FROM baitly_directory_sync");
                        db.update("INSERT INTO baitly_directory_sync(id,revision,establishments_url,units_url,establishments_etag,units_etag,phase) VALUES(true,?,?,?,?,?,'ESTABLISHMENTS')",UUID.randomUUID(),resources.establishments(),resources.units(),resources.establishmentsEtag(),resources.unitsEtag());
                    });
                }
                while(!(run=current()).phase().equals("COMPLETED")) {
                    if(Thread.currentThread().isInterrupted()||!lock.isValid(5))throw new IOException("National directory worker interrupted");
                    switch(run.phase()) {
                        case "ESTABLISHMENTS" -> establishments(run,lock);
                        case "UNITS" -> units(run,lock);
                        case "PUBLISH" -> publish(run);
                        default -> throw new IllegalStateException("Unknown directory sync phase");
                    }
                }
            } catch(BaitlyNationalDirectorySource.SourceChangedException e) {
                // A replaced archive cannot be resumed at a row offset from the previous bytes.
                tx.executeWithoutResult(t->{db.update("DELETE FROM baitly_directory_sync_stage");db.update("DELETE FROM baitly_directory_sync");});throw e;
            } catch(Exception e) {
                db.update("UPDATE baitly_directory_sync SET failures=failures+1,retry_at=now()+interval '15 minutes',updated_at=now() WHERE id=true AND phase<>'COMPLETED'");
                throw e;
            } finally {try(var s=lock.createStatement()){s.execute("SELECT pg_advisory_unlock(1875440583)");}}
        }
    }
    private void establishments(Run run,Connection lock) throws Exception {
        long checkpoint=run.cursor(),last=checkpoint;var batch=new ArrayList<Establishment>(1000);
        try(var csv=run.establishmentsEtag()==null?source.open(run.establishments()):source.open(run.establishments(),run.establishmentsEtag())) {
            requireHeaders(csv,"siret","statutDiffusionEtablissement","etatAdministratifEtablissement","activitePrincipaleEtablissement","nomenclatureActivitePrincipaleEtablissement","codePostalEtablissement","libelleCommuneEtablissement","libelleVoieEtablissement");
            for(var record:csv) {
                if(record.getRecordNumber()<=checkpoint)continue;
                String nomenclature=value(record,"nomenclatureActivitePrincipaleEtablissement");
                boolean historical=Set.of("NAF1993","NAFRev1","NAP").contains(nomenclature);
                if(value(record,"etatAdministratifEtablissement").equals("A")&&value(record,"statutDiffusionEtablissement").equals("O")&&!nomenclature.isEmpty()&&!nomenclature.equals("NAFRev2")&&!historical)throw new IOException("Unsupported Sirene activity nomenclature; directory remains unchanged");
                // Real stocks retain active historical records. Do not classify their old
                // activity codes with today's presets, and do not abort the national feed.
                Establishment entry=nomenclature.equals("NAFRev2")?establishment(record):null;if(entry!=null)batch.add(entry);last=record.getRecordNumber();
                if(last-checkpoint>=1000) {
                    checkWorker(lock);saveEstablishments(run,checkpoint,last,batch);checkpoint=last;batch.clear();
                }
            }
        }
        if(last==0)throw new IOException("Empty Sirene establishment stock");
        checkWorker(lock);saveEstablishments(run,checkpoint,last,batch);
        advance(run,"UNITS");
    }
    private void saveEstablishments(Run run,long previous,long cursor,List<Establishment> entries) {
        tx.executeWithoutResult(t->{
            fence(run,"ESTABLISHMENTS",previous);
            db.batchUpdate("""
                INSERT INTO baitly_directory_sync_stage(siret,siren,trade_name,address,city,postal_code,activity,latitude,longitude)
                VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(siret) DO NOTHING
                """,entries,1000,(s,e)->{s.setString(1,e.siret());s.setString(2,e.siren());s.setString(3,e.tradeName());s.setString(4,e.address());s.setString(5,e.city());s.setString(6,e.postal());s.setString(7,e.activity());s.setObject(8,e.latitude());s.setObject(9,e.longitude());});
            db.update("UPDATE baitly_directory_sync SET cursor=?,scanned=scanned+?,selected=selected+?,updated_at=now(),retry_at=NULL WHERE id=true",cursor,cursor-previous,entries.size());
        });
    }
    private void units(Run run,Connection lock) throws Exception {
        long checkpoint=run.cursor(),last=checkpoint;var batch=new ArrayList<Unit>(1000);
        try(var csv=run.unitsEtag()==null?source.open(run.units()):source.open(run.units(),run.unitsEtag())) {
            requireHeaders(csv,"siren","statutDiffusionUniteLegale","etatAdministratifUniteLegale","denominationUniteLegale","nomUniteLegale");
            for(var record:csv) {
                if(record.getRecordNumber()<=checkpoint)continue;
                Unit entry=unit(record);if(entry!=null)batch.add(entry);last=record.getRecordNumber();
                if(last-checkpoint>=1000){checkWorker(lock);saveUnits(run,checkpoint,last,batch);checkpoint=last;batch.clear();}
            }
        }
        if(last==0)throw new IOException("Empty Sirene legal-unit stock");
        checkWorker(lock);saveUnits(run,checkpoint,last,batch);
        if(!Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM baitly_directory_sync_stage WHERE legal_public=true)",Boolean.class)))throw new IOException("No publishable Sirene establishments");
        long previous=Objects.requireNonNull(db.queryForObject("SELECT count(*) FROM baitly_directory_professionals WHERE source_active=true AND suppressed=false",Long.class));
        long selected=Objects.requireNonNull(db.queryForObject("SELECT count(*) FROM baitly_directory_sync_stage WHERE legal_public=true",Long.class));
        if(previous>=1000&&selected<previous/2)throw new IOException("Unexpected Sirene coverage drop; publication paused");
        advance(run,"PUBLISH");
    }
    private void saveUnits(Run run,long previous,long cursor,List<Unit> entries) {
        tx.executeWithoutResult(t->{
            fence(run,"UNITS",previous);
            // A single indexed join per chunk, including non-matching units; memory stays bounded.
            if(!entries.isEmpty())db.execute((org.springframework.jdbc.core.ConnectionCallback<Void>)connection->{
                var sirens=connection.createArrayOf("varchar",entries.stream().map(Unit::siren).toArray());
                var names=connection.createArrayOf("varchar",entries.stream().map(Unit::name).toArray());
                var available=connection.createArrayOf("boolean",entries.stream().map(Unit::available).toArray());
                try(var s=connection.prepareStatement("UPDATE baitly_directory_sync_stage s SET legal_name=v.name,legal_public=v.available FROM unnest(?::varchar[],?::varchar[],?::boolean[]) AS v(siren,name,available) WHERE s.siren=v.siren")) {
                    s.setArray(1,sirens);s.setArray(2,names);s.setArray(3,available);s.executeUpdate();
                } finally {sirens.free();names.free();available.free();}
                return null;
            });
            db.update("UPDATE baitly_directory_sync SET cursor=?,scanned=scanned+?,updated_at=now(),retry_at=NULL WHERE id=true",cursor,cursor-previous);
        });
    }
    private void publish(Run run) {
        tx.executeWithoutResult(t->{
            fence(run,"PUBLISH",run.cursor());
            var rows=db.queryForList("SELECT siret FROM baitly_directory_sync_stage WHERE legal_public=true AND siret>? ORDER BY siret LIMIT 1000",String.format(Locale.ROOT,"%014d",run.cursor()));
            if(rows.isEmpty()) {
                // Only a complete, schema-validated snapshot may retire old source rows.
                // No tenant CRM table is updated by this feed.
                db.update("DELETE FROM baitly_directory_source_evidence WHERE professional_id IN (SELECT id FROM baitly_directory_professionals WHERE national_revision IS DISTINCT FROM ? AND source_active=true)",run.revision());
                db.update("""
                    UPDATE baitly_directory_professionals SET source_active=false,name='Établissement indisponible',address='',city='',postal_code='',
                        sirene_latitude=NULL,sirene_longitude=NULL,phone=NULL,email=NULL,website=NULL,rge_phone=NULL,rge_email=NULL,rge_website=NULL,rge_retrieved_at=NULL,osm_key=NULL,osm_name=NULL,osm_address=NULL,
                        latitude=NULL,longitude=NULL,osm_confirmed_at=NULL,osm_confirmed_by=NULL,osm_retrieved_at=NULL,updated_at=now()
                    WHERE national_revision IS DISTINCT FROM ? AND source_active=true
                    """,run.revision());
                db.update("DELETE FROM baitly_directory_sync_stage");
                db.update("UPDATE baitly_directory_sync SET phase='COMPLETED',completed_at=now(),updated_at=now(),retry_at=NULL WHERE id=true");
                return;
            }
            String last=(String)rows.getLast().get("siret");
            db.update("""
                INSERT INTO baitly_directory_professionals(siret,name,address,city,postal_code,activity,sirene_latitude,sirene_longitude,sirene_retrieved_at,recorded_by,national_revision,source_active)
                SELECT siret,coalesce(nullif(trade_name,''),legal_name),address,city,postal_code,activity,latitude,longitude,now(),'baitly:sirene-stock',?,true
                FROM baitly_directory_sync_stage WHERE legal_public=true AND siret>? AND siret<=?
                ON CONFLICT(siret) DO UPDATE SET name=excluded.name,address=excluded.address,city=excluded.city,postal_code=excluded.postal_code,
                    activity=excluded.activity,sirene_latitude=excluded.sirene_latitude,sirene_longitude=excluded.sirene_longitude,
                    sirene_retrieved_at=excluded.sirene_retrieved_at,national_revision=excluded.national_revision,source_active=true,updated_at=now(),
                    osm_key=CASE WHEN baitly_directory_professionals.address=excluded.address THEN baitly_directory_professionals.osm_key END,
                    osm_name=CASE WHEN baitly_directory_professionals.address=excluded.address THEN baitly_directory_professionals.osm_name END,
                    osm_address=CASE WHEN baitly_directory_professionals.address=excluded.address THEN baitly_directory_professionals.osm_address END,
                    latitude=CASE WHEN baitly_directory_professionals.address=excluded.address THEN baitly_directory_professionals.latitude END,
                    longitude=CASE WHEN baitly_directory_professionals.address=excluded.address THEN baitly_directory_professionals.longitude END,
                    osm_confirmed_at=CASE WHEN baitly_directory_professionals.address=excluded.address THEN baitly_directory_professionals.osm_confirmed_at END,
                    osm_confirmed_by=CASE WHEN baitly_directory_professionals.address=excluded.address THEN baitly_directory_professionals.osm_confirmed_by END,
                    osm_retrieved_at=CASE WHEN baitly_directory_professionals.address=excluded.address THEN baitly_directory_professionals.osm_retrieved_at END,
                    phone=CASE WHEN baitly_directory_professionals.address=excluded.address THEN baitly_directory_professionals.phone END,
                    email=CASE WHEN baitly_directory_professionals.address=excluded.address THEN baitly_directory_professionals.email END,
                    website=CASE WHEN baitly_directory_professionals.address=excluded.address THEN baitly_directory_professionals.website END
                WHERE baitly_directory_professionals.suppressed=false
                """,run.revision(),String.format(Locale.ROOT,"%014d",run.cursor()),last);
            db.update("""
                INSERT INTO baitly_directory_source_evidence(professional_id,source,source_url,licence,retrieved_at,confirmed_by,snapshot)
                SELECT id,'SIRENE',?,'Licence Ouverte 2.0',sirene_retrieved_at,'baitly:sirene-stock',
                    jsonb_build_object('siret',siret,'name',name,'address',address,'city',city,'postalCode',postal_code,'activity',activity,'latitude',sirene_latitude,'longitude',sirene_longitude,'revision',?::text)
                FROM baitly_directory_professionals WHERE national_revision=? AND siret>? AND siret<=? AND suppressed=false
                """,run.establishments(),run.revision().toString(),run.revision(),String.format(Locale.ROOT,"%014d",run.cursor()),last);
            db.update("UPDATE baitly_directory_sync SET cursor=?,published=published+?,updated_at=now(),retry_at=NULL WHERE id=true",Long.parseLong(last),rows.size());
        });
    }
    private void fence(Run run,String phase,long cursor) {
        var rows=db.queryForList("SELECT revision,phase,cursor FROM baitly_directory_sync WHERE id=true FOR UPDATE");
        if(rows.isEmpty()||!run.revision().equals(rows.getFirst().get("revision"))||!phase.equals(rows.getFirst().get("phase"))||((Number)rows.getFirst().get("cursor")).longValue()!=cursor)throw new IllegalStateException("Directory sync checkpoint changed");
    }
    private void advance(Run run,String phase) {tx.executeWithoutResult(t->{db.update("UPDATE baitly_directory_sync SET phase=?,cursor=0,updated_at=now() WHERE id=true AND revision=? AND phase=?",phase,run.revision(),run.phase());});}
    private static void checkWorker(Connection connection) throws Exception {if(Thread.currentThread().isInterrupted()||!connection.isValid(5))throw new IOException("Directory worker lease lost");}
    private static void requireHeaders(CSVParser csv,String... headers) throws IOException {for(String h:headers)if(!csv.getHeaderMap().containsKey(h))throw new IOException("Unexpected Sirene schema: "+h);}
}
