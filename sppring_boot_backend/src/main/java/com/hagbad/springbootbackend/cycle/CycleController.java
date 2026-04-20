package com.hagbad.springbootbackend.cycle;

import com.hagbad.springbootbackend.security.CurrentUser;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/cycles")
public class CycleController {

    private final CycleService cycleService;

    public CycleController(CycleService cycleService) {
        this.cycleService = cycleService;
    }

    @PostMapping("/")
    @ResponseStatus(HttpStatus.CREATED)
    public CycleResponse create(
        @RequestBody CycleCreateRequest request,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return cycleService.create(request, currentUser);
    }

    @GetMapping("/{cycleId}")
    public CycleResponse get(
        @PathVariable Integer cycleId,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return cycleService.get(cycleId, currentUser);
    }

    @GetMapping("/group/{groupId}")
    public List<CycleResponse> listForGroup(
        @PathVariable Integer groupId,
        @RequestParam(value = "page", defaultValue = "1") int page,
        @RequestParam(value = "size", defaultValue = "20") int size,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return cycleService.listForGroup(groupId, page, size, currentUser);
    }

    @PutMapping("/{cycleId}/start")
    public CycleResponse start(
        @PathVariable Integer cycleId,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return cycleService.start(cycleId, currentUser);
    }

    @PutMapping("/{cycleId}/stop")
    public CycleResponse stop(
        @PathVariable Integer cycleId,
        @RequestParam("status") CycleStatus status,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return cycleService.stop(cycleId, status, currentUser);
    }

    @PutMapping("/{cycleId}")
    public CycleResponse update(
        @PathVariable Integer cycleId,
        @RequestBody CycleUpdateRequest request,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return cycleService.update(cycleId, request, currentUser);
    }
}
