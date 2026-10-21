package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.text.Normalizer;
import java.util.*;

/** Baitly reference projections. No directors, private owners or invented service offers. */
public final class BaitlyProfessionalData {
    private BaitlyProfessionalData() {}
    public record Business(String siret,String name,String address,String city,String postalCode,
                           String activity,Double latitude,Double longitude,String country,String identifierType,String identifier,String service) {
        public Business(String siret,String name,String address,String city,String postalCode,String activity,Double latitude,Double longitude){
            this(siret,name,address,city,postalCode,activity,latitude,longitude,"FR","SIRET",siret,null);
        }
        public Business {
            country=country==null?"FR":BaitlyDirectoryCountry.country(country);
            identifierType=identifierType==null?"SIRET":identifierType;
            identifier=identifier==null?siret:identifier;
        }
    }
    public record Place(String key,String name,String address,Double latitude,Double longitude,
                        String phone,String email,String website,List<String> signals) {}
    public static List<Business> businesses(JsonNode root) {
        return businesses(root,Set.of(),Set.of(),"");
    }
    public static List<Business> businesses(JsonNode root,Set<String> communes,Set<String> activities,String postal) {
        Map<String,Business> found=new LinkedHashMap<>();
        for(var company:root.path("results")) {
            if(!"O".equals(company.path("statut_diffusion").asText())||!"A".equals(company.path("etat_administratif").asText()))continue;
            var sites=new ArrayList<JsonNode>();company.path("matching_etablissements").forEach(sites::add);
            if(sites.isEmpty())sites.add(company.path("siege"));
            for(var site:sites) {
                if(!"O".equals(site.path("statut_diffusion_etablissement").asText())||!"A".equals(site.path("etat_administratif").asText()))continue;
                // Exact SIRET searches bypass upstream filters. Enforce scope again on every establishment.
                if(!communes.isEmpty()&&!communes.contains(site.path("commune").asText()))continue;
                if(!postal.isBlank()&&!postal.equals(site.path("code_postal").asText()))continue;
                if(!activities.isEmpty()&&!activities.contains(site.path("activite_principale").asText()))continue;
                String siret=text(site,"siret",14),name=text(site,"nom_commercial",200);
                if(name.isBlank())name=text(company,"nom_complet",200);
                if(!siret.matches("[0-9]{14}")||name.isBlank())continue;
                found.putIfAbsent(siret,new Business(siret,name,text(site,"adresse",500),text(site,"libelle_commune",120),
                    text(site,"code_postal",10),text(site,"activite_principale",10),coordinate(site,"latitude",90),coordinate(site,"longitude",180)));
                if(found.size()>=30)return List.copyOf(found.values());
            }
        }
        return List.copyOf(found.values());
    }
    public static List<Place> places(JsonNode root,Business business) {
        Map<String,Place> found=new LinkedHashMap<>();
        for(var row:root.path("elements")) {
            String type=row.path("type").asText();long id=row.path("id").asLong();var tags=row.path("tags");
            if(!List.of("node","way","relation").contains(type)||id<=0)continue;
            String siret=tags.path("ref:FR:SIRET").asText("").strip(),name=text(tags,"name",200);
            if(!siret.isEmpty()&&!siret.equals(business.siret()))continue;
            if(name.isBlank()&&siret.equals(business.siret()))name=business.name();
            if(name.isBlank())continue;
            var point=row.has("center")?row.path("center"):row;
            Double lat=coordinate(point,"lat",90),lon=coordinate(point,"lon",180);
            if(lat==null||lon==null)continue;
            var signals=new ArrayList<String>();
            if(siret.equals(business.siret()))signals.add("SIRET");
            if(normalize(name).equals(normalize(business.name())))signals.add("NAME");
            if(!business.postalCode().isBlank()&&business.postalCode().equals(tags.path("addr:postcode").asText()))signals.add("POSTAL_CODE");
            String address=String.join(" ",text(tags,"addr:housenumber",20),text(tags,"addr:street",200),text(tags,"addr:postcode",10),text(tags,"addr:city",120)).strip();
            found.putIfAbsent(type+"/"+id,new Place(type+"/"+id,name,address,lat,lon,contact(tags,"phone",80),
                email(contact(tags,"email",254)),website(contact(tags,"website",500)),List.copyOf(signals)));
        }
        return found.values().stream().sorted(Comparator.comparingInt((Place p)->p.signals().contains("SIRET")?100:p.signals().size()).reversed()).limit(10).toList();
    }
    public static String normalize(String value){return Normalizer.normalize(Objects.toString(value,""),Normalizer.Form.NFD).replaceAll("\\p{M}","").toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]","");}
    private static String contact(JsonNode tags,String key,int max){String v=text(tags,"contact:"+key,max);return v.isBlank()?text(tags,key,max):v;}
    private static String email(String value){return value.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")?value:"";}
    public static String website(String value){
        try{var uri=URI.create(value);String host=uri.getHost();
            return "https".equalsIgnoreCase(uri.getScheme())&&host!=null&&uri.getUserInfo()==null
                &&host.contains(".")&&!host.matches("[0-9.]+")&&!host.endsWith(".local")&&!host.endsWith(".localhost")?uri.toASCIIString():"";
        }catch(IllegalArgumentException e){return "";}
    }
    private static String text(JsonNode n,String field,int max){String v=n.path(field).asText("").strip();return v.length()<=max?v:"";}
    private static Double coordinate(JsonNode n,String field,int max){double v=n.path(field).asDouble(Double.NaN);return Double.isFinite(v)&&Math.abs(v)<=max?v:null;}
}
