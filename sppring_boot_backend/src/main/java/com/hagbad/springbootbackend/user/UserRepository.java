package com.hagbad.springbootbackend.user;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository {

    private static final String USER_COLUMNS = """
        id,
        full_name,
        email,
        phone,
        profile_image,
        session_hours,
        active_session_id,
        password,
        status,
        created_at
        """;

    private static final RowMapper<UserEntity> USER_ROW_MAPPER = UserRepository::mapUser;

    private final JdbcTemplate jdbcTemplate;

    public UserRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<UserEntity> findById(Integer id) {
        return queryOne("SELECT " + USER_COLUMNS + " FROM users WHERE id = ?", id);
    }

    public Optional<UserEntity> findByEmail(String email) {
        return queryOne("SELECT " + USER_COLUMNS + " FROM users WHERE email = ?", email);
    }

    public boolean existsByEmail(String email) {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM users WHERE email = ?",
            Integer.class,
            email
        );
        return count != null && count > 0;
    }

    public UserEntity insert(
        String fullName,
        String email,
        String phone,
        String hashedPassword,
        UserStatus status
    ) {
        return jdbcTemplate.queryForObject(
            """
            INSERT INTO users (
                full_name,
                email,
                phone,
                profile_image,
                session_hours,
                active_session_id,
                password,
                status
            )
            VALUES (?, ?, ?, NULL, NULL, NULL, ?, CAST(? AS user_status))
            RETURNING
                id,
                full_name,
                email,
                phone,
                profile_image,
                session_hours,
                active_session_id,
                password,
                status,
                created_at
            """,
            USER_ROW_MAPPER,
            fullName,
            email,
            phone,
            hashedPassword,
            status.name()
        );
    }

    public void updateActiveSession(Integer userId, String sessionId) {
        jdbcTemplate.update(
            "UPDATE users SET active_session_id = ? WHERE id = ?",
            sessionId,
            userId
        );
    }

    public void updateProfile(
        Integer userId,
        String fullName,
        String phone,
        String profileImage,
        Integer sessionHours
    ) {
        jdbcTemplate.update(
            """
            UPDATE users
            SET full_name = ?,
                phone = ?,
                profile_image = ?,
                session_hours = ?
            WHERE id = ?
            """,
            fullName,
            phone,
            profileImage,
            sessionHours,
            userId
        );
    }

    public void updatePassword(Integer userId, String hashedPassword) {
        jdbcTemplate.update(
            "UPDATE users SET password = ? WHERE id = ?",
            hashedPassword,
            userId
        );
    }

    private Optional<UserEntity> queryOne(String sql, Object... params) {
        List<UserEntity> rows = jdbcTemplate.query(sql, USER_ROW_MAPPER, params);
        return rows.stream().findFirst();
    }

    private static UserEntity mapUser(ResultSet rs, int rowNum) throws SQLException {
        UserEntity user = new UserEntity();
        user.setId(rs.getInt("id"));
        user.setFullName(rs.getString("full_name"));
        user.setEmail(rs.getString("email"));
        user.setPhone(rs.getString("phone"));
        user.setProfileImage(rs.getString("profile_image"));
        user.setSessionHours((Integer) rs.getObject("session_hours"));
        user.setActiveSessionId(rs.getString("active_session_id"));
        user.setPassword(rs.getString("password"));
        user.setStatus(UserStatus.valueOf(rs.getString("status")));
        user.setCreatedAt(rs.getObject("created_at", OffsetDateTime.class));
        return user;
    }
}
