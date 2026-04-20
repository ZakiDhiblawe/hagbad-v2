package com.hagbad.springbootbackend.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PasswordUpdateRequest(
    @NotBlank(message = "Current password is required")
    @Size(max = 128, message = "Current password must be at most 128 characters")
    String currentPassword,

    @NotBlank(message = "New password is required")
    @Size(min = 6, max = 128, message = "New password must be between 6 and 128 characters")
    String newPassword
) {

    public PasswordUpdateRequest {
        if (newPassword != null && newPassword.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
            throw new IllegalArgumentException("Password must be at most 72 bytes (bcrypt limit).");
        }
    }
}
