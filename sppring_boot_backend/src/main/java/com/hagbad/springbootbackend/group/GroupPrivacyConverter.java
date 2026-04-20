package com.hagbad.springbootbackend.group;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class GroupPrivacyConverter implements AttributeConverter<GroupPrivacy, String> {

    @Override
    public String convertToDatabaseColumn(GroupPrivacy attribute) {
        if (attribute == null) {
            return null;
        }
        return attribute.value();
    }

    @Override
    public GroupPrivacy convertToEntityAttribute(String dbData) {
        if (dbData == null) {
            return null;
        }
        return "private".equals(dbData) ? GroupPrivacy.private_group : GroupPrivacy.public_group;
    }
}
