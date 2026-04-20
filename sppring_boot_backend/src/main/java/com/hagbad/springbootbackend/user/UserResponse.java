package com.hagbad.springbootbackend.user;

import java.time.OffsetDateTime;

public record UserResponse(
    Integer id,
    String fullName,
    String email,
    String phone,
    String profileImage,
    Integer sessionHours,
    UserStatus status,
    OffsetDateTime createdAt
) {

    public static UserResponse from(UserEntity user) {
        return new UserResponse(
            user.getId(),
            user.getFullName(),
            user.getEmail(),
            user.getPhone(),
            user.getProfileImage(),
            user.getSessionHours(),
            user.getStatus(),
            user.getCreatedAt()
        );
    }
}
