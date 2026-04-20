package com.hagbad.springbootbackend.groupsettings;

import com.hagbad.springbootbackend.security.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/group-settings")
public class GroupSettingsController {

    private final GroupSettingsService groupSettingsService;

    public GroupSettingsController(GroupSettingsService groupSettingsService) {
        this.groupSettingsService = groupSettingsService;
    }

    @PostMapping("/")
    @ResponseStatus(HttpStatus.CREATED)
    public GroupSettingsResponse create(
        @RequestBody GroupSettingsCreateRequest request,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return groupSettingsService.create(request, currentUser);
    }

    @GetMapping("/{groupId}")
    public GroupSettingsResponse get(
        @PathVariable Integer groupId,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return groupSettingsService.get(groupId, currentUser);
    }

    @PutMapping("/{groupId}")
    public GroupSettingsResponse update(
        @PathVariable Integer groupId,
        @RequestBody GroupSettingsUpdateRequest request,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return groupSettingsService.update(groupId, request, currentUser);
    }

    @DeleteMapping("/{groupId}")
    public ResponseEntity<Void> delete(
        @PathVariable Integer groupId,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        groupSettingsService.delete(groupId, currentUser);
        return ResponseEntity.noContent().build();
    }
}
