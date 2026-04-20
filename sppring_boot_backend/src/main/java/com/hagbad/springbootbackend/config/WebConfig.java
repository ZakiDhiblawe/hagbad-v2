package com.hagbad.springbootbackend.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final Path filesRoot;

    public WebConfig(AppProperties properties) {
        this.filesRoot = properties.resolveFilesRoot();
    }

    @Bean
    public CommandLineRunner ensureFileDirectories() {
        return args -> {
            Files.createDirectories(filesRoot);
            Files.createDirectories(filesRoot.resolve("profile"));
            Files.createDirectories(filesRoot.resolve("groups").resolve("profile"));
            Files.createDirectories(filesRoot.resolve("groups").resolve("cover"));
        };
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry
            .addResourceHandler("/files/**")
            .addResourceLocations(filesRoot.toUri().toString());
    }
}
