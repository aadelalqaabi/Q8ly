import React from 'react';
import { Text, Linking } from 'react-native';

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;

export default function LinkedText({ children, style, numberOfLines, linkColor = '#0033A0', selectable = false }) {
  if (!children || typeof children !== 'string') {
    return <Text style={style} numberOfLines={numberOfLines} selectable={selectable}>{children}</Text>;
  }

  const parts = [];
  let lastIndex = 0;
  let match;

  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(children)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: children.slice(lastIndex, match.index), isLink: false });
    }
    parts.push({ text: match[0], isLink: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < children.length) {
    parts.push({ text: children.slice(lastIndex), isLink: false });
  }

  if (parts.length === 0 || (parts.length === 1 && !parts[0].isLink)) {
    return <Text style={style} numberOfLines={numberOfLines}>{children}</Text>;
  }

  return (
    <Text style={style} numberOfLines={numberOfLines} selectable={selectable}>
      {parts.map((part, i) =>
        part.isLink ? (
          <Text
            key={i}
            style={{ color: linkColor, textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL(part.text)}
          >
            {part.text}
          </Text>
        ) : (
          <Text key={i}>{part.text}</Text>
        )
      )}
    </Text>
  );
}
