package com.clenzy;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ComponentScan(basePackages = "com.clenzy")
@EnableJpaRepositories(basePackages = "com.clenzy.repository")
@EnableAsync
@EnableScheduling
public class ClenzyApplication {

    public static void main(String[] args) {
        SpringApplication.run(ClenzyApplication.class, args);
    }
}
