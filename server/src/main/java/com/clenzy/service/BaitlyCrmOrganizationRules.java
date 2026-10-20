package com.clenzy.service;

/** L'équipe plateforme utilise les parcours commerciaux depuis l'organisation interne Baitly. */
public final class BaitlyCrmOrganizationRules {
    private BaitlyCrmOrganizationRules() {}
    public static boolean concierge(String type,boolean platformStaff) {
        return "CONCIERGE".equals(type) || "SYSTEM".equals(type) && platformStaff;
    }
    public static boolean recruitment(String type,boolean platformStaff) {
        return "INDIVIDUAL".equals(type) || concierge(type,platformStaff);
    }
}
