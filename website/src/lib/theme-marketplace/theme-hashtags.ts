type BuildThemeHashtagsInput = {
    rawTags: unknown;
    supportsLight: boolean;
    supportsDark: boolean;
    limit?: number;
};

const DEFAULT_LIMIT = 10;

const normalizeTag = (value: string) => value.trim().toLowerCase().replace(/^#+/, '');

const dedupeTags = (values: string[], limit: number) => {
    const seen = new Set<string>();
    const output: string[] = [];

    for (const value of values) {
        const cleaned = normalizeTag(value);
        if (!cleaned) continue;
        if (seen.has(cleaned)) continue;
        seen.add(cleaned);
        output.push(cleaned);
        if (output.length >= limit) break;
    }

    return output;
};

export function buildThemeHashtags({ rawTags, supportsLight, supportsDark, limit = DEFAULT_LIMIT }: BuildThemeHashtagsInput): string[] {
    const baseTags = Array.isArray(rawTags) ? rawTags.filter((entry): entry is string => typeof entry === 'string') : [];

    const modeTags = supportsLight && supportsDark
        ? ['light-mode', 'dark-mode', 'dual-mode']
        : supportsLight
            ? ['light-mode', 'light-only']
            : supportsDark
                ? ['dark-mode', 'dark-only']
                : [];

    return dedupeTags([...baseTags, ...modeTags], limit);
}
