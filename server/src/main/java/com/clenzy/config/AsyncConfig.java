package com.clenzy.config;

import com.clenzy.tenant.TenantContext;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.support.TaskExecutorAdapter;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.annotation.EnableAsync;

import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

/**
 * Configuration async utilisant les virtual threads (Java 21+).
 * Remplace le SimpleAsyncTaskExecutor par defaut par un executor
 * qui cree un virtual thread par tache.
 *
 * <p>Chaque tache est decoree par {@link ContextPropagatingTaskDecorator}
 * (Z1-BUGS-06) : TenantContext, SecurityContext et MDC sont captures sur le
 * thread appelant, restaures dans le thread @Async et nettoyes en finally.</p>
 */
@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer {

    private final TenantContext tenantContext;

    public AsyncConfig(TenantContext tenantContext) {
        this.tenantContext = tenantContext;
    }

    @Override
    public Executor getAsyncExecutor() {
        TaskExecutorAdapter executor = new TaskExecutorAdapter(Executors.newVirtualThreadPerTaskExecutor());
        executor.setTaskDecorator(new ContextPropagatingTaskDecorator(tenantContext));
        return executor;
    }
}
