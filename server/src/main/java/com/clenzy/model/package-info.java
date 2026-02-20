/**
 * Définition unique du filtre Hibernate multi-tenant.
 * Chaque entité doit utiliser @Filter("organizationFilter") sans redéfinir @FilterDef.
 */
@org.hibernate.annotations.FilterDef(
    name = "organizationFilter",
    parameters = @org.hibernate.annotations.ParamDef(name = "orgId", type = Long.class)
)
package com.clenzy.model;
