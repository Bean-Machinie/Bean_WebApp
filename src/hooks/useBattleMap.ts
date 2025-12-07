import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { BattleMap, PlacedTile } from '../types/battlemap';

export function useBattleMap(projectId: string) {
  const [battleMap, setBattleMap] = useState<BattleMap | null>(null);
  const [placedTiles, setPlacedTiles] = useState<PlacedTile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBattleMap = async () => {
      if (!projectId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Fetch battle map
        const { data: mapData, error: mapError } = await supabase
          .from('battle_maps')
          .select('*')
          .eq('project_id', projectId)
          .single();

        if (mapError) {
          console.error('Battle map fetch error:', mapError);
          setError(`Failed to load battle map: ${mapError.message} (Code: ${mapError.code})`);
          setIsLoading(false);
          return;
        }

        if (!mapData) {
          setError('Battle map not found for this project');
          setIsLoading(false);
          return;
        }

        setBattleMap(mapData as BattleMap);

        // Fetch placed tiles with tile data
        const { data: tilesData, error: tilesError } = await supabase
          .from('battle_map_tiles')
          .select(`
            *,
            tile:tiles(*)
          `)
          .eq('map_id', mapData.id);

        if (tilesError) {
          console.error('Placed tiles fetch error:', tilesError);
          setError(`Failed to load placed tiles: ${tilesError.message}`);
          setIsLoading(false);
          return;
        }

        setPlacedTiles((tilesData as PlacedTile[]) || []);
        setIsLoading(false);
      } catch (err) {
        console.error('Unexpected error loading battle map:', err);
        setError('An unexpected error occurred while loading the battle map');
        setIsLoading(false);
      }
    };

    loadBattleMap();
  }, [projectId]);

  const addPlacedTile = async (tileId: string, x: number, y: number) => {
    if (!battleMap) return;

    const { data, error } = await supabase
      .from('battle_map_tiles')
      .insert({
        map_id: battleMap.id,
        tile_id: tileId,
        x,
        y,
        rotation: 0,
      })
      .select(`
        *,
        tile:tiles(*)
      `)
      .single();

    if (error) {
      console.error('Failed to add tile:', error);
      return;
    }

    setPlacedTiles((prev) => [...prev, data as PlacedTile]);
  };

  const removePlacedTile = async (placedTileId: string) => {
    const { error } = await supabase
      .from('battle_map_tiles')
      .delete()
      .eq('id', placedTileId);

    if (error) {
      console.error('Failed to remove tile:', error);
      return;
    }

    setPlacedTiles((prev) => prev.filter((t) => t.id !== placedTileId));
  };

  return {
    battleMap,
    placedTiles,
    isLoading,
    error,
    addPlacedTile,
    removePlacedTile,
  };
}
