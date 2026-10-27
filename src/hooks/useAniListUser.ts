import { useState, useEffect, useCallback } from 'react';
import type { AniListUser, UserMediaListEntry } from '../types/anime';
import { fetchUserWatchList } from '../api/anilist';

const LOCAL_STORAGE_USER_KEY = 'paaru_anilist_user';

export function useAniListUser() {
  const [userName, setUserNameState] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_USER_KEY) || '';
  });

  const [user, setUser] = useState<AniListUser | null>(null);
  const [userEntries, setUserEntries] = useState<Map<number, UserMediaListEntry> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);



  const syncUser = useCallback(async (name: string, force = false): Promise<boolean> => {
    if (!name || name.trim().length === 0) {
      setUser(null);
      setUserEntries(null);
      setError(null);
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetchUserWatchList(name.trim(), force);
      setUser(res.user);
      setUserEntries(res.entries);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, name.trim());
      setError(null);
      return true;
    } catch (err: any) {
      console.error('Failed to sync AniList user:', err);
      const rawMsg = (err?.message || '').toLowerCase();
      let friendlyMsg = err?.message || 'Failed to fetch AniList user';

      if (rawMsg.includes('private') || rawMsg.includes('permission')) {
        friendlyMsg = 'This AniList list is private. Set your Anime List to Public in AniList Settings → Account to sync.';
      } else if (rawMsg.includes('not found') || rawMsg.includes('404')) {
        friendlyMsg = `No AniList account found with username "${name.trim()}". Please check the spelling.`;
      }

      setError(friendlyMsg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setUserName = useCallback(
    async (name: string): Promise<boolean> => {
      setUserNameState(name);
      if (name.trim()) {
        return await syncUser(name.trim(), false);
      } else {
        localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
        setUser(null);
        setUserEntries(null);
        setError(null);
        return true;
      }
    },
    [syncUser]
  );

  const clearUserError = useCallback(() => {
    setError(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (userName) {
      await syncUser(userName, true);
    }
  }, [userName, syncUser]);

  const logout = useCallback(() => {
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    setUserNameState('');
    setUser(null);
    setUserEntries(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (userName) {
      syncUser(userName, false);
    }
  }, [userName, syncUser]);

  return {
    userName,
    user,
    userEntries,
    isLoadingUser: isLoading,
    userError: error,
    setUserName,
    refreshUser,
    logout,
    clearUserError,
  };
}
