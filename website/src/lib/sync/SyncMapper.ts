import { MapDirection, SYNC_TABLES, TableConfig } from './SyncProtocol';

/**
 * SyncMapper.ts
 * 
 * Logic to map between local (Client) and remote (Server/API/Drizzle) formats.
 * Handles:
 * 1. Key mapping (camelCase vs snake_case and manual overrides)
 * 2. Type conversion (Number <-> Date, Number <-> Boolean)
 * 3. Sanitization
 */

export class SyncMapper {
    /**
     * Converts a string from camelCase to snake_case
     */
    public static toSnakeCase(str: string): string {
        return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    }

    /**
     * Converts a string from snake_case to camelCase
     */
    public static toCamelCase(str: string): string {
        return str.replace(/([-_][a-z])/g, (group) =>
            group.toUpperCase().replace('-', '').replace('_', '')
        );
    }

    /**
     * Maps an object based on the TableConfig and direction.
     * 
     * DIRECTIONS:
     * - TO_REMOTE:   Client (Mobile/SQLite) -> API/JSON (SnakeCase Keys, Numbers for Booleans)
     * - FROM_REMOTE: API/JSON (SnakeCase Keys) -> Client (Mobile/SQLite) (CamelCase Keys, Numbers)
     * - TO_DRIZZLE:  API/JSON (SnakeCase Keys) -> Server (Drizzle/Postgres) (CamelCase Keys, Date Objects)
     */
    public static mapObject(
        obj: Record<string, unknown>,
        tableName: string,
        direction: MapDirection
    ): Record<string, unknown> {
        const config = SYNC_TABLES[tableName];
        if (!config) return obj;

        const mapped: Record<string, unknown> = {};

        // Inverting overrides for mapping BACK to local keys
        const remoteToLocalOverrides: Record<string, string> = {};
        if (config.overrides) {
            for (const [local, remote] of Object.entries(config.overrides)) {
                remoteToLocalOverrides[remote] = local;
            }
        }

        for (const [key, value] of Object.entries(obj)) {
            let mappedKey = key;
            let mappedValue = value;

            if (direction === 'TO_REMOTE') {
                // Client -> JSON API
                if (config.overrides && config.overrides[key]) {
                    mappedKey = config.overrides[key];
                } else {
                    mappedKey = this.toSnakeCase(key);
                }

                if (config.booleanColumns.includes(mappedKey)) {
                    mappedValue = (value === 1 || value === true || value === 'true');
                } else if (config.bigIntColumns.includes(mappedKey)) {
                    mappedValue = typeof value === 'string' ? parseInt(value, 10) : Number(value);
                }
                mapped[mappedKey] = mappedValue;

            } else if (direction === 'FROM_REMOTE') {
                // JSON API -> Client
                if (remoteToLocalOverrides[key]) {
                    mappedKey = remoteToLocalOverrides[key];
                } else {
                    mappedKey = this.toCamelCase(key);
                }

                const snakeKey = remoteToLocalOverrides[key] ? key : this.toSnakeCase(mappedKey);
                if (config.booleanColumns.includes(snakeKey)) {
                    mappedValue = (value === 1 || value === true || value === 'true') ? 1 : 0;
                } else if (config.bigIntColumns.includes(snakeKey)) {
                    mappedValue = typeof value === 'string' ? parseInt(value, 10) : Number(value);
                }
                mapped[mappedKey] = mappedValue;

            } else if (direction === 'TO_DRIZZLE') {
                // JSON API -> Server Drizzle
                if (remoteToLocalOverrides[key]) {
                    mappedKey = remoteToLocalOverrides[key];
                } else {
                    mappedKey = this.toCamelCase(key);
                }

                const snakeKey = remoteToLocalOverrides[key] ? key : this.toSnakeCase(mappedKey);
                if (config.booleanColumns.includes(snakeKey)) {
                    mappedValue = (value === 1 || value === true || value === 'true');
                } else if (config.bigIntColumns.includes(snakeKey)) {
                    // Check if it's a timestamp field
                    const timestampColumns = config.timestampColumns;
                    const isTimestamp = Array.isArray(timestampColumns)
                        ? timestampColumns.includes(snakeKey)
                        : snakeKey.endsWith('_at') ||
                          snakeKey === 'date' ||
                          snakeKey.endsWith('_time');
                    if (isTimestamp && value !== null && value !== undefined) {
                        const num = Number(value);
                        mappedValue = !isNaN(num) ? new Date(num) : value;
                    } else {
                        mappedValue = typeof value === 'string' ? parseInt(value, 10) : Number(value);
                    }
                }
                mapped[mappedKey] = mappedValue;
            }
        }

        return mapped;
    }

    public static getConfig(tableName: string): TableConfig | undefined {
        return SYNC_TABLES[tableName];
    }
}
