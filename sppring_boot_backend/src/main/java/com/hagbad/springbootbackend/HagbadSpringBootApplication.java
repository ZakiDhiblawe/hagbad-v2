package com.hagbad.springbootbackend;

import com.hagbad.springbootbackend.config.AppProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
public class HagbadSpringBootApplication {

    public static void main(String[] args) {
        SpringApplication.run(HagbadSpringBootApplication.class, args);
    }
}
