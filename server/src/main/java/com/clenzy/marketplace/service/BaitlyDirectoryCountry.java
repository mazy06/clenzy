package com.clenzy.marketplace.service;

import java.util.Locale;
import java.util.Objects;

/** Typed registry identities; foreign identifiers never masquerade as French SIRETs. */
public final class BaitlyDirectoryCountry {
    private BaitlyDirectoryCountry() {}
    /** Read filters accept a bounded union; registry identities remain single-country. */
    public static java.util.List<String> countries(String value){
        String raw=Objects.toString(value,"FR");
        if(raw.length()>20)throw new IllegalArgumentException("Pays invalide");
        var selected=java.util.Arrays.stream(raw.split(",",-1)).map(BaitlyDirectoryCountry::country).distinct().sorted().toList();
        if(selected.isEmpty()||selected.size()>3)throw new IllegalArgumentException("Pays invalide");
        return selected;
    }
    static String readFilter(String value,java.util.List<Object> args){
        var selected=countries(value);args.addAll(selected);
        return selected.size()==1?"country_code=?":"country_code IN ("+String.join(",",java.util.Collections.nCopies(selected.size(),"?"))+")";
    }
    static String serviceFilter(String country,String service,java.util.List<Object> args){
        var services=BaitlyProfessionalSearchFilters.readServices(service);
        if(services.isEmpty())return "";
        var activities=new java.util.TreeSet<String>();services.forEach(code->activities.addAll(BaitlyProfessionalSearchFilters.activities(code)));
        String servicesWhere=services.size()==1?"service=?":"service IN ("+String.join(",",java.util.Collections.nCopies(services.size(),"?"))+")";
        var selected=countries(country);
        if(!selected.contains("FR")){args.addAll(services);return " AND "+servicesWhere;}
        if(selected.size()==1){args.addAll(activities);return " AND activity IN ("+String.join(",",java.util.Collections.nCopies(activities.size(),"?"))+")";}
        args.addAll(activities);args.addAll(services);
        return " AND ((country_code='FR' AND activity IN ("+String.join(",",java.util.Collections.nCopies(activities.size(),"?"))+")) OR (country_code<>'FR' AND "+servicesWhere+"))";
    }
    public static String country(String value){
        String country=Objects.toString(value,"FR").strip().toUpperCase(Locale.ROOT);
        if(!java.util.Set.of("FR","MA","SA").contains(country))throw new IllegalArgumentException("Pays invalide");
        return country;
    }
    public record Identity(String country,String type,String value){
        public Identity {
            country=BaitlyDirectoryCountry.country(country);
            type=Objects.requireNonNull(type).strip().toUpperCase(Locale.ROOT);
            value=Objects.requireNonNull(value).strip();
            if(country.equals("MA")&&type.equals("RC")&&value.contains(":")){
                int colon=value.indexOf(':');value=value.substring(0,colon).strip().toUpperCase(Locale.ROOT)+value.substring(colon);
            }
            boolean valid=switch(country+":"+type){
                case "FR:SIRET" -> value.matches("[0-9]{14}");
                case "MA:ICE" -> value.matches("[0-9]{15}");
                // Registry/competent court is part of the RC identity.
                case "MA:RC" -> value.matches("[^:]{1,50}:[0-9]{1,20}");
                case "SA:UNN" -> value.matches("7[0-9]{9}");
                case "SA:CR" -> value.matches("[0-9]{10}");
                case "SA:OSM", "MA:OSM" -> value.matches("(node|way|relation)/[1-9][0-9]{0,18}");
                case "SA:OVERTURE", "MA:OVERTURE" -> value.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}");
                default -> false;
            };
            if(!valid)throw new IllegalArgumentException("Identifiant d’entreprise invalide");
        }
        public String key(){return country+":"+type+":"+value;}
    }
}
