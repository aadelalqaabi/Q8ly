import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

/**
 * Format a date for display in the app.
 * - Within 24h: relative (e.g. "3 hours ago")
 * - Today: "Today, 3:45 PM"
 * - Yesterday: "Yesterday, 10:00 AM"
 * - Older: "Jan 15, 2025"
 */
export const formatDate = (date) => {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 24) {
    return formatDistanceToNow(d, { addSuffix: true });
  }
  if (isToday(d)) {
    return `Today, ${format(d, 'h:mm a')}`;
  }
  if (isYesterday(d)) {
    return `Yesterday, ${format(d, 'h:mm a')}`;
  }
  return format(d, 'MMM d, yyyy');
};

/**
 * Format large numbers with K/M suffix.
 */
export const formatCount = (n) => {
  if (n === undefined || n === null) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
};

/**
 * Extract hashtags from text.
 */
export const extractHashtags = (text) => {
  if (!text) return [];
  const matches = text.match(/#[\w\u0600-\u06FF]+/g);
  return matches ? matches.map((h) => h.slice(1)) : [];
};

/**
 * Extract mentions from text.
 */
export const extractMentions = (text) => {
  if (!text) return [];
  const matches = text.match(/@[\w]+/g);
  return matches ? matches.map((m) => m.slice(1)) : [];
};

/**
 * Truncate text with ellipsis.
 */
export const truncate = (text, maxLen = 100) => {
  if (!text || text.length <= maxLen) return text;
  return text.slice(0, maxLen).trim() + '…';
};

/**
 * Build initials from a name.
 */
export const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
};

/**
 * Validate Kuwaiti phone number (basic).
 */
export const isValidKuwaitPhone = (phone) => {
  return /^(?:\+965)?[569]\d{7}$/.test(phone.replace(/\s/g, ''));
};

/**
 * Get the appropriate color for a verified badge type.
 */
export const getBadgeColor = (badgeType) => {
  const colors = {
    government: '#2196F3',
    media: '#FF9800',
    influencer: '#9C27B0',
    business: '#4CAF50',
  };
  return colors[badgeType] || null;
};
