package com.hagbad.springbootbackend.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hagbad.springbootbackend.exception.ApiException;
import com.hagbad.springbootbackend.user.UserEntity;
import com.hagbad.springbootbackend.user.UserRepository;
import com.hagbad.springbootbackend.user.UserStatus;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public JwtAuthenticationFilter(
        JwtService jwtService,
        UserRepository userRepository,
        ObjectMapper objectMapper
    ) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = header.substring(7).trim();
        if (token.isEmpty()) {
            writeError(response, HttpStatus.UNAUTHORIZED, "Invalid token");
            return;
        }

        try {
            org.springframework.security.oauth2.jwt.Jwt jwt = jwtService.decode(token);
            String email = jwt.getSubject();
            String sessionId = jwt.getClaimAsString("sid");
            if (email == null || sessionId == null || sessionId.isBlank()) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid token");
            }

            UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid token"));

            if (user.getActiveSessionId() == null || !user.getActiveSessionId().equals(sessionId)) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid token");
            }

            if (user.getStatus() == UserStatus.banned) {
                throw new ApiException(HttpStatus.FORBIDDEN, "User is banned");
            }

            CurrentUser currentUser = new CurrentUser(user.getId(), user.getEmail(), sessionId);
            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                currentUser,
                token,
                List.of()
            );
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authentication);
            filterChain.doFilter(request, response);
        } catch (ApiException ex) {
            SecurityContextHolder.clearContext();
            writeError(response, ex.getStatus(), ex.getMessage());
        }
    }

    private void writeError(HttpServletResponse response, HttpStatus status, String message) throws IOException {
        response.setStatus(status.value());
        if (status == HttpStatus.UNAUTHORIZED) {
            response.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
        }
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), Map.of("detail", message));
    }
}
