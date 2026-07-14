
CREATE POLICY "Avatars: public read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "Avatars: read own" ON storage.objects;
