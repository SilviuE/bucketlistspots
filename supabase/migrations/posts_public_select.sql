-- Allow public (anonymous) SELECT on posts so unauthenticated visitors can see news
DROP POLICY IF EXISTS "posts_select_anon" ON posts;
CREATE POLICY "posts_select_anon" ON posts FOR SELECT TO anon USING (true);
