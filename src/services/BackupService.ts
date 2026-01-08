import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { dbService } from './DatabaseService';

interface BackupData {
    version: number;
    timestamp: number;
    exercises: any[];
    workouts: any[];
    workout_sets: any[];
    body_metrics: any[];
    settings: any[];
}

class BackupService {
    public async exportData(): Promise<void> {
        try {
            // 1. Gather Data
            const exercises = await dbService.getAll('SELECT * FROM exercises');
            const workouts = await dbService.getAll('SELECT * FROM workouts');
            const workout_sets = await dbService.getAll('SELECT * FROM workout_sets');
            const body_metrics = await dbService.getAll('SELECT * FROM body_metrics');
            const settings = await dbService.getAll('SELECT * FROM settings');

            const backup: BackupData = {
                version: 1,
                timestamp: Date.now(),
                exercises,
                workouts,
                workout_sets,
                body_metrics,
                settings
            };

            // 2. Wrap in JSON
            const json = JSON.stringify(backup, null, 2);

            // 3. Save to File
            const fileName = `irontrain_backup_${new Date().toISOString().split('T')[0]}.json`;
            // @ts-ignore
            if (!FileSystem.documentDirectory) throw new Error('No document directory');
            // @ts-ignore
            const filePath = `${FileSystem.documentDirectory}${fileName}`;
            await FileSystem.writeAsStringAsync(filePath, json);

            // 4. Share
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(filePath);
            } else {
                alert('Sharing is not available on this device');
            }

        } catch (e) {
            console.error('Export Failed', e);
            throw new Error('Failed to export data');
        }
    }

    public async importData(): Promise<boolean> {
        try {
            // 1. Pick File
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true
            });

            if (result.canceled) return false;

            const file = result.assets[0];
            const content = await FileSystem.readAsStringAsync(file.uri);
            const data: BackupData = JSON.parse(content);

            // 2. Validate
            if (!data.exercises || !data.workouts) {
                throw new Error('Invalid backup file format');
            }

            // 3. Import (Upsert Strategy)
            // Function to generate placemarkers (?, ?, ?)
            const upsert = async (table: string, rows: any[]) => {
                if (rows.length === 0) return;

                // Get keys from first row
                const keys = Object.keys(rows[0]);
                const placeholders = keys.map(() => '?').join(',');
                const columns = keys.join(',');

                // Simple iterative upsert for specific SQLite compatibility safety
                const sql = `INSERT OR REPLACE INTO ${table} (${columns}) VALUES (${placeholders})`;

                for (const row of rows) {
                    const values = keys.map(k => row[k]);
                    await dbService.run(sql, values);
                }
            };

            await upsert('exercises', data.exercises);
            await upsert('workouts', data.workouts);
            await upsert('workout_sets', data.workout_sets);
            await upsert('body_metrics', data.body_metrics);
            // settings usually better to manually merge or skip to avoid overwriting device specifics
            // ignoring settings for now to prevent weird state

            return true;

        } catch (e) {
            console.error('Import Failed', e);
            throw e;
        }
    }
}

export const backupService = new BackupService();
