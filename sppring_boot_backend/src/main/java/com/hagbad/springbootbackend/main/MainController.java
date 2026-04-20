package com.hagbad.springbootbackend.main;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MainController {

    @GetMapping("/")
    public Map<String, String> root() {
        return Map.of("message", "Hagbad API running");
    }
}
