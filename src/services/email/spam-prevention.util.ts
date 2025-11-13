/**
 * Spam Prevention Utilities
 * Helps prevent emails from going to spam folders
 */

/**
 * Common spam trigger words (avoid in subject lines and content)
 */
export const SPAM_TRIGGER_WORDS = [
  'FREE',
  'GUARANTEE',
  'NO RISK',
  'CLICK HERE',
  'BUY NOW',
  'LIMITED TIME',
  'WINNER',
  'PRIZE',
  'URGENT',
  'ACT NOW',
  '$$$',
  '!!!',
  'MAKE MONEY',
  'EARN $',
  'WORK FROM HOME',
  'GET PAID',
  'SPECIAL PROMOTION',
  'ONCE IN A LIFETIME',
  "DON'T DELETE",
  'THIS IS NOT SPAM',
  'REMOVE',
  'UNSUBSCRIBE',
  'CLICK BELOW',
  'ORDER NOW',
  'BUY DIRECT',
  'CALL NOW',
  'APPLY NOW',
  'GET IT NOW',
  'DO IT TODAY',
  'ACT IMMEDIATELY',
  'LIMITED OFFER',
  'SPECIAL DEAL',
  'EXCLUSIVE OFFER',
  'RISK FREE',
  'SATISFACTION GUARANTEED',
  'MONEY BACK',
  'NO OBLIGATION',
  'NO QUESTIONS ASKED',
  '100% FREE',
  '100% SATISFACTION',
  'ALL NATURAL',
  'AS SEEN ON',
  'BE YOUR OWN BOSS',
  'BIG BUCKS',
  'BULK EMAIL',
  'CASH BONUS',
  'CASH PRIZE',
  'CASINO',
  'CLAIM NOW',
  'CONGRATULATIONS',
  'CREDIT CARD',
  'DEAL',
  'DEBT',
  'DIET',
  'DIRECT EMAIL',
  'DIRECT MARKETING',
  'EASY TERMS',
  'ELIMINATE BAD CREDIT',
  'EXPIRES',
  'FAST CASH',
  'FOR INSTANT ACCESS',
  'FOR YOU',
  'FORGIVE DEBT',
  'FRESH',
  'FULL REFUND',
  'GET OUT OF DEBT',
  'GET PAID',
  'GIVE IT AWAY',
  'GIVEAWAY',
  'GUARANTEE',
  'HAVE YOU BEEN TURNED DOWN',
  'HELLO',
  'HERES HOW',
  'HIGH QUALITY',
  'IF ONLY IT WERE THAT EASY',
  'IN STOCK',
  'INFO YOU REQUESTED',
  'INFORMATIONAL',
  'INSTANT',
  "IT'S EFFECTIVE",
  'JOIN MILLIONS',
  'LIFE TIME',
  'LIFETIME ACCESS',
  'LIMITED TIME ONLY',
  'LOANS',
  'LOSE WEIGHT',
  'LOWEST PRICE',
  'MAIL IN ORDER FORM',
  'MAKE $',
  'MAKE MONEY',
  'MARKETING',
  'MASS EMAIL',
  'MILLION DOLLARS',
  'MILLIONS',
  'MONEY',
  'MONEY BACK',
  'NEW CUSTOMERS ONLY',
  'NO AGE RESTRICTIONS',
  'NO CATCH',
  'NO CREDIT CHECK',
  'NO EXPERIENCE',
  'NO FEES',
  'NO G IMMEDIATE',
  'NO INVENTORY',
  'NO INVESTMENT',
  'NO MEDICAL EXAM',
  'NO OBLIGATION',
  'NO PURCHASE NECESSARY',
  'NO QUESTIONS ASKED',
  'NO SELLING',
  'NOT INTENDED',
  'OBEY',
  'OFFER',
  'ONCE IN LIFETIME',
  'ONE HUNDRED PERCENT FREE',
  'ONE TIME',
  'ONLY',
  'OPPORTUNITY',
  'ORDER',
  'ORDER STATUS',
  'ORDER TODAY',
  'ORDERED IN STORES',
  'OUTSTANDING VALUES',
  'PAID',
  'PASSWORDS',
  'PERFECT',
  'PRIORITY MAIL',
  'PRIZE',
  'PRODUC',
  'PROMISE',
  'PROMOTION',
  'PURE PROFIT',
  'REAL THING',
  'REFINANCE HOME',
  'REMOVE',
  'REQUEST',
  'REQUIRE',
  'RESTORE CREDIT',
  'RISK FREE',
  'SALES',
  'SAMPLE',
  'SATISFACTION',
  'SAVE $',
  'SAVE BIG MONEY',
  'SAVE UP TO',
  'SCORE',
  'SEARCH ENGINE',
  'SEE FOR YOURSELF',
  'SENT IN COMPLIANCE',
  'SERIOUS CASH',
  'SERIOUS ONLY',
  'SIMPLE TERMS',
  'SOMETHING FOR NOTHING',
  'SPECIAL PROMOTION',
  'STAINLESS STEEL',
  'STOP',
  'STUFF ON SALE',
  'SUBJECT TO',
  'SUCCESS',
  'SUPPLIES ARE LIMITED',
  'TAKE ACTION NOW',
  'TERMS AND CONDITIONS',
  'THE BEST RATES',
  'THE FOLLOWING FORM',
  'THEY KEEP YOUR MONEY',
  "THIS ISN'T SPAM",
  "THIS ISN'T JUNK",
  "THIS ISN'T SCAM",
  "THIS WON'T LAST",
  'TRIAL',
  'UNDER NEW MANAGEMENT',
  'UNIQUE',
  'UNLIMITED',
  'UNSECURED',
  'UNSUBSCRIBE',
  'URGENT',
  'US DOLLARS',
  'USED BY',
  'VERIFIED',
  'WE HONOR ALL',
  'WEIGHT LOSS',
  'WHAT ARE YOU WAITING FOR',
  'WHILE SUPPLIES LAST',
  'WHO REALLY WINS',
  'WHY PAY MORE',
  'WILL NOT BELIEVE YOUR EYES',
  'WIN',
  'WINNER',
  'WON',
  'WORK AT HOME',
  'YOU ARE A WINNER',
  'YOU HAVE BEEN SELECTED',
  'YOU HAVE WON',
  'YOU WON',
  'YOUR INCOME',
  'YOUR MONEY',
];

/**
 * Check if subject line contains spam trigger words
 */
export function containsSpamWords(text: string): boolean {
  const upperText = text.toUpperCase();
  return SPAM_TRIGGER_WORDS.some((word) => upperText.includes(word));
}

/**
 * Get spam score for subject line (0-100, higher = more likely spam)
 */
export function getSpamScore(text: string): number {
  const upperText = text.toUpperCase();
  let score = 0;

  SPAM_TRIGGER_WORDS.forEach((word) => {
    if (upperText.includes(word)) {
      score += 10;
    }
  });

  // Check for excessive punctuation
  const exclamationCount = (text.match(/!/g) ?? []).length;
  const questionCount = (text.match(/\?/g) ?? []).length;
  if (exclamationCount > 2) score += 20;
  if (questionCount > 2) score += 20;

  // Check for all caps
  if (text === text.toUpperCase() && text.length > 10) {
    score += 30;
  }

  // Check for excessive special characters
  const specialCharCount = (
    text.match(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/g) ?? []
  ).length;
  if (specialCharCount > text.length * 0.2) {
    score += 15;
  }

  return Math.min(100, score);
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Get default spam prevention headers
 */
export function getDefaultSpamPreventionHeaders(options?: {
  unsubscribeUrl?: string;
  senderName?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Mailer': 'Ordaro Email Service',
    'X-Priority': '3',
    Precedence: 'bulk',
  };

  if (options?.unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${options.unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  if (options?.senderName) {
    headers['X-Sender'] = options.senderName;
  }

  return headers;
}

/**
 * Add unsubscribe link to HTML email
 */
export function addUnsubscribeLink(
  html: string,
  unsubscribeUrl: string,
  unsubscribeText: string = 'Unsubscribe',
): string {
  // Check if unsubscribe link already exists
  if (html.includes('unsubscribe') || html.includes('Unsubscribe')) {
    return html;
  }

  const footer = `
    <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
    <p style="font-size: 12px; color: #666; text-align: center;">
      If you no longer wish to receive these emails, you can 
      <a href="${unsubscribeUrl}" style="color: #007bff;">${unsubscribeText}</a>.
    </p>
  `;

  // Try to insert before closing body tag
  if (html.includes('</body>')) {
    return html.replace('</body>', `${footer}</body>`);
  }

  // If no body tag, append to end
  return html + footer;
}

/**
 * Validate email content for spam indicators
 */
export function validateEmailContent(options: {
  subject: string;
  html?: string;
  text?: string;
}): {
  isValid: boolean;
  warnings: string[];
  spamScore: number;
} {
  const warnings: string[] = [];
  let spamScore = 0;

  // Check subject line
  const subjectSpamScore = getSpamScore(options.subject);
  spamScore += subjectSpamScore;
  if (subjectSpamScore > 30) {
    warnings.push(
      `Subject line may trigger spam filters (score: ${String(subjectSpamScore)})`,
    );
  }

  // Check for text version
  if (!options.text && options.html) {
    warnings.push(
      'Missing text version - always include text version for better deliverability',
    );
    spamScore += 10;
  }

  // Check HTML content
  if (options.html) {
    // Check for image-to-text ratio (if many images, might be spam)
    const imageCount = (options.html.match(/<img/g) ?? []).length;
    const textLength =
      options.text?.length ?? options.html.replace(/<[^>]*>/g, '').length;
    if (imageCount > 0 && textLength < 100) {
      warnings.push(
        'Email has many images but little text - may trigger spam filters',
      );
      spamScore += 15;
    }

    // Check for excessive links
    const linkCount = (options.html.match(/<a href/g) ?? []).length;
    if (linkCount > 10) {
      warnings.push(
        `Too many links (${String(linkCount)}) - limit to 3-5 links for better deliverability`,
      );
      spamScore += 10;
    }

    // Check for unsubscribe link
    if (!options.html.toLowerCase().includes('unsubscribe')) {
      warnings.push(
        'Missing unsubscribe link - required for compliance and deliverability',
      );
      spamScore += 20;
    }
  }

  return {
    isValid: spamScore < 50,
    warnings,
    spamScore: Math.min(100, spamScore),
  };
}

/**
 * Sanitize email content to reduce spam score
 */
export function sanitizeEmailContent(html: string): string {
  let sanitized = html;

  // Remove excessive formatting
  sanitized = sanitized.replace(/<font[^>]*>/gi, '');
  sanitized = sanitized.replace(/<\/font>/gi, '');

  // Remove hidden text
  sanitized = sanitized.replace(/style="[^"]*display\s*:\s*none[^"]*"/gi, '');

  // Ensure proper HTML structure
  if (!sanitized.includes('<!DOCTYPE')) {
    sanitized = `<!DOCTYPE html>\n${sanitized}`;
  }

  return sanitized;
}
