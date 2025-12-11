import { supabase } from '../lib/supabaseClient';
import { generateClientId } from '../lib/utils';
import type { BattleMapConfig, BattleMapWidget } from '../types/battlemap';

export const DEFAULT_BATTLE_MAP_CONFIG: BattleMapConfig = {
  gridColumns: 12,
  gridRows: 8,
  cellSize: 80,
  widgets: [],
  version: 1,
};

type StorageMode = 'advanced' | 'legacy';

let hasCheckedAdvancedStorage = false;
let supportsAdvancedStorageCache = true;
let hasIsFixedColumn = true;

const isMissingTableError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const message = (error as { message?: string }).message?.toLowerCase() ?? '';
  return message.includes('does not exist') || message.includes('42p01');
};

const isMissingColumnError = (error: unknown, column: string) => {
  if (!error || typeof error !== 'object') return false;
  const message = (error as { message?: string }).message?.toLowerCase() ?? '';
  return message.includes('does not exist') && message.includes(column.toLowerCase());
};

const normalizeConfig = (config?: Partial<BattleMapConfig> | null): BattleMapConfig => ({
  gridColumns: Number(config?.gridColumns) || DEFAULT_BATTLE_MAP_CONFIG.gridColumns,
  gridRows: Number(config?.gridRows) || DEFAULT_BATTLE_MAP_CONFIG.gridRows,
  cellSize: Number(config?.cellSize) || DEFAULT_BATTLE_MAP_CONFIG.cellSize,
  widgets: (config?.widgets ?? []).map((widget) => ({
    id: widget.id || generateClientId(),
    x: widget.x ?? 0,
    y: widget.y ?? 0,
    w: widget.w ?? 1,
    h: widget.h ?? 1,
    content: widget.content ?? '',
    isFixed: widget.isFixed ?? false,
    updated_at: widget.updated_at,
  })),
  version: config?.version ?? DEFAULT_BATTLE_MAP_CONFIG.version,
  updated_at: config?.updated_at,
});

async function checkAdvancedStorageAvailability() {
  if (hasCheckedAdvancedStorage) {
    return supportsAdvancedStorageCache;
  }

  const { error } = await supabase.from('battle_map_configs').select('project_id').limit(1);

  if (error && isMissingTableError(error)) {
    supportsAdvancedStorageCache = false;
  }

  hasCheckedAdvancedStorage = true;
  return supportsAdvancedStorageCache;
}

async function loadFromAdvancedTables(projectId: string, userId: string): Promise<BattleMapConfig | null> {
  const { data: configRows, error: configError } = await supabase
    .from('battle_map_configs')
    .select('grid_columns, grid_rows, cell_size, version, updated_at')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .limit(1);

  if (configError) {
    if (isMissingTableError(configError)) {
      supportsAdvancedStorageCache = false;
      return null;
    }
    throw configError;
  }

  const configRow = configRows?.[0];

  if (!configRow) {
    return null;
  }

  const widgetSelect = hasIsFixedColumn
    ? 'id, x, y, w, h, content, is_fixed, updated_at, sort_index'
    : 'id, x, y, w, h, content, updated_at, sort_index';

  const { data: widgetRows, error: widgetError } = await supabase
    .from('battle_map_widgets')
    .select(widgetSelect)
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('sort_index', { ascending: true });

  if (widgetError) {
    if (isMissingColumnError(widgetError, 'is_fixed')) {
      hasIsFixedColumn = false;
      const retry = await supabase
        .from('battle_map_widgets')
        .select('id, x, y, w, h, content, updated_at, sort_index')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .order('sort_index', { ascending: true });

      if (retry.error) {
        throw retry.error;
      }

      return normalizeConfig({
        gridColumns: configRow.grid_columns,
        gridRows: configRow.grid_rows,
        cellSize: configRow.cell_size,
        widgets:
          retry.data?.map((widget) => ({
            id: widget.id,
            x: widget.x,
            y: widget.y,
            w: widget.w,
            h: widget.h,
            content: widget.content ?? '',
            updated_at: widget.updated_at,
            isFixed: false,
          })) ?? [],
        version: configRow.version,
        updated_at: configRow.updated_at,
      });
    }

    if (isMissingTableError(widgetError)) {
      supportsAdvancedStorageCache = false;
      return null;
    }
    throw widgetError;
  }

  const widgets: BattleMapWidget[] =
    widgetRows?.map((widget) => ({
      id: widget.id,
      x: widget.x,
      y: widget.y,
      w: widget.w,
      h: widget.h,
      content: widget.content ?? '',
      isFixed: hasIsFixedColumn ? widget.is_fixed ?? false : false,
      updated_at: widget.updated_at,
    })) ?? [];

  return normalizeConfig({
    gridColumns: configRow.grid_columns,
    gridRows: configRow.grid_rows,
    cellSize: configRow.cell_size,
    widgets,
    version: configRow.version,
    updated_at: configRow.updated_at,
  });
}

async function persistToAdvancedTables(
  projectId: string,
  userId: string,
  config: BattleMapConfig,
): Promise<BattleMapConfig> {
  const normalizedConfig = normalizeConfig(config);
  const nextVersion = (normalizedConfig.version ?? 1) + 1;
  const now = new Date().toISOString();

  const { error: configError } = await supabase.from('battle_map_configs').upsert({
    project_id: projectId,
    user_id: userId,
    grid_columns: normalizedConfig.gridColumns,
    grid_rows: normalizedConfig.gridRows,
    cell_size: normalizedConfig.cellSize,
    version: nextVersion,
    updated_at: now,
  });

  if (configError) {
    if (isMissingTableError(configError)) {
      supportsAdvancedStorageCache = false;
      return normalizedConfig;
    }
    throw configError;
  }

  const widgetsForUpsert = normalizedConfig.widgets.map((widget, index) => ({
    id: widget.id || generateClientId(),
    project_id: projectId,
    user_id: userId,
    x: widget.x ?? 0,
    y: widget.y ?? 0,
    w: widget.w ?? 1,
    h: widget.h ?? 1,
    content: widget.content ?? '',
    ...(hasIsFixedColumn ? { is_fixed: widget.isFixed ?? false } : {}),
    sort_index: index,
    updated_at: now,
  }));

  const { error: widgetError } = await supabase
    .from('battle_map_widgets')
    .upsert(widgetsForUpsert, { onConflict: 'id' });

  if (widgetError) {
    if (isMissingColumnError(widgetError, 'is_fixed')) {
      hasIsFixedColumn = false;
      const retryWidgets = normalizedConfig.widgets.map((widget, index) => ({
        id: widget.id || generateClientId(),
        project_id: projectId,
        user_id: userId,
        x: widget.x ?? 0,
        y: widget.y ?? 0,
        w: widget.w ?? 1,
        h: widget.h ?? 1,
        content: widget.content ?? '',
        sort_index: index,
        updated_at: now,
      }));

      const retryResult = await supabase
        .from('battle_map_widgets')
        .upsert(retryWidgets, { onConflict: 'id' });

      if (retryResult.error) {
        throw retryResult.error;
      }

      supportsAdvancedStorageCache = false;
      return normalizedConfig;
    }

    if (isMissingTableError(widgetError)) {
      supportsAdvancedStorageCache = false;
      return normalizedConfig;
    }
    throw widgetError;
  }

  const { data: existingWidgetIds } = await supabase
    .from('battle_map_widgets')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId);

  const staleIds =
    existingWidgetIds
      ?.map((row) => row.id)
      .filter((id) => !widgetsForUpsert.some((widget) => widget.id === id)) ?? [];

  if (staleIds.length > 0) {
    await supabase.from('battle_map_widgets').delete().in('id', staleIds);
  }

  return {
    ...normalizedConfig,
    widgets: widgetsForUpsert.map(({ id, x, y, w, h, content }) => ({
      id,
      x,
      y,
      w,
      h,
      content,
      isFixed: normalizedConfig.widgets.find((w) => w.id === id)?.isFixed ?? false,
      updated_at: now,
    })),
    version: nextVersion,
    updated_at: now,
  };
}

async function persistLegacySnapshot(
  projectId: string,
  userId: string,
  config: BattleMapConfig,
) {
  const legacyConfig = {
    gridColumns: config.gridColumns,
    gridRows: config.gridRows,
    cellSize: config.cellSize,
    widgets: config.widgets,
  };

  await supabase
    .from('projects')
    .update({ battle_map_config: legacyConfig })
    .eq('id', projectId)
    .eq('user_id', userId);
}

export async function loadBattleMapState(params: {
  projectId: string;
  userId: string;
  legacyConfig?: BattleMapConfig | null;
}): Promise<{ config: BattleMapConfig; storage: StorageMode }> {
  const supportsAdvanced = await checkAdvancedStorageAvailability();

  if (supportsAdvanced) {
    const config = await loadFromAdvancedTables(params.projectId, params.userId);

    if (config) {
      return { config, storage: 'advanced' };
    }
  }

  if (params.legacyConfig) {
    const normalized = normalizeConfig(params.legacyConfig);

    if (supportsAdvanced) {
      try {
        await persistToAdvancedTables(params.projectId, params.userId, normalized);
      } catch (migrationError) {
        console.warn('Battle map migration failed, keeping legacy storage', migrationError);
      }
    }

    return { config: normalized, storage: supportsAdvanced ? 'advanced' : 'legacy' };
  }

  return { config: DEFAULT_BATTLE_MAP_CONFIG, storage: supportsAdvanced ? 'advanced' : 'legacy' };
}

export async function persistBattleMapState(params: {
  projectId: string;
  userId: string;
  config: BattleMapConfig;
}): Promise<{ config: BattleMapConfig; storage: StorageMode }> {
  const supportsAdvanced = await checkAdvancedStorageAvailability();
  let persistedConfig = normalizeConfig(params.config);

  if (supportsAdvanced) {
    persistedConfig = await persistToAdvancedTables(params.projectId, params.userId, persistedConfig);
  } else {
    // Even if we are in legacy mode, bump the version locally so the client can reason about freshness.
    persistedConfig = {
      ...persistedConfig,
      version: (persistedConfig.version ?? 1) + 1,
    };
  }

  try {
    await persistLegacySnapshot(params.projectId, params.userId, persistedConfig);
  } catch (legacyError) {
    console.warn('Failed to persist legacy battle_map_config snapshot', legacyError);
  }

  return { config: persistedConfig, storage: supportsAdvanced ? 'advanced' : 'legacy' };
}
