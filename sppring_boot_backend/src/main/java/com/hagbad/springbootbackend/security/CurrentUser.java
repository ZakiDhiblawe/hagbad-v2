package com.hagbad.springbootbackend.security;

public record CurrentUser(Integer id, String email, String sessionId) {
}
