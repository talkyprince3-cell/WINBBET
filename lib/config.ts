import { db } from "./supabase";
import { CONFIG_FIELDS } from "./config-fields";

export { CONFIG_FIELDS, CONFIG_GROUPS, type ConfigField, type ConfigGroup } from "./config-fields";

/**
 * Operator-editable configuration.
 *
 * Each key can be set in two places: the admin console (stored in
 * `app_settings`) or the deployment's environment. The console wins, so an
 * operator can rotate a key without a redeploy; the environment is the
 * fallback, so a deployment configured the old way keeps working.
 *
 * Reads are synchronous so the existing call sites stay as they are. Anything
 * about to use a key calls `refreshConfig()` first, which loads the table at
 * most every CACHE_MS per server instance.
 */

const CONFIG_KEYS = CONFIG_FIELDS.map((field) => field.key);
const CACHE_MS = 30_000;
let overlay: Record<string, string> = {};
let loadedAt = 0;
let inflight: Promise<void> | null = null;

export async function refreshConfig(): Promise<void> {
  if (Date.now() - loadedAt < CACHE_MS) return;
  inflight ??= (async () => {
    const supabase = db();
    if (!supabase) return;
    const { data, error } = await supabase.from("app_settings").select("key, value").in("key", CONFIG_KEYS);
    if (error) {
      console.error("[config] could not read app_settings", error);
      return;
    }
    overlay = Object.fromEntries((data ?? []).filter((row) => row.value?.trim()).map((row) => [row.key, row.value.trim()]));
    loadedAt = Date.now();
  })().finally(() => {
    inflight = null;
  });
  await inflight;
}

/** Forget the cache on this instance, after the operator saves. */
export function invalidateConfig() {
  loadedAt = 0;
}

export function config(name: string): string | undefined {
  const saved = overlay[name];
  if (saved) return saved;
  const env = process.env[name]?.trim();
  return env || undefined;
}

export function configNumber(name: string, fallback: number): number {
  const value = Number(config(name));
  return Number.isFinite(value) && config(name) !== undefined ? value : fallback;
}

/** The share of a referred deposit a sub-admin earns, as a fraction. */
export function commissionRate(): number {
  const percent = configNumber("COMMISSION_PERCENT", 60);
  return Math.min(100, Math.max(0, percent)) / 100;
}
