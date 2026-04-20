package com.hagbad.springbootbackend.groupmember;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class GroupMemberRepository {

    private static final String MEMBER_COLUMNS = """
        gm.id,
        gm.group_id,
        gm.user_id,
        gm.role,
        gm.joined_at
        """;

    private static final String MEMBER_WITH_PROFILE_COLUMNS = """
        gm.id,
        gm.group_id,
        gm.user_id,
        gm.role,
        gm.joined_at,
        u.full_name,
        u.profile_image
        """;

    private static final RowMapper<GroupMemberEntity> MEMBER_ROW_MAPPER = GroupMemberRepository::mapMember;
    private static final RowMapper<GroupMemberEntity> MEMBER_WITH_PROFILE_ROW_MAPPER = GroupMemberRepository::mapMemberWithProfile;

    private final JdbcTemplate jdbcTemplate;

    public GroupMemberRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<GroupMemberEntity> findById(Integer memberId) {
        return queryOne(
            "SELECT " + MEMBER_COLUMNS + " FROM group_members gm WHERE gm.id = ?",
            MEMBER_ROW_MAPPER,
            memberId
        );
    }

    public Optional<GroupMemberEntity> findByIdWithProfile(Integer memberId) {
        return queryOne(
            "SELECT " + MEMBER_WITH_PROFILE_COLUMNS
                + " FROM group_members gm"
                + " JOIN users u ON u.id = gm.user_id"
                + " WHERE gm.id = ?",
            MEMBER_WITH_PROFILE_ROW_MAPPER,
            memberId
        );
    }

    public Optional<GroupMemberEntity> findMembership(Integer groupId, Integer userId) {
        return queryOne(
            "SELECT " + MEMBER_COLUMNS + " FROM group_members gm WHERE gm.group_id = ? AND gm.user_id = ?",
            MEMBER_ROW_MAPPER,
            groupId,
            userId
        );
    }

    public boolean isAdmin(Integer groupId, Integer userId) {
        Integer count = jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM group_members
            WHERE group_id = ?
              AND user_id = ?
              AND role = CAST('admin' AS group_member_role)
            """,
            Integer.class,
            groupId,
            userId
        );
        return count != null && count > 0;
    }

    public GroupMemberEntity insert(Integer groupId, Integer userId, GroupMemberRole role) {
        return jdbcTemplate.queryForObject(
            """
            INSERT INTO group_members (group_id, user_id, role)
            VALUES (?, ?, CAST(? AS group_member_role))
            RETURNING
                id,
                group_id,
                user_id,
                role,
                joined_at
            """,
            MEMBER_ROW_MAPPER,
            groupId,
            userId,
            role.name()
        );
    }

    public List<GroupMemberEntity> listMembers(Integer groupId, GroupMemberRole role, int page, int size) {
        StringBuilder sql = new StringBuilder(
            "SELECT " + MEMBER_WITH_PROFILE_COLUMNS
                + " FROM group_members gm"
                + " JOIN users u ON u.id = gm.user_id"
                + " WHERE gm.group_id = ?"
        );
        List<Object> params = new ArrayList<>();
        params.add(groupId);

        if (role != null) {
            sql.append(" AND gm.role = CAST(? AS group_member_role) ");
            params.add(role.name());
        }

        sql.append(" ORDER BY gm.joined_at ASC, gm.id ASC OFFSET ? LIMIT ? ");
        params.add((page - 1) * size);
        params.add(size);

        return jdbcTemplate.query(sql.toString(), MEMBER_WITH_PROFILE_ROW_MAPPER, params.toArray());
    }

    public long countOtherAdmins(Integer groupId, Integer excludedMemberId) {
        Long count = jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM group_members
            WHERE group_id = ?
              AND role = CAST('admin' AS group_member_role)
              AND id <> ?
            """,
            Long.class,
            groupId,
            excludedMemberId
        );
        return count == null ? 0 : count;
    }

    public Optional<GroupMemberEntity> findSuccessor(Integer groupId, Integer excludedMemberId, GroupMemberRole role) {
        return queryOne(
            "SELECT " + MEMBER_COLUMNS
                + " FROM group_members gm"
                + " WHERE gm.group_id = ?"
                + " AND gm.role = CAST(? AS group_member_role)"
                + " AND gm.id <> ?"
                + " ORDER BY gm.joined_at ASC, gm.id ASC"
                + " LIMIT 1",
            MEMBER_ROW_MAPPER,
            groupId,
            role.name(),
            excludedMemberId
        );
    }

    public void updateRole(Integer memberId, GroupMemberRole role) {
        jdbcTemplate.update(
            "UPDATE group_members SET role = CAST(? AS group_member_role) WHERE id = ?",
            role.name(),
            memberId
        );
    }

    public void deleteById(Integer memberId) {
        jdbcTemplate.update("DELETE FROM group_members WHERE id = ?", memberId);
    }

    private Optional<GroupMemberEntity> queryOne(String sql, RowMapper<GroupMemberEntity> mapper, Object... params) {
        List<GroupMemberEntity> rows = jdbcTemplate.query(sql, mapper, params);
        return rows.stream().findFirst();
    }

    private static GroupMemberEntity mapMember(ResultSet rs, int rowNum) throws SQLException {
        GroupMemberEntity member = new GroupMemberEntity();
        member.setId(rs.getInt("id"));
        member.setGroupId(rs.getInt("group_id"));
        member.setUserId(rs.getInt("user_id"));
        member.setRole(GroupMemberRole.valueOf(rs.getString("role")));
        member.setJoinedAt(rs.getObject("joined_at", OffsetDateTime.class));
        return member;
    }

    private static GroupMemberEntity mapMemberWithProfile(ResultSet rs, int rowNum) throws SQLException {
        GroupMemberEntity member = mapMember(rs, rowNum);
        member.setFullName(rs.getString("full_name"));
        member.setProfileImage(rs.getString("profile_image"));
        return member;
    }
}
