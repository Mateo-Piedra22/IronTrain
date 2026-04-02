import { SocialSearchUser, SocialService } from '@/src/services/SocialService';
import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';

type SetState<T> = Dispatch<SetStateAction<T>>;

interface UseSocialSearchOptions {
    enabled: boolean;
    debounceMs?: number;
    onError?: () => void;
}

interface UseSocialSearchResult {
    searchQuery: string;
    setSearchQuery: SetState<string>;
    searchResults: SocialSearchUser[];
    setSearchResults: SetState<SocialSearchUser[]>;
    searching: boolean;
    setSearching: SetState<boolean>;
    handleSearch: (queryOverride?: string) => Promise<void>;
}

export function useSocialSearch({
    enabled,
    debounceMs = 250,
    onError,
}: UseSocialSearchOptions): UseSocialSearchResult {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SocialSearchUser[]>([]);
    const [searching, setSearching] = useState(false);
    const searchRequestIdRef = useRef(0);

    const handleSearch = useCallback(async (queryOverride?: string) => {
        const normalizedQuery = (queryOverride ?? searchQuery).trim();

        if (normalizedQuery.length < 2) {
            searchRequestIdRef.current += 1;
            setSearching(false);
            setSearchResults([]);
            return;
        }

        const requestId = ++searchRequestIdRef.current;
        setSearching(true);
        try {
            const results = await SocialService.searchUsers(normalizedQuery);
            if (requestId !== searchRequestIdRef.current) return;
            setSearchResults(results);
        } catch {
            if (requestId !== searchRequestIdRef.current) return;
            onError?.();
        } finally {
            if (requestId === searchRequestIdRef.current) {
                setSearching(false);
            }
        }
    }, [searchQuery, onError]);

    useEffect(() => {
        if (!enabled) return;

        const normalizedQuery = searchQuery.trim();
        if (normalizedQuery.length < 2) {
            searchRequestIdRef.current += 1;
            setSearching(false);
            setSearchResults([]);
            return;
        }

        const timeout = setTimeout(() => {
            void handleSearch(normalizedQuery);
        }, debounceMs);

        return () => clearTimeout(timeout);
    }, [enabled, searchQuery, handleSearch, debounceMs]);

    return {
        searchQuery,
        setSearchQuery,
        searchResults,
        setSearchResults,
        searching,
        setSearching,
        handleSearch,
    };
}
