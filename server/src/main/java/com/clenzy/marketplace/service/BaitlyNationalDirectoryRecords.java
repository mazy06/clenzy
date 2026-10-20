package com.clenzy.marketplace.service;

import org.apache.commons.csv.CSVRecord;
import java.util.*;

/** Registered activities are discovery categories, never a certification of services offered. */
final class BaitlyNationalDirectoryRecords {
    private BaitlyNationalDirectoryRecords() {}
    private static final Set<String> PROVIDER_ACTIVITIES=BaitlyProfessionalSearchFilters.SERVICES.values().stream().flatMap(Set::stream).collect(java.util.stream.Collectors.toUnmodifiableSet());
    // Reuse the discovery taxonomy, including custom additions to the shared presets.
    static boolean providerActivity(String code) {
        return PROVIDER_ACTIVITIES.contains(code);
    }
    record Establishment(String siret,String siren,String tradeName,String address,String city,String postal,String activity,Double latitude,Double longitude) {}
    record Unit(String siren,String name,boolean available) {}
    static Establishment establishment(CSVRecord r) {
        String siret=value(r,"siret"),activity=value(r,"activitePrincipaleEtablissement"),city=value(r,"libelleCommuneEtablissement"),postal=value(r,"codePostalEtablissement");
        if(!siret.matches("[0-9]{14}")||!value(r,"statutDiffusionEtablissement").equals("O")||!value(r,"etatAdministratifEtablissement").equals("A")||!providerActivity(activity)||city.isBlank()||!postal.matches("[0-9]{5}"))return null;
        String street=join(value(r,"numeroVoieEtablissement"),value(r,"indiceRepetitionEtablissement"),value(r,"typeVoieEtablissement"),value(r,"libelleVoieEtablissement"));
        if(street.isBlank())return null;
        var point=BaitlySireneLambert93.point(value(r,"coordonneeLambertAbscisseEtablissement"),value(r,"coordonneeLambertOrdonneeEtablissement"),postal);
        return new Establishment(siret,siret.substring(0,9),limit(first(value(r,"enseigne1Etablissement"),value(r,"denominationUsuelleEtablissement")),200),limit(join(street,postal,city),500),limit(city,120),postal,activity,point==null?null:point[0],point==null?null:point[1]);
    }
    static Unit unit(CSVRecord r) {
        String siren=value(r,"siren");if(!siren.matches("[0-9]{9}"))return null;
        boolean available=value(r,"statutDiffusionUniteLegale").equals("O")&&value(r,"etatAdministratifUniteLegale").equals("A");
        String name=available?first(value(r,"denominationUniteLegale"),value(r,"denominationUsuelle1UniteLegale"),join(value(r,"prenomUsuelUniteLegale"),first(value(r,"nomUsageUniteLegale"),value(r,"nomUniteLegale")))):"";
        return new Unit(siren,limit(name,200),available&&!name.isBlank());
    }
    static String value(CSVRecord r,String key) {if(!r.isMapped(key))return "";String v=r.get(key).strip();return "[ND]".equals(v)?"":v;}
    private static String first(String... values){return Arrays.stream(values).filter(s->!s.isBlank()).findFirst().orElse("");}
    private static String join(String... values){return String.join(" ",Arrays.stream(values).filter(s->!s.isBlank()).toList());}
    private static String limit(String value,int max){return value.substring(0,Math.min(max,value.length()));}
}
