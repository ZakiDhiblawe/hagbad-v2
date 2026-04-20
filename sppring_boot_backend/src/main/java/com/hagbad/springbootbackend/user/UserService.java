package com.hagbad.springbootbackend.user;

import com.hagbad.springbootbackend.config.AppProperties;
import com.hagbad.springbootbackend.exception.ApiException;
import com.hagbad.springbootbackend.security.CurrentUser;
import com.hagbad.springbootbackend.security.JwtService;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class UserService {

    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS = Set.of(".jpg", ".jpeg", ".png", ".webp", ".gif");
    private static final long MAX_PROFILE_IMAGE_BYTES = 5L * 1024L * 1024L;
    private static final int MAX_SESSION_HOURS = 720;
    private static final Pattern PHONE_PATTERN = Pattern.compile("^[0-9+\\-\\s()]{6,30}$");

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final Path filesRoot;
    private final Path profileDir;

    public UserService(
        UserRepository userRepository,
        PasswordEncoder passwordEncoder,
        JwtService jwtService,
        AppProperties properties
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.filesRoot = properties.resolveFilesRoot();
        this.profileDir = filesRoot.resolve("profile");
    }

    public UserResponse register(UserRegisterRequest request) {
        String fullName = normalizeFullName(request.fullName());
        String email = normalizeRegistrationEmail(request.email());
        String phone = normalizePhone(request.phone());
        validatePasswordByteLength(request.password());

        if (userRepository.existsByEmail(email)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Email already registered");
        }

        try {
            return UserResponse.from(
                userRepository.insert(
                    fullName,
                    email,
                    phone,
                    passwordEncoder.encode(request.password()),
                    UserStatus.active
                )
            );
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Email already registered");
        }
    }

    public TokenResponse login(String email, String password) {
        String normalizedEmail = email == null ? "" : email.trim();

        UserEntity user = userRepository.findByEmail(normalizedEmail)
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Incorrect email or password"));

        if (!passwordEncoder.matches(password == null ? "" : password, user.getPassword())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Incorrect email or password");
        }

        if (user.getStatus() == UserStatus.banned) {
            throw new ApiException(HttpStatus.FORBIDDEN, "User is banned");
        }

        String sessionId = UUID.randomUUID().toString().replace("-", "");
        userRepository.updateActiveSession(user.getId(), sessionId);
        user.setActiveSessionId(sessionId);

        String accessToken = jwtService.createToken(user.getEmail(), sessionId, user.getSessionHours());
        return new TokenResponse(accessToken, "bearer");
    }

    public void logout(CurrentUser currentUser) {
        UserEntity user = requireCurrentUser(currentUser);
        userRepository.updateActiveSession(user.getId(), null);
    }

    public UserResponse getProfile(CurrentUser currentUser) {
        return UserResponse.from(requireCurrentUser(currentUser));
    }

    public UserResponse updateProfile(
        CurrentUser currentUser,
        String fullName,
        String phone,
        String sessionHours,
        MultipartFile image,
        boolean removeImage
    ) {
        UserEntity user = requireCurrentUser(currentUser);
        user.setFullName(normalizeFullName(fullName));
        user.setPhone(normalizePhone(phone));
        user.setSessionHours(parseSessionHours(sessionHours));

        if (removeImage) {
            deleteProfileImage(user.getProfileImage());
            user.setProfileImage(null);
        }

        if (image != null && !image.isEmpty()) {
            user.setProfileImage(saveProfileImage(user.getId(), image, user.getProfileImage()));
        }

        userRepository.updateProfile(
            user.getId(),
            user.getFullName(),
            user.getPhone(),
            user.getProfileImage(),
            user.getSessionHours()
        );
        return UserResponse.from(requireCurrentUser(currentUser));
    }

    public MessageResponse updatePassword(CurrentUser currentUser, PasswordUpdateRequest request) {
        UserEntity user = requireCurrentUser(currentUser);

        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Current password is incorrect");
        }

        if (request.currentPassword().equals(request.newPassword())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "New password must be different from the current password");
        }

        validatePasswordByteLength(request.newPassword());
        userRepository.updatePassword(user.getId(), passwordEncoder.encode(request.newPassword()));
        return new MessageResponse("Password updated successfully");
    }

    private UserEntity requireCurrentUser(CurrentUser currentUser) {
        if (currentUser == null || currentUser.id() == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid token");
        }

        UserEntity user = userRepository.findById(currentUser.id())
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid token"));

        if (user.getActiveSessionId() == null || !user.getActiveSessionId().equals(currentUser.sessionId())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid token");
        }

        if (user.getStatus() == UserStatus.banned) {
            throw new ApiException(HttpStatus.FORBIDDEN, "User is banned");
        }

        return user;
    }

    private String normalizeFullName(String fullName) {
        String value = fullName == null ? "" : fullName.trim();
        if (value.length() < 2) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Full name must be at least 2 characters");
        }
        if (value.length() > 120) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Full name must be at most 120 characters");
        }
        return value;
    }

    private String normalizeRegistrationEmail(String email) {
        String value = email == null ? "" : email.trim();
        if (value.length() < 3 || value.length() > 255) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Email must be between 3 and 255 characters");
        }
        return value;
    }

    private String normalizePhone(String phone) {
        String value = phone == null ? "" : phone.trim();
        if (value.isEmpty()) {
            return null;
        }

        if (!PHONE_PATTERN.matcher(value).matches()) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "Phone number must be 6 to 30 characters and contain only digits or + - ( )"
            );
        }

        return value;
    }

    private Integer parseSessionHours(String rawValue) {
        String value = rawValue == null ? "" : rawValue.trim();
        if (value.isEmpty()) {
            return null;
        }

        if (!value.chars().allMatch(Character::isDigit)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Session hours must be a whole number or blank");
        }

        int hours = Integer.parseInt(value);
        if (hours < 1 || hours > MAX_SESSION_HOURS) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "Session hours must be between 1 and " + MAX_SESSION_HOURS
            );
        }
        return hours;
    }

    private void validatePasswordByteLength(String password) {
        if (password != null && password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Password must be at most 72 bytes (bcrypt limit).");
        }
    }

    private String normalizeProfileExtension(MultipartFile image) {
        String filename = image.getOriginalFilename();
        String suffix = "";
        if (StringUtils.hasText(filename) && filename.contains(".")) {
            suffix = filename.substring(filename.lastIndexOf(".")).toLowerCase();
        }

        if (".jpeg".equals(suffix)) {
            suffix = ".jpg";
        }

        if (!StringUtils.hasText(suffix)) {
            String contentType = image.getContentType() == null ? "" : image.getContentType().toLowerCase();
            if ("image/jpeg".equals(contentType)) {
                suffix = ".jpg";
            } else if ("image/png".equals(contentType)) {
                suffix = ".png";
            } else if ("image/webp".equals(contentType)) {
                suffix = ".webp";
            } else if ("image/gif".equals(contentType)) {
                suffix = ".gif";
            }
        }

        if (!ALLOWED_IMAGE_EXTENSIONS.contains(suffix)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Profile image must be JPG, PNG, WEBP, or GIF");
        }

        return suffix;
    }

    private String saveProfileImage(Integer userId, MultipartFile image, String existingPath) {
        byte[] data;
        try {
            Files.createDirectories(profileDir);
            data = image.getBytes();
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not store profile image");
        }

        if (data.length == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Uploaded profile image is empty");
        }

        if (data.length > MAX_PROFILE_IMAGE_BYTES) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Profile image must be 5 MB or smaller");
        }

        String suffix = normalizeProfileExtension(image);
        Path destination = profileDir.resolve(userId + suffix);
        String newPath = "/files/profile/" + destination.getFileName();

        if (StringUtils.hasText(existingPath) && !existingPath.equals(newPath)) {
            deleteProfileImage(existingPath);
        }

        try {
            Files.write(destination, data);
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not store profile image");
        }

        return newPath;
    }

    private void deleteProfileImage(String pathValue) {
        if (!StringUtils.hasText(pathValue) || !pathValue.startsWith("/files/profile/")) {
            return;
        }

        Path target = filesRoot.resolve(pathValue.replaceFirst("^/files/", ""));
        try {
            Files.deleteIfExists(target);
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not remove profile image");
        }
    }
}
