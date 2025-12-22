import { supabase } from '../lib/supabaseClient';
import { generateClientId } from '../lib/utils';
import { mergeAppearanceIntoContent, parseAppearanceFromContent, resolveAppearance } from '../lib/battlemapAppearance';
import type { BattleMapConfig, BattleMapLayerState, BattleMapWidget, HexWidget } from '../types/battlemap';

export const DEFAULT_BATTLE_MAP_CONFIG: BattleMapConfig = {
  gridType: 'square',
  gridColumns: 12,
  gridRows: 8,
  cellSize: 80,
  gridLineWidth: 1,
  gridBorderWidth: 2,
  widgets: [],
  layers: [
    { id: 'grid-layer', name: 'Grid Map Layer', kind: 'grid', visible: true },
    { id: generateClientId(), name: 'Tile Layer 1', kind: 'tiles', visible: true },
  ],
  activeLayerId: 'grid-layer',
  version: 1,
};

export const DEFAULT_HEX_BATTLE_MAP_CONFIG: BattleMapConfig = {
  gridType: 'hex',
  gridColumns: 7,
  gridRows: 7,
  cellSize: 80,
  gridLineWidth: 1,
  gridBorderWidth: 2,
  widgets: [],
  hexSettings: {
    hexSize: 80,
    orientation: 'flat',
  },
  hexWidgets: [],
  layers: [
    { id: 'grid-layer', name: 'Grid Map Layer', kind: 'grid', visible: true },
    { id: generateClientId(), name: 'Tile Layer 1', kind: 'tiles', visible: true },
  ],
  activeLayerId: 'grid-layer',
  version: 1,
};

type StorageMode = 'advanced' | 'legacy';

let hasCheckedAdvancedStorage = false;
let supportsAdvancedStorageCache = true;
let hasIsFixedColumn = true;
let hasAllowedCellsColumn = true;
let hasLayersColumn = true;
let hasActiveLayerIdColumn = true;
let hasGridLineColorColumn = true;
let hasGridBorderColorColumn = true;
let hasGridLineWidthColumn = true;
let hasGridBorderWidthColumn = true;
let hasWidgetLayerIdColumn = true;

const GRID_LAYER_ID = 'grid-layer';

const buildDefaultLayers = (): BattleMapLayerState[] => [
  { id: GRID_LAYER_ID, name: 'Grid Map Layer', kind: 'grid', visible: true },
  { id: generateClientId(), name: 'Tile Layer 1', kind: 'tiles', visible: true },
];

const normalizeLayers = (layers?: BattleMapLayerState[] | null): BattleMapLayerState[] => {
  if (!Array.isArray(layers) || layers.length === 0) {
    return buildDefaultLayers();
  }

  let normalized = layers.map((layer, index) => {
    const name = typeof layer.name === 'string' && layer.name.trim().length > 0
      ? layer.name.trim()
      : `Layer ${index + 1}`;
    return {
      id: typeof layer.id === 'string' && layer.id.length > 0 ? layer.id : generateClientId(),
      name,
      kind: layer.kind === 'grid' || layer.kind === 'tiles' || layer.kind === 'image' || layer.kind === 'background'
        ? layer.kind
        : 'layer',
      visible: layer.visible !== false,
    };
  });

  const hasGridLayer = normalized.some((layer) => layer.kind === 'grid');
  if (!hasGridLayer) {
    normalized = [{ id: GRID_LAYER_ID, name: 'Grid Map Layer', kind: 'grid', visible: true }, ...normalized];
  }

  const hasTileLayer = normalized.some((layer) => layer.kind === 'tiles');
  if (!hasTileLayer) {
    const tileLayer = { id: generateClientId(), name: 'Tile Layer 1', kind: 'tiles' as const, visible: true };
    const gridIndex = normalized.findIndex((layer) => layer.kind === 'grid');
    if (gridIndex >= 0) {
      normalized = [
        ...normalized.slice(0, gridIndex + 1),
        tileLayer,
        ...normalized.slice(gridIndex + 1),
      ];
    } else {
      normalized = [tileLayer, ...normalized];
    }
  }

  return normalized;
};

const normalizeActiveLayerId = (
  activeLayerId: BattleMapConfig['activeLayerId'],
  layers: BattleMapLayerState[],
) => {
  if (activeLayerId && layers.some((layer) => layer.id === activeLayerId)) {
    return activeLayerId;
  }
  const gridLayer = layers.find((layer) => layer.kind === 'grid');
  return gridLayer?.id ?? layers[0]?.id ?? GRID_LAYER_ID;
};

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

const normalizeHexWidget = (widget: Partial<HexWidget>, defaultLayerId?: string): HexWidget => {
  const q = Number(widget.q) || 0;
  const r = Number(widget.r) || 0;
  const s =
    widget.s !== undefined && widget.s !== null
      ? Number(widget.s)
      : -(q + r);

  return {
    id: widget.id || generateClientId(),
    gridType: 'hex',
    q,
    r,
    s,
    layerId: widget.layerId ?? defaultLayerId,
    tileId: widget.tileId ?? '',
    appearance: widget.appearance,
    updated_at: widget.updated_at,
  };
};

const normalizeConfig = (config?: Partial<BattleMapConfig> | null): BattleMapConfig => {
  const isHexConfig =
    config?.gridType === 'hex' || Array.isArray((config as { hexWidgets?: HexWidget[] })?.hexWidgets);
  const gridLineWidth = Number(config?.gridLineWidth ?? DEFAULT_BATTLE_MAP_CONFIG.gridLineWidth ?? 1);
  const gridBorderWidth = Number(config?.gridBorderWidth ?? DEFAULT_BATTLE_MAP_CONFIG.gridBorderWidth ?? 2);
  const gridLineColor = typeof config?.gridLineColor === 'string' ? config?.gridLineColor : undefined;
  const gridBorderColor = typeof config?.gridBorderColor === 'string' ? config?.gridBorderColor : undefined;

  if (isHexConfig) {
    const hexSize =
      Number((config as BattleMapConfig)?.hexSettings?.hexSize) ||
      DEFAULT_HEX_BATTLE_MAP_CONFIG.hexSettings?.hexSize ||
      DEFAULT_HEX_BATTLE_MAP_CONFIG.cellSize;
    const orientation =
      (config as BattleMapConfig)?.hexSettings?.orientation === 'pointy' ? 'pointy' : 'flat';
    const gridColumns = Number(config?.gridColumns) || DEFAULT_HEX_BATTLE_MAP_CONFIG.gridColumns;
    const gridRows = Number(config?.gridRows) || DEFAULT_HEX_BATTLE_MAP_CONFIG.gridRows;
    const hexSettings = {
      hexSize,
      orientation,
    };

    const layers = normalizeLayers((config as BattleMapConfig)?.layers);
    const defaultTileLayerId = layers.find((layer) => layer.kind === 'tiles')?.id;
    return {
      gridType: 'hex',
      gridColumns,
      gridRows,
      cellSize: Number(config?.cellSize) || hexSize,
      gridLineWidth,
      gridBorderWidth,
      gridLineColor,
      gridBorderColor,
      widgets: [],
      hexSettings,
      hexWidgets: ((config as BattleMapConfig)?.hexWidgets ?? []).map((widget) =>
        normalizeHexWidget(widget, defaultTileLayerId),
      ),
      allowedHexCells: (config as BattleMapConfig)?.allowedHexCells,
      layers,
      activeLayerId: normalizeActiveLayerId((config as BattleMapConfig)?.activeLayerId, layers),
      version: config?.version ?? DEFAULT_HEX_BATTLE_MAP_CONFIG.version,
      updated_at: config?.updated_at,
    };
  }

  const layers = normalizeLayers((config as BattleMapConfig)?.layers);
  const defaultTileLayerId = layers.find((layer) => layer.kind === 'tiles')?.id;
  return {
    gridType: 'square',
    gridColumns: Number(config?.gridColumns) || DEFAULT_BATTLE_MAP_CONFIG.gridColumns,
    gridRows: Number(config?.gridRows) || DEFAULT_BATTLE_MAP_CONFIG.gridRows,
    cellSize: Number(config?.cellSize) || DEFAULT_BATTLE_MAP_CONFIG.cellSize,
    gridLineWidth,
    gridBorderWidth,
    gridLineColor,
    gridBorderColor,
    widgets: (config?.widgets ?? []).map((widget) => {
      const appearanceFromContent = parseAppearanceFromContent(widget.content ?? '');
      const resolvedAppearance = resolveAppearance({
        ...widget,
        appearance: widget.appearance ?? appearanceFromContent,
      });
      const baseContent =
        widget.content && widget.content.trim().length
          ? widget.content
          : `<div class="battlemap-widget-content">Widget</div>`;
      const content = mergeAppearanceIntoContent(baseContent, resolvedAppearance);

      return {
        id: widget.id || generateClientId(),
        x: widget.x ?? 0,
        y: widget.y ?? 0,
        w: widget.w ?? 1,
        h: widget.h ?? 1,
        content,
        layerId: widget.layerId ?? defaultTileLayerId,
        tileId: widget.tileId,
        appearance: resolvedAppearance,
        isFixed: widget.isFixed ?? false,
        updated_at: widget.updated_at,
      };
    }),
    allowedSquareCells: (config as BattleMapConfig)?.allowedSquareCells,
    layers,
    activeLayerId: normalizeActiveLayerId((config as BattleMapConfig)?.activeLayerId, layers),
    version: config?.version ?? DEFAULT_BATTLE_MAP_CONFIG.version,
    updated_at: config?.updated_at,
  };
};

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
  let configRowResult: any;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const selectParts = ['grid_columns', 'grid_rows', 'cell_size', 'version', 'updated_at'];
    if (hasAllowedCellsColumn) selectParts.push('allowed_square_cells');
    if (hasLayersColumn) selectParts.push('layers');
    if (hasActiveLayerIdColumn) selectParts.push('active_layer_id');
    if (hasGridLineColorColumn) selectParts.push('grid_line_color');
    if (hasGridBorderColorColumn) selectParts.push('grid_border_color');
    if (hasGridLineWidthColumn) selectParts.push('grid_line_width');
    if (hasGridBorderWidthColumn) selectParts.push('grid_border_width');

    try {
      configRowResult = await (supabase as any)
        .from('battle_map_configs')
        .select(selectParts.join(', '))
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .limit(1);
    } catch (err) {
      configRowResult = { error: err };
    }

    if (!configRowResult.error) {
      break;
    }

    if (isMissingTableError(configRowResult.error)) {
      supportsAdvancedStorageCache = false;
      return null;
    }

    if (isMissingColumnError(configRowResult.error, 'allowed_square_cells')) {
      hasAllowedCellsColumn = false;
      continue;
    }
    if (isMissingColumnError(configRowResult.error, 'layers')) {
      hasLayersColumn = false;
      continue;
    }
    if (isMissingColumnError(configRowResult.error, 'active_layer_id')) {
      hasActiveLayerIdColumn = false;
      continue;
    }
    if (isMissingColumnError(configRowResult.error, 'grid_line_color')) {
      hasGridLineColorColumn = false;
      continue;
    }
    if (isMissingColumnError(configRowResult.error, 'grid_border_color')) {
      hasGridBorderColorColumn = false;
      continue;
    }
    if (isMissingColumnError(configRowResult.error, 'grid_line_width')) {
      hasGridLineWidthColumn = false;
      continue;
    }
    if (isMissingColumnError(configRowResult.error, 'grid_border_width')) {
      hasGridBorderWidthColumn = false;
      continue;
    }

    hasAllowedCellsColumn = false;
    hasLayersColumn = false;
    hasActiveLayerIdColumn = false;
    hasGridLineColorColumn = false;
    hasGridBorderColorColumn = false;
    hasGridLineWidthColumn = false;
    hasGridBorderWidthColumn = false;
  }

  if (configRowResult.error) {
    if (isMissingTableError(configRowResult.error)) {
      supportsAdvancedStorageCache = false;
      return null;
    }
    throw configRowResult.error;
  }

  const configRow = configRowResult.data?.[0] as any;

  if (!configRow) {
    return null;
  }

  const widgetSelectParts = ['id', 'x', 'y', 'w', 'h', 'content', 'updated_at', 'sort_index'];
  if (hasIsFixedColumn) widgetSelectParts.push('is_fixed');
  if (hasWidgetLayerIdColumn) widgetSelectParts.push('layer_id');
  const widgetSelect = widgetSelectParts.join(', ');

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
        .select(
          [
            'id',
            'x',
            'y',
            'w',
            'h',
            'content',
            'updated_at',
            'sort_index',
            ...(hasWidgetLayerIdColumn ? ['layer_id'] : []),
          ].join(', '),
        )
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .order('sort_index', { ascending: true });

      if (retry.error) {
        if (isMissingColumnError(retry.error, 'layer_id')) {
          hasWidgetLayerIdColumn = false;
          const retryWithoutLayer = await supabase
            .from('battle_map_widgets')
            .select('id, x, y, w, h, content, updated_at, sort_index')
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .order('sort_index', { ascending: true });

          if (retryWithoutLayer.error) {
            throw retryWithoutLayer.error;
          }

          return normalizeConfig({
            gridColumns: configRow.grid_columns,
            gridRows: configRow.grid_rows,
            cellSize: configRow.cell_size,
            widgets:
              retryWithoutLayer.data?.map((widget) => ({
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
                layerId: hasWidgetLayerIdColumn ? widget.layer_id ?? undefined : undefined,
                updated_at: widget.updated_at,
                isFixed: false,
              })) ?? [],
            version: configRow.version,
            updated_at: configRow.updated_at,
          });
      }

    if (isMissingColumnError(widgetError, 'layer_id')) {
      hasWidgetLayerIdColumn = false;
      const retry = await supabase
        .from('battle_map_widgets')
        .select(
          [
            'id',
            'x',
            'y',
            'w',
            'h',
            'content',
            'updated_at',
            'sort_index',
            ...(hasIsFixedColumn ? ['is_fixed'] : []),
          ].join(', '),
        )
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .order('sort_index', { ascending: true });

      if (retry.error) {
        if (isMissingColumnError(retry.error, 'is_fixed')) {
          hasIsFixedColumn = false;
        }
        throw retry.error;
      }

      const retryWidgets: BattleMapWidget[] =
        retry.data?.map((widget) => ({
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
        widgets: retryWidgets,
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
      layerId: hasWidgetLayerIdColumn ? widget.layer_id ?? undefined : undefined,
      updated_at: widget.updated_at,
    })) ?? [];

  return normalizeConfig({
    gridColumns: configRow.grid_columns,
    gridRows: configRow.grid_rows,
    cellSize: configRow.cell_size,
    gridLineColor: hasGridLineColorColumn ? configRow.grid_line_color : undefined,
    gridBorderColor: hasGridBorderColorColumn ? configRow.grid_border_color : undefined,
    gridLineWidth: hasGridLineWidthColumn ? configRow.grid_line_width : undefined,
    gridBorderWidth: hasGridBorderWidthColumn ? configRow.grid_border_width : undefined,
    widgets,
    allowedSquareCells: hasAllowedCellsColumn
      ? (configRow as { allowed_square_cells?: BattleMapConfig['allowedSquareCells'] }).allowed_square_cells
      : undefined,
    layers: hasLayersColumn ? (configRow as { layers?: BattleMapLayerState[] }).layers : undefined,
    activeLayerId: hasActiveLayerIdColumn ? (configRow as { active_layer_id?: string }).active_layer_id : undefined,
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

  if (normalizedConfig.gridType === 'hex') {
    return normalizedConfig;
  }

  const nextVersion = (normalizedConfig.version ?? 1) + 1;
  const now = new Date().toISOString();

  const baseConfigUpsert = {
    project_id: projectId,
    user_id: userId,
    grid_columns: normalizedConfig.gridColumns,
    grid_rows: normalizedConfig.gridRows,
    cell_size: normalizedConfig.cellSize,
    version: nextVersion,
    updated_at: now,
  };

  let configResult: any;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let configUpsert = baseConfigUpsert;
    if (hasAllowedCellsColumn) {
      configUpsert = { ...configUpsert, allowed_square_cells: normalizedConfig.allowedSquareCells ?? null };
    }
    if (hasLayersColumn) {
      configUpsert = { ...configUpsert, layers: normalizedConfig.layers ?? null };
    }
    if (hasActiveLayerIdColumn) {
      configUpsert = { ...configUpsert, active_layer_id: normalizedConfig.activeLayerId ?? null };
    }
    if (hasGridLineColorColumn) {
      configUpsert = { ...configUpsert, grid_line_color: normalizedConfig.gridLineColor ?? null };
    }
    if (hasGridBorderColorColumn) {
      configUpsert = { ...configUpsert, grid_border_color: normalizedConfig.gridBorderColor ?? null };
    }
    if (hasGridLineWidthColumn) {
      configUpsert = { ...configUpsert, grid_line_width: normalizedConfig.gridLineWidth ?? null };
    }
    if (hasGridBorderWidthColumn) {
      configUpsert = { ...configUpsert, grid_border_width: normalizedConfig.gridBorderWidth ?? null };
    }

    configResult = await (supabase as any).from('battle_map_configs').upsert(configUpsert);

    if (!configResult.error) {
      break;
    }

    if (isMissingColumnError(configResult.error, 'allowed_square_cells')) {
      hasAllowedCellsColumn = false;
      continue;
    }
    if (isMissingColumnError(configResult.error, 'layers')) {
      hasLayersColumn = false;
      continue;
    }
    if (isMissingColumnError(configResult.error, 'active_layer_id')) {
      hasActiveLayerIdColumn = false;
      continue;
    }
    if (isMissingColumnError(configResult.error, 'grid_line_color')) {
      hasGridLineColorColumn = false;
      continue;
    }
    if (isMissingColumnError(configResult.error, 'grid_border_color')) {
      hasGridBorderColorColumn = false;
      continue;
    }
    if (isMissingColumnError(configResult.error, 'grid_line_width')) {
      hasGridLineWidthColumn = false;
      continue;
    }
    if (isMissingColumnError(configResult.error, 'grid_border_width')) {
      hasGridBorderWidthColumn = false;
      continue;
    }

    if (isMissingTableError(configResult.error)) {
      supportsAdvancedStorageCache = false;
      return normalizedConfig;
    }

    throw configResult.error;
  }

  if (configResult.error) {
    if (isMissingTableError(configResult.error)) {
      supportsAdvancedStorageCache = false;
      return normalizedConfig;
    }
    throw configResult.error;
  }

  const widgetsForUpsert = normalizedConfig.widgets.map((widget, index) => {
    const resolvedAppearance = resolveAppearance(widget);
    return {
      id: widget.id || generateClientId(),
      project_id: projectId,
      user_id: userId,
      x: widget.x ?? 0,
      y: widget.y ?? 0,
      w: widget.w ?? 1,
      h: widget.h ?? 1,
      content: mergeAppearanceIntoContent(widget.content ?? '', resolvedAppearance),
      ...(hasIsFixedColumn ? { is_fixed: widget.isFixed ?? false } : {}),
      ...(hasWidgetLayerIdColumn ? { layer_id: widget.layerId ?? null } : {}),
      sort_index: index,
      updated_at: now,
    };
  });

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
        ...(hasWidgetLayerIdColumn ? { layer_id: widget.layerId ?? null } : {}),
        sort_index: index,
        updated_at: now,
      }));

      const retryResult = await supabase
        .from('battle_map_widgets')
        .upsert(retryWidgets, { onConflict: 'id' });

      if (retryResult.error) {
        if (isMissingColumnError(retryResult.error, 'layer_id')) {
          hasWidgetLayerIdColumn = false;
          const retryWithoutLayer = normalizedConfig.widgets.map((widget, index) => ({
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

          const retryWithoutLayerResult = await supabase
            .from('battle_map_widgets')
            .upsert(retryWithoutLayer, { onConflict: 'id' });

          if (retryWithoutLayerResult.error) {
            throw retryWithoutLayerResult.error;
          }

          supportsAdvancedStorageCache = false;
          return normalizedConfig;
        }
        throw retryResult.error;
      }

      supportsAdvancedStorageCache = false;
      return normalizedConfig;
    }

    if (isMissingColumnError(widgetError, 'layer_id')) {
      hasWidgetLayerIdColumn = false;
      const retryWidgets = normalizedConfig.widgets.map((widget, index) => ({
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

      const retryResult = await supabase
        .from('battle_map_widgets')
        .upsert(retryWidgets, { onConflict: 'id' });

      if (retryResult.error) {
        if (isMissingColumnError(retryResult.error, 'is_fixed')) {
          hasIsFixedColumn = false;
        }
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
      appearance: normalizedConfig.widgets.find((w) => w.id === id)?.appearance,
      isFixed: normalizedConfig.widgets.find((w) => w.id === id)?.isFixed ?? false,
      layerId: normalizedConfig.widgets.find((w) => w.id === id)?.layerId,
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
  const legacyConfig =
    config.gridType === 'hex'
      ? {
          gridType: 'hex' as const,
          gridColumns: config.gridColumns,
          gridRows: config.gridRows,
          cellSize: config.cellSize,
          gridLineColor: config.gridLineColor,
          gridBorderColor: config.gridBorderColor,
          gridLineWidth: config.gridLineWidth,
          gridBorderWidth: config.gridBorderWidth,
          hexSettings: config.hexSettings ?? DEFAULT_HEX_BATTLE_MAP_CONFIG.hexSettings,
          hexWidgets: config.hexWidgets ?? [],
          allowedHexCells: config.allowedHexCells,
          layers: config.layers,
          activeLayerId: config.activeLayerId,
          version: config.version,
          updated_at: config.updated_at,
        }
      : {
          gridType: 'square' as const,
          gridColumns: config.gridColumns,
          gridRows: config.gridRows,
          cellSize: config.cellSize,
          gridLineColor: config.gridLineColor,
          gridBorderColor: config.gridBorderColor,
          gridLineWidth: config.gridLineWidth,
          gridBorderWidth: config.gridBorderWidth,
          widgets: config.widgets,
          allowedSquareCells: config.allowedSquareCells,
          layers: config.layers,
          activeLayerId: config.activeLayerId,
          version: config.version,
          updated_at: config.updated_at,
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
  if (params.legacyConfig?.gridType === 'hex') {
    return { config: normalizeConfig(params.legacyConfig), storage: 'legacy' };
  }

  const supportsAdvanced = await checkAdvancedStorageAvailability();

  if (supportsAdvanced) {
    const config = await loadFromAdvancedTables(params.projectId, params.userId);

    if (config) {
      const mergedConfig =
        config.gridType === 'square'
          ? {
              ...config,
              ...((!config.allowedSquareCells || config.allowedSquareCells.length === 0) &&
              params.legacyConfig?.allowedSquareCells?.length
                ? { allowedSquareCells: params.legacyConfig.allowedSquareCells }
                : {}),
              ...(config.layers && config.layers.length > 0
                ? {}
                : params.legacyConfig?.layers
                  ? { layers: params.legacyConfig.layers }
                  : {}),
              ...(config.activeLayerId
                ? {}
                : params.legacyConfig?.activeLayerId
                  ? { activeLayerId: params.legacyConfig.activeLayerId }
                  : {}),
              ...(config.gridLineColor
                ? {}
                : params.legacyConfig?.gridLineColor
                  ? { gridLineColor: params.legacyConfig.gridLineColor }
                  : {}),
              ...(config.gridBorderColor
                ? {}
                : params.legacyConfig?.gridBorderColor
                  ? { gridBorderColor: params.legacyConfig.gridBorderColor }
                  : {}),
              ...(config.gridLineWidth !== undefined
                ? {}
                : params.legacyConfig?.gridLineWidth !== undefined
                  ? { gridLineWidth: params.legacyConfig.gridLineWidth }
                  : {}),
              ...(config.gridBorderWidth !== undefined
                ? {}
                : params.legacyConfig?.gridBorderWidth !== undefined
                  ? { gridBorderWidth: params.legacyConfig.gridBorderWidth }
                  : {}),
            }
          : config;
      return { config: mergedConfig, storage: 'advanced' };
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

  if (persistedConfig.gridType === 'hex') {
    persistedConfig = {
      ...persistedConfig,
      version: (persistedConfig.version ?? 1) + 1,
      updated_at: new Date().toISOString(),
    };

    try {
      await persistLegacySnapshot(params.projectId, params.userId, persistedConfig);
    } catch (legacyError) {
      console.warn('Failed to persist hex battle_map_config snapshot', legacyError);
    }

    return { config: persistedConfig, storage: 'legacy' };
  }

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
