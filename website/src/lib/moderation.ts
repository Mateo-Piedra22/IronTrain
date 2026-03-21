/**
 * Strict profanity filter for Usernames and Display Names
 * IronSocial Identity System
 */

const BAD_WORDS = [
    // Spanish
    'pelotudo', 'boludo', 'mierda', 'puto', 'puta', 'concha', 'carajo', 'pendejo', 'culiao', 'culia',
    'forro', 'pajero', 'pajera', 'choto', 'chota', 'orto', 'garca', 'zorra', 'zorrillo',
    'maricon', 'putazo', 'cornudo', 'ojete', 'pija', 'vagina', 'pene', 'teta', 'culo', 'mogolico', 'putito', 'putita',
    'gay', 'therian', 'zorrita', 'verga', 'coño', 'gilipollas', 'jodido', 'puchica', 'pucha',

    // English
    'fuck', 'shit', 'asshole', 'bitch', 'cunt', 'dick', 'pussy', 'faggot', 'nigger', 'bastard',
    'cock', 'jerk', 'sex', 'porn', 'nude', 'slut', 'whore', 'fucker', 'motherfucker', 'retard',
    'dumbass', 'piss', 'pissed',

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
        return { valid: false, error: 'Username contains restricted or offensive content' };
    }

    return { valid: true };
}

/**
 * Validates a display name (used in social profile)
 */
export function validateDisplayName(name: string): { valid: boolean; error?: string } {
    if (!name) return { valid: false, error: 'Display name is required' };

    const clean = name.trim();
    if (clean.length < 2) return { valid: false, error: 'Display name too short (min 2)' };
    if (clean.length > 50) return { valid: false, error: 'Display name too long (max 50)' };

    // More permissive than username, but still no pure symbols/crap
    if (!/^[a-zA-Z0-9\s.\-_áéíóúÁÉÍÓÚñÑ]+$/.test(clean)) {
        return { valid: false, error: 'Display name contains invalid characters' };
    }

    if (hasProfanity(clean)) {
        return { valid: false, error: 'Display name contains restricted or offensive content' };
    }

    return { valid: true };
}
