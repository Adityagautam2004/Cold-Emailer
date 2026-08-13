import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface StorageConfig {
  url: string;
  serviceRoleKey: string;
  bucket: string;
}

/**
 * Server-only resume storage. Takes its config as plain data rather than reading env
 * itself, so both apps/web and apps/worker can build one from their own env source
 * without this package importing Next.js/BullMQ. Object keys are always `{userId}/...` —
 * that prefix is the entire authorization model here (§3); callers must never accept a
 * key from a request body, only ever construct it from the authenticated user's id.
 */
export function createResumeStorage(config: StorageConfig) {
  const client: SupabaseClient = createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false },
  });
  const bucket = client.storage.from(config.bucket);

  return {
    resumeKey(userId: string, resumeId: string): string {
      return `${userId}/${resumeId}.pdf`;
    },

    userPrefix(userId: string): string {
      return userId;
    },

    async createUploadUrl(key: string): Promise<{ path: string; token: string; signedUrl: string }> {
      const { data, error } = await bucket.createSignedUploadUrl(key);
      if (error) throw error;
      return data;
    },

    /** Short-lived (default 60s per §3) — for browser previews, never for the worker's own reads. */
    async createDownloadUrl(key: string, expiresInSeconds = 60): Promise<string> {
      const { data, error } = await bucket.createSignedUrl(key, expiresInSeconds);
      if (error) throw error;
      return data.signedUrl;
    },

    /** Direct server-side read — used by the send worker, never the browser. */
    async download(key: string): Promise<Buffer> {
      const { data, error } = await bucket.download(key);
      if (error) throw error;
      return Buffer.from(await data.arrayBuffer());
    },

    async exists(key: string): Promise<boolean> {
      const slash = key.lastIndexOf("/");
      const prefix = slash === -1 ? "" : key.slice(0, slash);
      const filename = slash === -1 ? key : key.slice(slash + 1);
      const { data, error } = await bucket.list(prefix, { search: filename });
      if (error) throw error;
      return (data ?? []).some((f) => f.name === filename);
    },

    async remove(keys: string[]): Promise<void> {
      if (keys.length === 0) return;
      const { error } = await bucket.remove(keys);
      if (error) throw error;
    },

    /** Deletes every object under a user's prefix — used on account deletion (§14 settings). */
    async removeAllForUser(userId: string): Promise<void> {
      const { data: files, error: listError } = await bucket.list(userId);
      if (listError) throw listError;
      if (files && files.length > 0) {
        await this.remove(files.map((f) => `${userId}/${f.name}`));
      }
    },
  };
}

export type ResumeStorage = ReturnType<typeof createResumeStorage>;
