package com.hagbad.springbootbackend.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UserRegisterRequest(
    @NotBlank(message = "Full name is required")
    @Size(min = 2, max = 120, message = "Full name must be between 2 and 120 characters")
    String fullName,

    @NotBlank(message = "Email is required")
    @Size(min = 3, max = 255, message = "Email must be between 3 and 255 characters")
    String email,

    @NotBlank(message = "Password is required")
    @Size(min = 6, max = 128, message = "Password must be between 6 and 128 characters")
    String password,

    @Size(max = 30, message = "Phone must be at most 30 characters")
    String phone
) {

    public UserRegisterRequest {
        if (password != null && password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
            throw new IllegalArgumentException("Password must be at most 72 bytes (bcrypt limit).");
        }
    }
}
