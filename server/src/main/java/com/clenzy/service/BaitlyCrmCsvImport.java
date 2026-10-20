package com.clenzy.service;
import com.clenzy.dto.ProspectDto;
import com.clenzy.model.Prospect;
import com.clenzy.repository.ProspectRepository;
import org.apache.commons.csv.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class BaitlyCrmCsvImport {
    public record Issue(long line,String reason) {}
    public record Report(int imported,int duplicates,int invalid,List<Issue> issues) {}
    private final ProspectRepository repository;
    private final ProspectService contacts;
    public BaitlyCrmCsvImport(ProspectRepository repository,ProspectService contacts) {
        this.repository=repository;this.contacts=contacts;
    }
    @Transactional
    public Report run(MultipartFile file,Prospect.ProspectCategory category,long org,String provenance) {
        if(file.isEmpty() || file.getSize()>5*1024*1024) throw new IllegalArgumentException("Fichier CSV vide ou supérieur à 5 Mo");
        String detail=BaitlyCrmIdentity.text(provenance,1000);
        if(detail==null) detail="Import CSV : "+Objects.toString(BaitlyCrmIdentity.text(file.getOriginalFilename(),200),"fichier");
        try(var reader=new BufferedReader(new InputStreamReader(file.getInputStream(),StandardCharsets.UTF_8))) {
            reader.mark(8192);String first=reader.readLine();reader.reset();
            char delimiter=first!=null && first.contains(";") && !first.contains(",")?';':',';
            CSVFormat format=CSVFormat.DEFAULT.builder().setDelimiter(delimiter).setHeader().setSkipHeaderRecord(true)
                .setIgnoreEmptyLines(true).setTrim(true).get();
            try(var parser=format.parse(reader)) { return parse(parser,category,org,detail); }
        } catch(IOException | UncheckedIOException e) { throw new IllegalArgumentException("Impossible de lire le fichier CSV",e); }
    }
    private Report parse(CSVParser parser,Prospect.ProspectCategory category,long org,String detail) {
        int imported=0,duplicates=0,invalid=0;
        List<Issue> issues=new ArrayList<>();
        for(CSVRecord row:parser) {
            if(row.getRecordNumber()>5000) throw new IllegalArgumentException("Maximum 5 000 lignes par import");
            try {
                Prospect p=contact(row,category,org,detail);
                if(!contacts.matches(p).isEmpty()) { duplicates++;continue; }
                repository.saveAndFlush(p);imported++;
            } catch(IllegalArgumentException e) {
                invalid++;
                if(issues.size()<50) issues.add(new Issue(row.getRecordNumber()+1,"INVALID_CONTACT"));
            }
        }
        return new Report(imported,duplicates,invalid,List.copyOf(issues));
    }
    private Prospect contact(CSVRecord row,Prospect.ProspectCategory category,long org,String detail) {
        Prospect p=new Prospect();p.setOrganizationId(org);
        p.setContactType(category==Prospect.ProspectCategory.OWNERS?"OWNER":"PROVIDER");
        ProspectDto d=new ProspectDto(null,get(row,"business_name","name","company_name"),get(row,"email","contact_email","business_email"),
            get(row,"phone","phone_number","telephone"),get(row,"city","headquarters_city","location"),
            get(row,"linkedin_categories","industry","specialty","naics_labels"),category.name(),null,get(row,"notes"),
            https(get(row,"domain","website","website_url")),https(get(row,"linkedin_url","linkedin","linkedin_company_url")),
            get(row,"revenue_range","revenue","annual_revenue"),get(row,"number_of_employees_range","employees","employee_count","company_size"),
            p.getContactType(),"UNKNOWN","CSV",detail,null,null,false);
        BaitlyCrmContactValidation.apply(p,d);BaitlyCrmContactValidation.source(p,d,"CSV");
        return p;
    }
    private String get(CSVRecord row,String... names) {
        for(String name:names) for(String header:row.getParser().getHeaderNames()) {
            if(!header.replace("\uFEFF","").trim().equalsIgnoreCase(name)) continue;
            String value=row.get(header);
            if(value!=null && !value.isBlank() && !value.equalsIgnoreCase("null")) return value.trim();
        }
        return null;
    }
    private String https(String value) { return value==null || value.contains("://")?value:"https://"+value; }
}
