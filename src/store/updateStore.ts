import { create } from 'zustand';

export type UpdateStatus =
    | 'idle'
    | 'checking'
    | 'up_to_date'
    | 'update_available'
    | 'update_pending' // Available but waiting for user/download
    | 'deprecated'     // App version is below minSupportedVersion (Blocking)
    | 'error';

export interface UpdateState {
    status: UpdateStatus;
    installedVersion: string;
    latestVersion: string | null;
    minSupportedVersion: string | null;
    downloadUrl: string | null;
    notesUrl: string | null;
    releaseDate: string | null;
    lastChecked: number | null;
    error: string | null;

    // Actions
    setStatus: (status: UpdateStatus) => void;
    setUpdateInfo: (info: Partial<Omit<UpdateState, 'status' | 'actions'>>) => void;
    reset: () => void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
    status: 'idle',
    installedVersion: '0.0.0', // Will be set by UpdateService
    latestVersion: null,
    minSupportedVersion: null,
    downloadUrl: null,
    notesUrl: null,
    releaseDate: null,
    lastChecked: null,
    error: null,

    setStatus: (status) => set({ status }),
    setUpdateInfo: (info) => set((state) => ({ ...state, ...info })),
    reset: () => set({
        status: 'idle',
        latestVersion: null,
        minSupportedVersion: null,
        downloadUrl: null,
        notesUrl: null,
        releaseDate: null,
        error: null
    })
}));
