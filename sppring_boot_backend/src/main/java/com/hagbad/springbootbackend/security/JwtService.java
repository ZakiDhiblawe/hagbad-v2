package com.hagbad.springbootbackend.security;

import com.hagbad.springbootbackend.config.AppProperties;
import com.hagbad.springbootbackend.exception.ApiException;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nimbusds.jose.proc.SecurityContext;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class JwtService {

    private final JwtEncoder jwtEncoder;
    private final JwtDecoder jwtDecoder;

    public JwtService(AppProperties properties) {
        String secret = properties.getSecretKey();
        if (!StringUtils.hasText(secret)) {
            throw new IllegalStateException("SECRET_KEY must not be empty");
        }

        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalStateException("SECRET_KEY must be at least 32 bytes for HS256");
        }

        SecretKey key = new SecretKeySpec(keyBytes, "HmacSHA256");
        this.jwtEncoder = new NimbusJwtEncoder(new ImmutableSecret<SecurityContext>(key));
        this.jwtDecoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
    }

    public String createToken(String email, String sessionId, Integer sessionHours) {
        Instant now = Instant.now();
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
            .subject(email)
            .issuedAt(now)
            .claim("sid", sessionId);

        if (sessionHours != null) {
            claims.expiresAt(now.plus(Duration.ofHours(sessionHours)));
        }

        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(header, claims.build())).getTokenValue();
    }

    public Jwt decode(String token) {
        try {
            return jwtDecoder.decode(token);
        } catch (JwtException ex) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid token");
        }
    }
}
