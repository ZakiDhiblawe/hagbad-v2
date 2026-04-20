package com.hagbad.springbootbackend.config;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private String databaseUrl;
    private String databaseUsername;
    private String databasePassword;
    private String secretKey;
    private String filesDir = "backend/files";

    public String getDatabaseUrl() {
        return sanitize(databaseUrl);
    }

    public void setDatabaseUrl(String databaseUrl) {
        this.databaseUrl = databaseUrl;
    }

    public String getDatabaseUsername() {
        return sanitize(databaseUsername);
    }

    public void setDatabaseUsername(String databaseUsername) {
        this.databaseUsername = databaseUsername;
    }

    public String getDatabasePassword() {
        return sanitize(databasePassword);
    }

    public void setDatabasePassword(String databasePassword) {
        this.databasePassword = databasePassword;
    }

    public String getSecretKey() {
        return sanitize(secretKey);
    }

    public void setSecretKey(String secretKey) {
        this.secretKey = secretKey;
    }

    public String getFilesDir() {
        return sanitize(filesDir);
    }

    public void setFilesDir(String filesDir) {
        this.filesDir = filesDir;
    }

    public Path resolveFilesRoot() {
        Path configured = Paths.get(getFilesDir()).toAbsolutePath().normalize();
        if (Files.exists(configured)) {
            return configured;
        }

        Path siblingBackend = Paths.get("../backend/files").toAbsolutePath().normalize();
        if (Files.exists(siblingBackend)) {
            return siblingBackend;
        }

        Path repoBackend = Paths.get("backend/files").toAbsolutePath().normalize();
        if (Files.exists(repoBackend)) {
            return repoBackend;
        }

        return configured;
    }

    private String sanitize(String value) {
        if (!StringUtils.hasText(value)) {
            return value;
        }

        String trimmed = value.trim();
        if (trimmed.length() >= 2) {
            char first = trimmed.charAt(0);
            char last = trimmed.charAt(trimmed.length() - 1);
            if ((first == '"' && last == '"') || (first == '\'' && last == '\'')) {
                return trimmed.substring(1, trimmed.length() - 1).trim();
            }
        }
        return trimmed;
    }
}
