package com.hagbad.springbootbackend.cyclemember;

import com.hagbad.springbootbackend.security.CurrentUser;
import java.util.List;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/cycle-members")
public class CycleMemberController {

    private final CycleMemberService cycleMemberService;

    public CycleMemberController(CycleMemberService cycleMemberService) {
        this.cycleMemberService = cycleMemberService;
    }

    @PostMapping("/")
    @ResponseStatus(HttpStatus.CREATED)
    public CycleMemberResponse add(
        @RequestBody CycleMemberCreateRequest request,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return cycleMemberService.add(request, currentUser);
    }

    @PostMapping("/fill")
    @ResponseStatus(HttpStatus.CREATED)
    public List<CycleMemberResponse> fill(
        @RequestBody CycleMemberFillRequest request,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return cycleMemberService.fill(request, currentUser);
    }

    @GetMapping("/")
    public List<CycleMemberResponse> list(
        @RequestParam("cycle_id") Integer cycleId,
        @RequestParam(value = "page", defaultValue = "1") int page,
        @RequestParam(value = "size", defaultValue = "20") int size,
        @RequestParam(value = "order", required = false) Integer order,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return cycleMemberService.list(cycleId, page, size, order, currentUser);
    }

    @GetMapping("/{memberId}")
    public CycleMemberResponse get(
        @PathVariable Integer memberId,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return cycleMemberService.get(memberId, currentUser);
    }

    @PutMapping("/{memberId}")
    public CycleMemberResponse update(
        @PathVariable Integer memberId,
        @RequestBody CycleMemberUpdateRequest request,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return cycleMemberService.update(memberId, request, currentUser);
    }

    @DeleteMapping("/{memberId}")
    public ResponseEntity<Void> delete(
        @PathVariable Integer memberId,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        cycleMemberService.delete(memberId, currentUser);
        return ResponseEntity.noContent().build();
    }
}
