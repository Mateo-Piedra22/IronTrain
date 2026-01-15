import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { backupService } from '../BackupService';
import { dbService } from '../DatabaseService';

// Mock dependencies
jest.mock('../DatabaseService', () => ({
  dbService: {
    run: jest.fn(),
    getAll: jest.fn(),
  },
}));

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  documentDirectory: 'file:///test/',
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

describe('BackupService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('importData', () => {
    it('should ignore columns not in the whitelist (SQL Injection prevention)', async () => {
      // Mock user selecting a file
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://test.json' }],
      });

      // Mock malicious JSON content
      const maliciousData = {
        exercises: [
          {
            id: '1',
            name: 'Bench Press',
            // MALICIOUS FIELD - attempting SQL injection via column name
            'notes); DROP TABLE exercises; --': 'gotcha',
            // VALID FIELD
            category_id: 'chest'
          }
        ],
        workouts: []
      };

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(JSON.stringify(maliciousData));

      await backupService.importData();

      // Check what was sent to DB
      // We expect dbService.run to be called.
      expect(dbService.run).toHaveBeenCalled();

      // Verify the specific SQL query structure
      const calls = (dbService.run as jest.Mock).mock.calls;
      const exerciseCall = calls.find(call => call[0].includes('exercises'));
      
      expect(exerciseCall).toBeDefined();
      const executedSql = exerciseCall[0];

      // CRITICAL SECURITY CHECKS
      expect(executedSql).not.toContain('DROP TABLE');
      expect(executedSql).not.toContain('notes);');
      
      // Should contain valid columns
      expect(executedSql).toContain('id');
      expect(executedSql).toContain('name');
      expect(executedSql).toContain('category_id');
      
      // Should look like: INSERT OR REPLACE INTO exercises (id,name,category_id) ...
      // The exact order depends on Object.keys but the malicious one must be gone
      console.log('Sanitized SQL:', executedSql);
    });

    it('should skip tables not in the whitelist', async () => {
       // Mock user selecting a file
       (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://test.json' }],
      });

      const unknownTableData = {
        exercises: [],
        workouts: [],
        // UNKNOWN TABLE
        hack_table: [{ id: 1, admin: true }]
      };

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(JSON.stringify(unknownTableData));

      await backupService.importData();

      // dbService.run should NOT be called for hack_table
      const calls = (dbService.run as jest.Mock).mock.calls;
      const hackCall = calls.find(call => call[0].includes('hack_table'));
      expect(hackCall).toBeUndefined();
    });
  });
});
