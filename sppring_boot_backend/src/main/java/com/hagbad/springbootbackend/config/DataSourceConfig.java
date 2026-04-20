package com.hagbad.springbootbackend.config;

import com.zaxxer.hikari.HikariDataSource;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import javax.sql.DataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.util.StringUtils;

@Configuration
public class DataSourceConfig {

    @Bean
    @Primary
    public DataSource dataSource(AppProperties properties) {
        ParsedDatabaseConfig parsed = ParsedDatabaseConfig.from(properties);

        HikariDataSource dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(parsed.jdbcUrl());
        if (StringUtils.hasText(parsed.username())) {
            dataSource.setUsername(parsed.username());
        }
        if (StringUtils.hasText(parsed.password())) {
            dataSource.setPassword(parsed.password());
        }
        return dataSource;
    }

    private record ParsedDatabaseConfig(String jdbcUrl, String username, String password) {

        private static ParsedDatabaseConfig from(AppProperties properties) {
            String raw = properties.getDatabaseUrl();
            if (!StringUtils.hasText(raw)) {
                throw new IllegalStateException("DATABASE_URL must not be empty");
            }

            if (raw.startsWith("jdbc:")) {
                return new ParsedDatabaseConfig(
                    raw,
                    blankToNull(properties.getDatabaseUsername()),
                    blankToNull(properties.getDatabasePassword())
                );
            }

            if (!raw.startsWith("postgresql://") && !raw.startsWith("postgres://")) {
                throw new IllegalStateException(
                    "DATABASE_URL must start with jdbc:, postgresql://, or postgres://"
                );
            }

            URI uri = URI.create(raw);
            String host = uri.getHost();
            int port = uri.getPort() > 0 ? uri.getPort() : 5432;
            String databaseName = uri.getPath() == null ? "" : uri.getPath().replaceFirst("^/", "");
            if (!StringUtils.hasText(host) || !StringUtils.hasText(databaseName)) {
                throw new IllegalStateException("DATABASE_URL must include host and database name");
            }

            String jdbcUrl = "jdbc:postgresql://" + host + ":" + port + "/" + databaseName;
            if (StringUtils.hasText(uri.getQuery())) {
                jdbcUrl = jdbcUrl + "?" + uri.getQuery();
            }

            String username = blankToNull(properties.getDatabaseUsername());
            String password = blankToNull(properties.getDatabasePassword());

            if (StringUtils.hasText(uri.getUserInfo())) {
                String[] parts = uri.getUserInfo().split(":", 2);
                username = decode(parts[0]);
                if (parts.length > 1) {
                    password = decode(parts[1]);
                }
            }

            return new ParsedDatabaseConfig(jdbcUrl, username, password);
        }

        private static String decode(String value) {
            return URLDecoder.decode(value, StandardCharsets.UTF_8);
        }

        private static String blankToNull(String value) {
            return StringUtils.hasText(value) ? value : null;
        }
    }
}
