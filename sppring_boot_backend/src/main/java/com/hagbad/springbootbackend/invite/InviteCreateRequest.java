package com.hagbad.springbootbackend.invite;

import java.time.OffsetDateTime;

public record InviteCreateRequest(
    Integer groupId,
    OffsetDateTime expiresAt
) {
}
