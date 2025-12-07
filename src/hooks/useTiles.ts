import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Tile } from '../types/battlemap';
import { useAuth } from '../context/AuthContext';

export function useTiles() {
  const { user } = useAuth();
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTiles = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('tiles')
        .select('*')
        .eq('owner', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Tiles fetch error:', fetchError);
        setError(`Failed to load tiles: ${fetchError.message} (Code: ${fetchError.code})`);
        setIsLoading(false);
        return;
      }

      setTiles((data as Tile[]) || []);
      setIsLoading(false);
    } catch (err) {
      console.error('Unexpected error loading tiles:', err);
      setError('An unexpected error occurred while loading tiles');
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadTiles();
  }, [loadTiles]);

  return {
    tiles,
    isLoading,
    error,
    refreshTiles: loadTiles,
  };
}
