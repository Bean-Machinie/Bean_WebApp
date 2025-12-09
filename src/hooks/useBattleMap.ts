import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { BattleMapConfig } from '../types/battlemap';
import type { Project } from '../types/project';
import {
  DEFAULT_BATTLE_MAP_CONFIG,
  loadBattleMapState,
  persistBattleMapState,
} from '../services/battleMapStorage';

type UseBattleMapResult = {
  project: Project | null;
  config: BattleMapConfig;
  setConfig: Dispatch<SetStateAction<BattleMapConfig>>;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  storageMode: 'advanced' | 'legacy';
  refresh: () => Promise<void>;
  saveConfig: (nextConfig: BattleMapConfig) => Promise<void>;
};

export function useBattleMap(projectId?: string, userId?: string): UseBattleMapResult {
  const [project, setProject] = useState<Project | null>(null);
  const [config, setConfig] = useState<BattleMapConfig>(DEFAULT_BATTLE_MAP_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<'advanced' | 'legacy'>('legacy');

  const refresh = useCallback(async () => {
    if (!projectId || !userId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (projectError) {
      setError(projectError.message);
      setIsLoading(false);
      return;
    }

    const typedProject = projectData as Project;
    setProject(typedProject);

    try {
      const { config: loadedConfig, storage } = await loadBattleMapState({
        projectId,
        userId,
        legacyConfig: (typedProject as unknown as { battle_map_config?: BattleMapConfig }).battle_map_config,
      });

      setConfig(loadedConfig);
      setStorageMode(storage);
    } catch (storageError) {
      console.error('Failed to load battle map state', storageError);
      setError('Failed to load battle map state');
      setConfig(DEFAULT_BATTLE_MAP_CONFIG);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveConfig = useCallback(
    async (nextConfig: BattleMapConfig) => {
      if (!projectId || !userId) return;

      setIsSaving(true);
      setError(null);

      try {
        const { config: persistedConfig, storage } = await persistBattleMapState({
          projectId,
          userId,
          config: nextConfig,
        });

        setConfig(persistedConfig);
        setStorageMode(storage);
      } catch (persistError) {
        console.error('Failed to persist battle map state', persistError);
        setError('Failed to save battle map state');
      } finally {
        setIsSaving(false);
      }
    },
    [projectId, userId],
  );

  return {
    project,
    config,
    setConfig,
    isLoading,
    isSaving,
    error,
    storageMode,
    refresh,
    saveConfig,
  };
}
