import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { dbService } from './DatabaseService';

interface BackupData {
    version: number;
    timestamp: number;
    categories: any[];
    exercises: any[];
    workouts: any[];
    workout_sets: any[];
    body_metrics: any[];
    settings: any[];
    measurements: any[];
    plate_inventory: any[];
    goals: any[];
}

export const TABLE_SCHEMAS: Record<string, string[]> = {
    categories: ['id', 'name', 'is_system', 'sort_order', 'color'],
    exercises: ['id', 'category_id', 'name', 'type', 'default_increment', 'notes', 'is_system'],
    workouts: ['id', 'date', 'start_time', 'end_time', 'name', 'notes', 'status', 'is_template'],
    workout_sets: ['id', 'workout_id', 'exercise_id', 'type', 'weight', 'reps', 'distance', 'time', 'rpe', 'order_index', 'completed', 'notes', 'superset_id'],
    body_metrics: ['id', 'date', 'weight', 'body_fat', 'notes'], // Legacy table, keeping for compatibility
    settings: ['key', 'value', 'description'],
    measurements: ['id', 'date', 'type', 'value', 'unit', 'notes'],
    plate_inventory: ['weight', 'count', 'type', 'unit'],
    goals: ['id', 'title', 'target_value', 'current_value', 'deadline', 'type', 'reference_id', 'completed']
};

type ImportMode = 'overwrite' | 'merge';

interface ImportOptions {
    mode?: ImportMode;
}

type ExportResult = {
    filePath: string;
    shared: boolean;
};

class BackupService {
    private async tableExists(tableName: string): Promise<boolean> {
        const row = await dbService.getFirst<{ count: number }>(
            "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name = ?",
            [tableName]
        );
        return (row?.count ?? 0) > 0;
    }

    private normalizeArray(value: unknown): any[] {
        return Array.isArray(value) ? value : [];
    }

    private async safeGetAll(tableName: string): Promise<any[]> {
        if (!(await this.tableExists(tableName))) return [];
        return await dbService.getAll(`SELECT * FROM ${tableName}`);
    }

    public async exportData(): Promise<ExportResult> {
        try {
            const categories = await this.safeGetAll('categories');
            const exercises = await this.safeGetAll('exercises');
            const workouts = await this.safeGetAll('workouts');
            const workout_sets = await this.safeGetAll('workout_sets');
            const body_metrics = await this.safeGetAll('body_metrics');
            const settings = await this.safeGetAll('settings');
            const measurements = await this.safeGetAll('measurements');
            const plate_inventory = await this.safeGetAll('plate_inventory');
            const goals = await this.safeGetAll('goals');

            const backup: BackupData = {
                version: 3,
                timestamp: Date.now(),
                categories,
                exercises,
                workouts,
                workout_sets,
                body_metrics,
                settings,
                measurements,
                plate_inventory,
                goals
            };

            // 2. Wrap in JSON
            const json = JSON.stringify(backup, null, 2);

            const fileName = `irontrain_backup_${new Date().toISOString().split('T')[0]}.json`;
            const baseDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
            if (!baseDir) throw new Error('No writable directory available');
            const filePath = `${baseDir}${fileName}`;

            await FileSystem.writeAsStringAsync(filePath, json, { encoding: FileSystem.EncodingType.UTF8 });

            let shared = false;
            try {
                const canShare = await Sharing.isAvailableAsync();
                if (canShare) {
                    await Sharing.shareAsync(filePath, {
                        mimeType: 'application/json',
                        dialogTitle: 'Exportar backup',
                        UTI: 'public.json',
                    });
                    shared = true;
                }
            } catch (e) {
                if (Platform.OS === 'android') {
                    try {
                        const contentUri = await FileSystem.getContentUriAsync(filePath);
                        await Sharing.shareAsync(contentUri, {
                            mimeType: 'application/json',
                            dialogTitle: 'Exportar backup',
                        });
                        shared = true;
                    } catch { }
                }
            }

            return { filePath, shared };
        } catch (e) {
            const message = (e as any)?.message ? String((e as any).message) : 'Error desconocido';
            console.error('Export Failed:', message);
            throw new Error('No se pudo exportar el backup');
        }
    }

    public async importData(options: ImportOptions = {}): Promise<boolean> {
        const mode: ImportMode = options.mode ?? 'overwrite';
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true
            });

            if (result.canceled) return false;

            const file = result.assets?.[0];
            if (!file?.uri) return false;
            const content = await FileSystem.readAsStringAsync(file.uri);
            const parsed: any = JSON.parse(content);
            const data: BackupData = {
                version: typeof parsed?.version === 'number' ? parsed.version : 0,
                timestamp: typeof parsed?.timestamp === 'number' ? parsed.timestamp : Date.now(),
                categories: this.normalizeArray(parsed?.categories),
                exercises: this.normalizeArray(parsed?.exercises),
                workouts: this.normalizeArray(parsed?.workouts),
                workout_sets: this.normalizeArray(parsed?.workout_sets),
                body_metrics: this.normalizeArray(parsed?.body_metrics),
                settings: this.normalizeArray(parsed?.settings),
                measurements: this.normalizeArray(parsed?.measurements),
                plate_inventory: this.normalizeArray(parsed?.plate_inventory),
                goals: this.normalizeArray(parsed?.goals),
            };

            if (data.exercises.length === 0 && data.workouts.length === 0 && data.measurements.length === 0) {
                throw new Error('Invalid backup file format');
            }

            const upsert = async (table: keyof typeof TABLE_SCHEMAS, rows: any[]) => {
                if (!rows || rows.length === 0) return;

                const allowedColumns = TABLE_SCHEMAS[table];
                if (!allowedColumns) return;
                if (!(await this.tableExists(table))) return;

                const keys = Object.keys(rows[0]).filter(k => allowedColumns.includes(k));
                
                if (keys.length === 0) {
                     return;
                }

                const placeholders = keys.map(() => '?').join(',');
                const columns = keys.join(',');

                const sql = `INSERT OR REPLACE INTO ${table} (${columns}) VALUES (${placeholders})`;

                for (const row of rows) {
                    const values = keys.map(k => row[k]);
                    await dbService.run(sql, values);
                }
            };

            if (data.categories.length === 0 && data.exercises.length > 0) {
                const categoryIds = Array.from(new Set(data.exercises.map((e) => e?.category_id).filter(Boolean)));
                data.categories = categoryIds.map((id: string) => ({
                    id,
                    name: 'Importado',
                    is_system: 0,
                    sort_order: 9998,
                    color: '#94a3b8'
                }));
            }

            try {
                await dbService.run('BEGIN TRANSACTION');

                if (mode === 'overwrite') {
                    if (await this.tableExists('workout_sets')) await dbService.run('DELETE FROM workout_sets');
                    if (await this.tableExists('workouts')) await dbService.run('DELETE FROM workouts');

                    if (await this.tableExists('measurements')) await dbService.run('DELETE FROM measurements');
                    if (await this.tableExists('goals')) await dbService.run('DELETE FROM goals');
                    if (await this.tableExists('plate_inventory')) await dbService.run('DELETE FROM plate_inventory');
                    if (await this.tableExists('settings')) await dbService.run('DELETE FROM settings');

                    if (await this.tableExists('exercises')) await dbService.run('DELETE FROM exercises');
                    if (await this.tableExists('categories')) await dbService.run('DELETE FROM categories');

                    if (await this.tableExists('body_metrics')) await dbService.run('DELETE FROM body_metrics');
                }

                await upsert('categories', data.categories);
                await upsert('exercises', data.exercises);
                await upsert('workouts', data.workouts);
                await upsert('workout_sets', data.workout_sets);
                await upsert('measurements', data.measurements);
                await upsert('plate_inventory', data.plate_inventory);
                await upsert('goals', data.goals);
                await upsert('settings', data.settings);
                await upsert('body_metrics', data.body_metrics);

                await dbService.run('COMMIT');
            } catch (e) {
                try {
                    await dbService.run('ROLLBACK');
                } catch { }
                throw e;
            }

            return true;

        } catch (e) {
            console.error('Import Failed');
            throw new Error('No se pudo restaurar el backup');
        }
    }
}

export const backupService = new BackupService();
