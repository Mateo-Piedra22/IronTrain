import { MapDirection, SYNC_TABLES, TableConfig } from './SyncProtocol';

const ISO_8601_UTC_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

/**
 * SyncMapper.ts
 * 
 * Logic to map between local (Client/Mobile/SQLite) and remote (Server/API/JSON) formats.
 * This file is a optimized mirror of the backend SyncMapper to ensure consistency.
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
     * - TO_REMOTE:   Client (Mobile/SQLite) -> API/JSON (SnakeCase Keys, Boolean Values)
     * - FROM_REMOTE: API/JSON (SnakeCase Keys or camelCase) -> Client (Mobile/SQLite) (SnakeCase Keys, Number/Boolean Values)
     */
    public static mapObject(
        obj: Record<string, any>,
        tableName: string,
        direction: MapDirection
    ): Record<string, any> {
        const config = SYNC_TABLES[tableName];
        if (!config) return obj;

        const mapped: Record<string, any> = {};

        // Inverting overrides for mapping BACK to local keys
        const remoteToLocalOverrides: Record<string, string> = {};
        if (config.overrides) {
            for (const [local, remote] of Object.entries(config.overrides)) {
                remoteToLocalOverrides[remote] = local;
            }
        }

        for (const [key, value] of Object.entries(obj)) {
            // Normalize key (handle incoming camelCase if it's not explicitly overridden)
            let mappedKey = key;
            if (direction === 'FROM_REMOTE') {
                if (remoteToLocalOverrides[key]) {
                    mappedKey = remoteToLocalOverrides[key];
                } else {
                    // Try to convert to snake_case and see if it is a valid column
                    const snakeKey = this.toSnakeCase(key);
                    if (config.bigIntColumns.includes(snakeKey) || config.booleanColumns.includes(snakeKey)) {
                        mappedKey = snakeKey;
                    }
                }
            } else if (direction === 'TO_REMOTE') {
                if (config.overrides && config.overrides[key]) {
                    mappedKey = config.overrides[key];
                }
            }

            let mappedValue = value;

            if (direction === 'TO_REMOTE') {
                if (config.booleanColumns.includes(mappedKey)) {
                    mappedValue = (value === 1 || value === true || value === 'true') ? true : false;
                } else if (config.bigIntColumns.includes(mappedKey)) {
                    if (value === null || value === undefined || value === '') {
                        mappedValue = null;
                        mapped[mappedKey] = mappedValue;
                        continue;
                    }
                    mappedValue = typeof value === 'string' ? (parseInt(value, 10) || 0) : (Number(value) || 0);
                }
                mapped[mappedKey] = mappedValue;

            } else if (direction === 'FROM_REMOTE') {
                if (config.booleanColumns.includes(mappedKey)) {
                    // Local SQLite expects 1 or 0
                    mappedValue = (value === 1 || value === true || value === 'true') ? 1 : 0;
                } else if (config.bigIntColumns.includes(mappedKey)) {
                    if (value === null || value === undefined || value === '') {
                        mappedValue = null;
                        mapped[mappedKey] = mappedValue;
                        continue;
                    }

                    const timestampColumns = config.timestampColumns;
                    const isTimestamp = Array.isArray(timestampColumns)
                        ? timestampColumns.includes(mappedKey)
                        : mappedKey.endsWith('_at') ||
                          mappedKey === 'date' ||
                          mappedKey.endsWith('_time');

                    if (typeof value === 'string') {
                        // Detect if it's an ISO date string only for timestamp fields
                        if (isTimestamp && ISO_8601_UTC_REGEX.test(value)) {
                            const parsed = Date.parse(value);
                            mappedValue = isNaN(parsed) ? 0 : parsed;
                        } else {
                            mappedValue = parseInt(value, 10) || 0;
                        }
                    } else {
                        mappedValue = typeof value === 'number' ? value : (Number(value) || 0);
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
