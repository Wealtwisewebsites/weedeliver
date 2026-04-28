// Supabase client for WeeDeliver frontend
// Used primarily for image uploads to Supabase Storage
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || "weedeliver";

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/**
 * Upload an image file to Supabase Storage
 * @param {File} file - The image file to upload
 * @param {string} folder - Folder path inside the bucket (e.g. "banners", "products", "profiles")
 * @returns {Promise<{ url: string | null, error: string | null }>}
 */
export const uploadImage = async (file, folder = "uploads") => {
  if (!supabase) {
    return { url: null, error: "Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env" };
  }

  if (!file) return { url: null, error: "No file provided" };
  if (file.size > 5 * 1024 * 1024) return { url: null, error: "Image must be under 5MB" };
  if (!file.type.startsWith("image/")) return { url: null, error: "File must be an image" };

  // Generate unique filename
  const ext = file.name.split(".").pop();
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filename, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return { url: null, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    return { url: urlData.publicUrl, error: null };
  } catch (err) {
    return { url: null, error: err.message };
  }
};

/**
 * Delete an image from Supabase Storage
 * @param {string} url - The public URL of the image
 */
export const deleteImage = async (url) => {
  if (!supabase || !url) return { error: null };
  try {
    // Extract path from public URL
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)/);
    if (!pathMatch) return { error: "Invalid Supabase storage URL" };
    const path = pathMatch[1];

    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
    return { error: error?.message || null };
  } catch (err) {
    return { error: err.message };
  }
};

export default supabase;
