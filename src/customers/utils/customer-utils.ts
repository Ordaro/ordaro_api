/**
 * Utility functions for customer data normalization and validation
 */

/**
 * Normalize email address for consistent searching
 * - Lowercase
 * - Remove Gmail dots and plus aliases
 */
export function normalizeEmail(email: string): string {
  if (!email) {
    return '';
  }

  const lowerEmail = email.toLowerCase().trim();
  const [local, domain] = lowerEmail.split('@');

  if (!domain || !local) {
    return lowerEmail;
  }

  // Handle Gmail aliases
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    // Remove dots
    const normalizedLocal = local.replace(/\./g, '');
    // Remove plus aliases (everything after +)
    const localWithoutAlias = normalizedLocal.split('+')[0];
    return `${localWithoutAlias}@${domain}`;
  }

  return lowerEmail;
}

/**
 * Normalize phone number for consistent searching
 * - Remove all non-digit characters
 * - Handle country codes (optional)
 */
export function normalizePhone(phone: string): string {
  if (!phone) {
    return '';
  }

  // Remove all non-digit characters
  return phone.replace(/\D/g, '');
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  if (!email) {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone format (basic validation)
 */
export function validatePhone(phone: string): boolean {
  if (!phone) {
    return false;
  }

  const normalized = normalizePhone(phone);
  // At least 7 digits, max 15 (E.164 standard)
  return normalized.length >= 7 && normalized.length <= 15;
}
