package com.hagbad.springbootbackend.group;

import com.hagbad.springbootbackend.groupmember.GroupMemberRole;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class GroupRepository {

    private static final String GROUP_COLUMNS = """
        id,
        name,
        description,
        visible,
        group_image,
        cover_image,
        privacy,
        created_by,
        status,
        created_at
        """;

    private static final RowMapper<GroupEntity> GROUP_ROW_MAPPER = GroupRepository::mapGroup;

    private final JdbcTemplate jdbcTemplate;

    public GroupRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<GroupEntity> findById(Integer id) {
        return queryOne("SELECT " + GROUP_COLUMNS + " FROM groups WHERE id = ?", id);
    }

    public boolean existsByName(String name) {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM groups WHERE name = ?",
            Integer.class,
            name
        );
        return count != null && count > 0;
    }

    public boolean existsByNameExcludingId(String name, Integer groupId) {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM groups WHERE name = ? AND id <> ?",
            Integer.class,
            name,
            groupId
        );
        return count != null && count > 0;
    }

    public GroupEntity insert(
        String name,
        String description,
        GroupPrivacy privacy,
        boolean visible,
        Integer createdBy
    ) {
        return jdbcTemplate.queryForObject(
            """
            INSERT INTO groups (
                name,
                description,
                visible,
                group_image,
                cover_image,
                privacy,
                created_by,
                status
            )
            VALUES (?, ?, ?, NULL, NULL, CAST(? AS group_privacy), ?, CAST('active' AS group_status))
            RETURNING
                id,
                name,
                description,
                visible,
                group_image,
                cover_image,
                privacy,
                created_by,
                status,
                created_at
            """,
            GROUP_ROW_MAPPER,
            name,
            description,
            visible,
            privacy.value(),
            createdBy
        );
    }

    public void update(GroupEntity group) {
        jdbcTemplate.update(
            """
            UPDATE groups
            SET name = ?,
                description = ?,
                visible = ?,
                group_image = ?,
                cover_image = ?,
                privacy = CAST(? AS group_privacy),
                status = CAST(? AS group_status)
            WHERE id = ?
            """,
            group.getName(),
            group.getDescription(),
            group.isVisible(),
            group.getGroupImage(),
            group.getCoverImage(),
            group.getPrivacy().value(),
            group.getStatus().name(),
            group.getId()
        );
    }

    public List<GroupEntity> listGroups(
        Integer currentUserId,
        boolean mine,
        boolean explore,
        String search,
        GroupMemberRole role,
        boolean managed,
        int page,
        int size
    ) {
        StringBuilder sql = new StringBuilder("SELECT " + GROUP_COLUMNS + " FROM groups g WHERE ");
        List<Object> params = new ArrayList<>();

        if (mine) {
            if (managed) {
                sql.append("""
                    (
                        g.created_by = ?
                        OR g.id IN (
                            SELECT gm.group_id
                            FROM group_members gm
                            WHERE gm.user_id = ?
                              AND gm.role IN (CAST('admin' AS group_member_role), CAST('moderator' AS group_member_role))
                        )
                    )
                    """);
                params.add(currentUserId);
                params.add(currentUserId);
            } else if (role == GroupMemberRole.admin) {
                sql.append("""
                    (
                        g.created_by = ?
                        OR g.id IN (
                            SELECT gm.group_id
                            FROM group_members gm
                            WHERE gm.user_id = ?
                              AND gm.role = CAST(? AS group_member_role)
                        )
                    )
                    """);
                params.add(currentUserId);
                params.add(currentUserId);
                params.add(role.name());
            } else if (role != null) {
                sql.append("""
                    g.id IN (
                        SELECT gm.group_id
                        FROM group_members gm
                        WHERE gm.user_id = ?
                          AND gm.role = CAST(? AS group_member_role)
                    )
                    """);
                params.add(currentUserId);
                params.add(role.name());
            } else {
                sql.append("""
                    (
                        g.created_by = ?
                        OR g.id IN (
                            SELECT gm.group_id
                            FROM group_members gm
                            WHERE gm.user_id = ?
                        )
                    )
                    """);
                params.add(currentUserId);
                params.add(currentUserId);
            }
        } else if (explore) {
            sql.append("""
                g.visible = TRUE
                AND g.created_by <> ?
                AND g.id NOT IN (
                    SELECT gm.group_id
                    FROM group_members gm
                    WHERE gm.user_id = ?
                )
                """);
            params.add(currentUserId);
            params.add(currentUserId);
        } else {
            sql.append("""
                (
                    g.created_by = ?
                    OR g.id IN (
                        SELECT gm.group_id
                        FROM group_members gm
                        WHERE gm.user_id = ?
                    )
                    OR (
                        g.privacy = CAST('public' AS group_privacy)
                        AND g.visible = TRUE
                    )
                )
                """);
            params.add(currentUserId);
            params.add(currentUserId);
        }

        if (search != null && !search.isBlank()) {
            sql.append(" AND g.name ILIKE ? ");
            params.add("%" + search.trim() + "%");
        }

        sql.append(" ORDER BY g.created_at DESC OFFSET ? LIMIT ? ");
        params.add((page - 1) * size);
        params.add(size);

        return jdbcTemplate.query(sql.toString(), GROUP_ROW_MAPPER, params.toArray());
    }

    public void deleteGroupWithDependencies(Integer groupId) {
        List<Integer> cycleIds = tableExists("cycles")
            ? jdbcTemplate.queryForList("SELECT id FROM cycles WHERE group_id = ?", Integer.class, groupId)
            : List.of();

        List<Integer> cycleMemberIds = !cycleIds.isEmpty() && tableExists("cycle_members")
            ? queryIdsIn("SELECT id FROM cycle_members WHERE cycle_id IN (%s)", cycleIds)
            : List.of();

        if (!cycleMemberIds.isEmpty() && tableExists("payments")) {
            deleteByIds("payments", "cycle_member_id", cycleMemberIds);
        }
        if (!cycleMemberIds.isEmpty() && tableExists("payouts")) {
            deleteByIds("payouts", "cycle_member_id", cycleMemberIds);
        }
        if (!cycleIds.isEmpty() && tableExists("payments")) {
            deleteByIds("payments", "cycle_id", cycleIds);
        }
        if (!cycleIds.isEmpty() && tableExists("payouts")) {
            deleteByIds("payouts", "cycle_id", cycleIds);
        }
        if (!cycleIds.isEmpty() && tableExists("cycle_members")) {
            deleteByIds("cycle_members", "cycle_id", cycleIds);
        }
        if (!cycleIds.isEmpty() && tableExists("cycles")) {
            deleteByIds("cycles", "id", cycleIds);
        }

        deleteIfTableExists("group_settings", "DELETE FROM group_settings WHERE group_id = ?", groupId);
        deleteIfTableExists("group_members", "DELETE FROM group_members WHERE group_id = ?", groupId);
        deleteIfTableExists("invites", "DELETE FROM invites WHERE group_id = ?", groupId);
        deleteIfTableExists("join_requests", "DELETE FROM join_requests WHERE group_id = ?", groupId);
        jdbcTemplate.update("DELETE FROM groups WHERE id = ?", groupId);
    }

    private List<Integer> queryIdsIn(String sqlTemplate, List<Integer> ids) {
        String placeholders = String.join(",", Collections.nCopies(ids.size(), "?"));
        return jdbcTemplate.queryForList(sqlTemplate.formatted(placeholders), Integer.class, ids.toArray());
    }

    private void deleteByIds(String tableName, String columnName, List<Integer> ids) {
        String placeholders = String.join(",", Collections.nCopies(ids.size(), "?"));
        String sql = "DELETE FROM " + tableName + " WHERE " + columnName + " IN (" + placeholders + ")";
        jdbcTemplate.update(sql, ids.toArray());
    }

    private void deleteIfTableExists(String tableName, String sql, Object... params) {
        if (tableExists(tableName)) {
            jdbcTemplate.update(sql, params);
        }
    }

    private boolean tableExists(String tableName) {
        String value = jdbcTemplate.queryForObject(
            "SELECT to_regclass(?)",
            String.class,
            "public." + tableName
        );
        return value != null;
    }

    private Optional<GroupEntity> queryOne(String sql, Object... params) {
        List<GroupEntity> rows = jdbcTemplate.query(sql, GROUP_ROW_MAPPER, params);
        return rows.stream().findFirst();
    }

    private static GroupEntity mapGroup(ResultSet rs, int rowNum) throws SQLException {
        GroupEntity group = new GroupEntity();
        group.setId(rs.getInt("id"));
        group.setName(rs.getString("name"));
        group.setDescription(rs.getString("description"));
        group.setVisible(rs.getBoolean("visible"));
        group.setGroupImage(rs.getString("group_image"));
        group.setCoverImage(rs.getString("cover_image"));
        group.setPrivacy(GroupPrivacy.fromDatabase(rs.getString("privacy")));
        group.setCreatedBy(rs.getInt("created_by"));
        group.setStatus(GroupStatus.valueOf(rs.getString("status")));
        group.setCreatedAt(rs.getObject("created_at", OffsetDateTime.class));
        return group;
    }
}
