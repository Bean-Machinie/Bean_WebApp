export type Project = {
  id: string;
  user_id: string;
  name: string;
  project_type: string;
  description?: string | null;
  is_public?: boolean | null;
  config: Record<string, unknown> | null;
  // Stores battle map state including grid and widgets
  battle_map_config?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};
