import { env } from "@dispatch/config";
import { createResumeStorage } from "@dispatch/core";

export const resumeStorage = createResumeStorage({
  url: env.SUPABASE_URL,
  serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  bucket: env.SUPABASE_STORAGE_BUCKET,
});
