import { dbService } from '../DatabaseService';
import { IronScoreService } from '../IronScoreService';

jest.mock('../DatabaseService', () => ({
  dbService: {
    withTransaction: jest.fn(async (cb: () => Promise<void>) => {
      await cb();
    }),
    run: jest.fn(async () => ({})),
    getFirst: jest.fn(async () => null),
    getAll: jest.fn(async () => []),
    getWorkoutById: jest.fn(async () => ({ finish_lat: null, finish_lon: null })),
    getExerciseById: jest.fn(async () => ({ id: 'e1', name: 'Bench Press' })),
    queueSyncMutation: jest.fn(async () => undefined),
  },
}));

jest.mock('../ConfigService', () => ({
  configService: {
    set: jest.fn(async () => undefined),
    get: jest.fn((key: string) => {
      if (key === 'training_days') return [1];
      if (key === 'cachedSocialScoringRefreshedAt') return 0;
      if (key === 'cachedSocialScoreConfig') {
        return {
          workoutCompletePoints: 20,
          extraDayPoints: 10,
          extraDayWeeklyCap: 2,
          prNormalPoints: 10,
          prBig3Points: 25,
          adverseWeatherPoints: 15,
          weekTier2Min: 3,
          weekTier3Min: 5,
          weekTier4Min: 10,
          tier2Multiplier: 1.1,
          tier3Multiplier: 1.25,
          tier4Multiplier: 1.5,
          coldThresholdC: 3,
          weatherBonusEnabled: 1,
        };
      }
      if (key === 'cachedSocialActiveEvent') {
        return { id: 'ev1', title: 'Doble XP', multiplier: 2, endDate: new Date(Date.now() + 100000).toISOString() };
      }
      if (key === 'cachedSocialWeatherBonus') {
        return { location: 'X', condition: 'rain', temperature: 2, multiplier: 1, isActive: true };
      }
      return null;
    }),
  },
}));

jest.mock('../SocialService', () => ({
  SocialService: {
    getProfile: jest.fn(async () => ({
      id: 'u1',
      displayName: null,
      username: null,
      activeEvent: null,
      weatherBonus: null,
      scoreConfig: null,
    })),
    updateWeatherBonus: jest.fn(async () => ({
      location: 'X',
      condition: 'rain',
      temperature: 2,
      multiplier: 1,
      isActive: true,
    })),
  },
}));

jest.mock('../../store/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({ user: { id: 'u1' } })),
  },
}));

describe('IronScoreService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('awards workout complete + PR + extra day once and updates score_lifetime', async () => {
    const existingEventKeys = new Set<string>();

    (dbService.getAll as jest.Mock).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM workout_sets') && sql.includes('JOIN exercises')) {
        return [{ exercise_id: 'e1', exercise_name: 'Bench Press', weight: 100, reps: 5 }];
      }
      if (sql.includes('SELECT date FROM workouts')) {
        return [{ date: 1700000000000 }, { date: 1700086400000 }];
      }
      return [];
    });

    (dbService.getFirst as jest.Mock).mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM user_profiles') && sql.includes('SELECT id')) {
        return null;
      }
      if (sql.includes('SELECT streak_weeks') && sql.includes('streak_week_evaluated_at')) {
        return { streak_weeks: 0, streak_week_evaluated_at: null };
      }
      if (sql.includes('SELECT score_lifetime')) {
        return { score_lifetime: 0 };
      }
      if (sql.includes('FROM score_events') && sql.includes('event_key')) {
        const key = String(params?.[1] ?? '');
        if (existingEventKeys.has(key)) return { id: 'existing' };
        return null;
      }
      if (sql.includes('MAX(s.weight') && sql.includes('best_1rm_kg')) {
        return { best_1rm_kg: 0 };
      }
      if (sql.includes('COUNT(*) as count FROM workouts')) {
        return { count: 2 };
      }
      if (sql.includes("FROM score_events") && sql.includes("event_type = 'extra_day'")) {
        return { count: 0 };
      }
      return null;
    });

    (dbService.run as jest.Mock).mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('INSERT INTO score_events')) {
        const eventKeyIdx = params.findIndex((p) => typeof p === 'string' && String(p).includes(':') && (String(p).startsWith('workout_completed:') || String(p).startsWith('pr_broken:') || String(p).startsWith('extra_day:') || String(p).startsWith('weather:')));
        if (eventKeyIdx >= 0) {
          existingEventKeys.add(String(params[eventKeyIdx]));
        }
      }
      return {};
    });

    const r1 = await IronScoreService.awardForFinishedWorkout('w1', 1700000000000);
    expect(r1.insertedEvents).toBe(4);
    expect(r1.pointsAwarded).toBe(140);

    const r2 = await IronScoreService.awardForFinishedWorkout('w1', 1700000000000);
    expect(r2.insertedEvents).toBe(0);
    expect(r2.pointsAwarded).toBe(0);

    expect(dbService.queueSyncMutation).toHaveBeenCalledWith(
      'user_profiles',
      'u1',
      'UPDATE',
      expect.objectContaining({ score_lifetime: 140 })
    );
  });

  it('uses local events sum as baseline if stored score_lifetime is stale (0)', async () => {
    // Setup: 
    // - Local user_profiles has score_lifetime = 0
    // - Local score_events already has 100 points
    // - New workout awards 20 points
    // - Result should be 120 points (0 -> 120)

    (dbService.getAll as jest.Mock).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM workout_sets')) return [];
      if (sql.includes('SELECT date FROM workouts')) return [];
      return [];
    });

    (dbService.getFirst as jest.Mock).mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT score_lifetime')) return { score_lifetime: 0 };
      if (sql.includes('SELECT SUM(points_awarded)')) return { sum: 120 };
      if (sql.includes('FROM score_events')) return null;
      if (sql.includes('COUNT(*) as count FROM workouts')) return { count: 1 };
      return null;
    });

    const r = await IronScoreService.awardForFinishedWorkout('w1', 1700000000000);

    // 20 points (workout completed) + 0 from others in this mock
    // Wait, the mock in IronScoreService awarded 20 for completion.
    // The baseline should be Math.max(0, 100 - 0) = 100 if we haven't inserted the new ones yet?
    // In our code:
    // 1. Insert new events.
    // 2. Query SUM(points_awarded) -> 120 (100 old + 20 new)
    // 3. pointsAwarded = 20
    // 4. baseline = Math.max(0, 120 - 20) = 100
    // 5. nextScore = 100 + 20 = 120. Correct!

    expect(r.pointsAwarded).toBe(70);
    expect(dbService.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE user_profiles SET score_lifetime = ?'),
      [120, expect.any(Number), 'u1']
    );
  });
});
