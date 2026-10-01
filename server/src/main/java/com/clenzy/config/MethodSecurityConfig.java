package com.clenzy.config;

import com.clenzy.service.PermissionService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.expression.method.DefaultMethodSecurityExpressionHandler;
import org.springframework.security.access.expression.method.MethodSecurityExpressionHandler;

/**
 * Branche {@link BaitlyPermissionEvaluator} sur les expressions
 * {@code @PreAuthorize}, ce qui rend {@code hasPermission(...)} exploitable.
 *
 * <p>Configuration separee des deux {@code SecurityConfig} a dessein : celles-ci
 * s'excluent par profil ({@code prod} / autres) alors que ce handler doit valoir
 * dans les deux — une expression de securite ne peut pas s'evaluer differemment
 * selon l'environnement.</p>
 *
 * <p>Le bean est {@code static} : Spring Security resout le
 * {@link MethodSecurityExpressionHandler} pendant la construction des
 * intercepteurs de methode, bien avant les beans ordinaires. Une fabrique
 * d'instance obligerait a instancier cette {@code @Configuration} — et tout ce
 * qu'elle injecterait — a ce moment-la. Couple a l'{@link ObjectProvider} de
 * l'evaluateur, rien de metier n'est initialise tant qu'aucune expression n'est
 * evaluee.</p>
 */
@Configuration
public class MethodSecurityConfig {

    @Bean
    static MethodSecurityExpressionHandler methodSecurityExpressionHandler(
            ObjectProvider<PermissionService> permissionServiceProvider) {
        DefaultMethodSecurityExpressionHandler handler = new DefaultMethodSecurityExpressionHandler();
        handler.setPermissionEvaluator(new BaitlyPermissionEvaluator(permissionServiceProvider));
        return handler;
    }
}
