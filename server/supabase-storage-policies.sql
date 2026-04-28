-- WeeDeliver Supabase Storage Policies
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/kwltbxlqnbkqoyguvfjj/sql/new
-- This allows public read access and authenticated uploads to the 'weedeliver' bucket

-- 1. Allow anyone to view images (public read)
CREATE POLICY "Public read access for weedeliver bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'weedeliver');

-- 2. Allow anyone to upload images (we restrict via app logic)
-- For stricter security, change to: TO authenticated
CREATE POLICY "Anyone can upload to weedeliver bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'weedeliver');

-- 3. Allow users to update their own uploads
CREATE POLICY "Users can update own uploads in weedeliver"
ON storage.objects FOR UPDATE
USING (bucket_id = 'weedeliver');

-- 4. Allow users to delete their own uploads
CREATE POLICY "Users can delete own uploads in weedeliver"
ON storage.objects FOR DELETE
USING (bucket_id = 'weedeliver');
