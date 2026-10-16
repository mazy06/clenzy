package com.baitly.iot;

import java.util.Set;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

@Component
public class IotDeploymentGuard implements InitializingBean {
    private final Environment environment;
    public IotDeploymentGuard(Environment environment) { this.environment = environment; }

    @Override public void afterPropertiesSet() {
        Set<String> local = Set.of("127.0.0.1", "::1", "localhost");
        if ((!local.contains(environment.getProperty("server.address", "127.0.0.1"))
                || !local.contains(environment.getProperty("baitly.iot.internal-address", "127.0.0.1")))
                && !environment.acceptsProfiles(Profiles.of("hardened"))) {
            throw new IllegalStateException("Baitly IoT requires the hardened profile outside loopback");
        }
    }
}
