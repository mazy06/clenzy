package com.clenzy.service;

import java.util.Map;
import java.util.regex.Pattern;

public final class BaitlyCrmCampaignText {
    private static final Pattern VARIABLE=Pattern.compile("\\{\\{([^{}]+)}}");
    private BaitlyCrmCampaignText() {}
    public static void validate(String subject,String body){
        if(BaitlyCrmIdentity.text(subject,200)==null || BaitlyCrmIdentity.text(body,6000)==null || subject.contains("\n") || subject.contains("\r"))throw new IllegalArgumentException("Modèle invalide");
        for(String value:new String[]{subject,body}){
            var matcher=VARIABLE.matcher(value);
            while(matcher.find())if(!java.util.Set.of("name","city","organization").contains(matcher.group(1)))throw new IllegalArgumentException("Variable de modèle inconnue");
            String literal=VARIABLE.matcher(value).replaceAll("");
            if(literal.contains("{{") || literal.contains("}}"))throw new IllegalArgumentException("Syntaxe de variable invalide");
        }
    }
    public static String render(String text,BaitlyCrmCampaignPolicy.Contact contact,String organization){
        var values=Map.of("name",contact.name(),"city",contact.city()==null?"":contact.city(),"organization",organization);
        var matcher=VARIABLE.matcher(text);var result=new StringBuffer();
        while(matcher.find())matcher.appendReplacement(result,java.util.regex.Matcher.quoteReplacement(values.get(matcher.group(1))));
        matcher.appendTail(result);return result.toString();
    }
    public static String footer(String language,String organization,String responseUrl){
        return switch(language){
            case "en" -> "\n\n"+organization+" · via Baitly\nReply or stop receiving these messages: "+responseUrl;
            case "ar" -> "\n\n"+organization+" · عبر Baitly\nللرد أو إيقاف هذه الرسائل: "+responseUrl;
            default -> "\n\n"+organization+" · via Baitly\nRépondre ou ne plus recevoir ces messages : "+responseUrl;
        };
    }
}
