package com.hagbad.springbootbackend.group;

public enum GroupPrivacy {
    public_group("public"),
    private_group("private");

    private final String value;

    GroupPrivacy(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static GroupPrivacy fromDatabase(String value) {
        return "private".equals(value) ? private_group : public_group;
    }
}
