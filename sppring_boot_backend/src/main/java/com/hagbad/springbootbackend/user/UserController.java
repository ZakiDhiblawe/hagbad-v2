package com.hagbad.springbootbackend.user;

import com.hagbad.springbootbackend.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@Validated
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse register(@Valid @RequestBody UserRegisterRequest request) {
        return userService.register(request);
    }

    @PostMapping(value = "/login", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public TokenResponse login(
        @RequestParam("username") String username,
        @RequestParam("password") String password
    ) {
        return userService.login(username, password);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@AuthenticationPrincipal CurrentUser currentUser) {
        userService.logout(currentUser);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/profile")
    public UserResponse profile(@AuthenticationPrincipal CurrentUser currentUser) {
        return userService.getProfile(currentUser);
    }

    @PutMapping(value = "/profile", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public UserResponse updateProfile(
        @RequestParam("full_name") String fullName,
        @RequestParam(value = "phone", required = false) String phone,
        @RequestParam(value = "session_hours", required = false) String sessionHours,
        @RequestPart(value = "image", required = false) MultipartFile image,
        @RequestParam(value = "remove_image", defaultValue = "false") boolean removeImage,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return userService.updateProfile(currentUser, fullName, phone, sessionHours, image, removeImage);
    }

    @PutMapping("/profile/password")
    public MessageResponse updatePassword(
        @Valid @RequestBody PasswordUpdateRequest request,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return userService.updatePassword(currentUser, request);
    }
}
