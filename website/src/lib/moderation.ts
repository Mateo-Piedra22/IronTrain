/**
 * Strict profanity filter for Usernames and Display Names
 * IronSocial Identity System
 */

const BAD_WORDS = [
    // Spanish (Common)
    'pelotudo', 'boludo', 'mierda', 'puto', 'puta', 'concha', 'carajo', 'pendejo', 'culiao', 'culia',
    'forro', 'pajero', 'pajera', 'choto', 'chota', 'orto', 'garca', 'zorra', 'zorrillo',
    'maricon', 'putazo', 'cornudo', 'ojete', 'pija', 'vagina', 'pene', 'teta', 'culo', 'mogolico', 'putito', 'putita',
    'gay', 'therian', 'zorrita',

    // English (Common)
    'fuck', 'shit', 'asshole', 'bitch', 'cunt', 'dick', 'pussy', 'faggot', 'nigger', 'bastard',
    'cock', 'jerk', 'sex', 'porn', 'nude', 'slut', 'whore',

    // Management/System reserved
    'admin', 'irontrain', 'moderator', 'support', 'system', 'root', 'motiona', 'staff',
];

/**
 * Checks if a string contains profanity or reserved words
 * @returns {boolean} true if it contains bad words
 */
export function hasProfanity(text: string): boolean {
    if (!text) return false;
    const lower = text.toLowerCase();

    // Check for exact matches and substring matches for reserved words
    return BAD_WORDS.some(word => {
        // For short words, we want exact or surrounded by non-letters
        if (word.length <= 4) {
            const regex = new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`, 'i');
            return regex.test(lower);
        }
        // For longer words, any substring is usually intentional profanity
        return lower.includes(word);
    });
}

/**
 * Validates a username according to strict identity rules
 */
export function validateUsername(username: string): { valid: boolean; error?: string } {
    if (!username) return { valid: false, error: 'Username is required' };

    if (username.length < 3) return { valid: false, error: 'Username too short (min 3)' };
    if (username.length > 20) return { valid: false, error: 'Username too long (max 20)' };

    if (!/^[a-z0-9_]+$/.test(username)) {
        return { valid: false, error: 'Only letters, numbers and underscores allowed' };
    }

    if (hasProfanity(username)) {
        return { valid: false, error: 'Username contains restricted content' };
    }

    return { valid: true };
}
