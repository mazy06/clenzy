package com.clenzy.audit;

import com.clenzy.model.AuditAction;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Annotation pour marquer les methodes de service ou controller a auditer automatiquement.
 *
 * Exemple d'utilisation :
 * <pre>
 * {@code @Audited(action = AuditAction.CREATE, entityType = "Property")}
 * public Property createProperty(PropertyDto dto) { ... }
 * </pre>
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Audited {

    /**
     * Type d'action (CREATE, UPDATE, DELETE, etc.)
     */
    AuditAction action();

    /**
     * Type d'entite (Property, Reservation, Intervention, etc.)
     */
    String entityType();

    /**
     * Description optionnelle de l'action.
     */
    String description() default "";
}
