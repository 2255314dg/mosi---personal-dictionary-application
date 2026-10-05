-- ============================================================
-- SECTION: SCHEMA
-- ============================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS "public";


--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";


--
-- Name: EXTENSION "pg_graphql"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "pg_graphql" IS 'pg_graphql: GraphQL support';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "pgcrypto"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "pgcrypto" IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";


--
-- Name: EXTENSION "supabase_vault"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "supabase_vault" IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "journal_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "nickname" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


--
-- Name: invitation_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."invitation_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "created_by" "uuid",
    "used_by" "uuid",
    "used_at" timestamp with time zone,
    "max_uses" integer DEFAULT 1 NOT NULL,
    "uses_count" integer DEFAULT 0 NOT NULL,
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: journal_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."journal_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "journal_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "version_note" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


--
-- Name: journals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."journals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid",
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "content" "text" NOT NULL,
    "content_type" "text" DEFAULT 'text'::"text" NOT NULL,
    "theme_tags" "text"[] DEFAULT '{}'::"text"[],
    "mood_tag" "text" DEFAULT '平静'::"text",
    "weather_tag" "text" DEFAULT '晴'::"text",
    "location_tag" "text" DEFAULT '许昌'::"text",
    "views_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


--
-- Name: music_tracks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."music_tracks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "artist" "text" DEFAULT '未知艺术家'::"text",
    "url" "text" NOT NULL,
    "duration" integer DEFAULT 0,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_builtin" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "nickname" "text",
    "avatar_url" "text",
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "real_name" "text",
    "gender" "text" DEFAULT 'secret'::"text",
    "bio" "text" DEFAULT ''::"text",
    "security_question" "text",
    "security_answer" "text",
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'user'::"text"])))
);


--
-- Name: tag_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."tag_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "type" "text",
    "emoji" "text" DEFAULT ''::"text",
    CONSTRAINT "tag_catalog_category_check" CHECK (("category" = ANY (ARRAY['theme'::"text", 'mood'::"text", 'weather'::"text"])))
);


--
-- Name: app_settings app_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'app_settings_key_key'
      AND n.nspname = 'public'
      AND c.relname = 'app_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_key_key" UNIQUE ("key");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'app_settings_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'app_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'comments_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'comments'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: invitation_codes invitation_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'invitation_codes_code_key'
      AND n.nspname = 'public'
      AND c.relname = 'invitation_codes'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "invitation_codes_code_key" UNIQUE ("code");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: invitation_codes invitation_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'invitation_codes_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'invitation_codes'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "invitation_codes_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: journal_versions journal_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'journal_versions_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'journal_versions'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."journal_versions"
    ADD CONSTRAINT "journal_versions_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: journals journals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'journals_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'journals'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."journals"
    ADD CONSTRAINT "journals_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: music_tracks music_tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'music_tracks_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'music_tracks'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."music_tracks"
    ADD CONSTRAINT "music_tracks_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'profiles_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'profiles_username_key'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: tag_catalog tag_catalog_category_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'tag_catalog_category_name_key'
      AND n.nspname = 'public'
      AND c.relname = 'tag_catalog'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."tag_catalog"
    ADD CONSTRAINT "tag_catalog_category_name_key" UNIQUE ("category", "name");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: tag_catalog tag_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'tag_catalog_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'tag_catalog'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."tag_catalog"
    ADD CONSTRAINT "tag_catalog_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: comments comments_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'comments_journal_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'comments'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "public"."journals"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'comments_user_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'comments'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: invitation_codes invitation_codes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'invitation_codes_created_by_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'invitation_codes'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "invitation_codes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: invitation_codes invitation_codes_used_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'invitation_codes_used_by_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'invitation_codes'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "invitation_codes_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: journal_versions journal_versions_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'journal_versions_journal_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'journal_versions'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."journal_versions"
    ADD CONSTRAINT "journal_versions_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "public"."journals"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: journals journals_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'journals_author_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'journals'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."journals"
    ADD CONSTRAINT "journals_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'profiles_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: invitation_codes Admins can manage invitation_codes; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins can manage invitation_codes'
      AND n.nspname = 'public'
      AND c.relname = 'invitation_codes'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins can manage invitation_codes" ON "public"."invitation_codes" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: app_settings Admins can update app_settings; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins can update app_settings'
      AND n.nspname = 'public'
      AND c.relname = 'app_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins can update app_settings" ON "public"."app_settings" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: tag_catalog Allow all operations for tag_catalog; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all operations for tag_catalog'
      AND n.nspname = 'public'
      AND c.relname = 'tag_catalog'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all operations for tag_catalog" ON "public"."tag_catalog" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles Allow anon and auth read profiles; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow anon and auth read profiles'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow anon and auth read profiles" ON "public"."profiles" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: comments Allow anyone insert comments; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow anyone insert comments'
      AND n.nspname = 'public'
      AND c.relname = 'comments'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow anyone insert comments" ON "public"."comments" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: comments Allow anyone read comments; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow anyone read comments'
      AND n.nspname = 'public'
      AND c.relname = 'comments'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow anyone read comments" ON "public"."comments" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: journal_versions Allow anyone read journal_versions; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow anyone read journal_versions'
      AND n.nspname = 'public'
      AND c.relname = 'journal_versions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow anyone read journal_versions" ON "public"."journal_versions" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: journals Allow anyone read journals; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow anyone read journals'
      AND n.nspname = 'public'
      AND c.relname = 'journals'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow anyone read journals" ON "public"."journals" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: music_tracks Allow anyone read music_tracks; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow anyone read music_tracks'
      AND n.nspname = 'public'
      AND c.relname = 'music_tracks'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow anyone read music_tracks" ON "public"."music_tracks" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: comments Allow authenticated delete comments; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow authenticated delete comments'
      AND n.nspname = 'public'
      AND c.relname = 'comments'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow authenticated delete comments" ON "public"."comments" FOR DELETE TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: journals Allow authenticated delete journals; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow authenticated delete journals'
      AND n.nspname = 'public'
      AND c.relname = 'journals'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow authenticated delete journals" ON "public"."journals" FOR DELETE TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: music_tracks Allow authenticated delete music_tracks; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow authenticated delete music_tracks'
      AND n.nspname = 'public'
      AND c.relname = 'music_tracks'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow authenticated delete music_tracks" ON "public"."music_tracks" FOR DELETE TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: journal_versions Allow authenticated insert journal_versions; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow authenticated insert journal_versions'
      AND n.nspname = 'public'
      AND c.relname = 'journal_versions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow authenticated insert journal_versions" ON "public"."journal_versions" FOR INSERT TO "authenticated" WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: journals Allow authenticated insert journals; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow authenticated insert journals'
      AND n.nspname = 'public'
      AND c.relname = 'journals'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow authenticated insert journals" ON "public"."journals" FOR INSERT TO "authenticated" WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: music_tracks Allow authenticated insert music_tracks; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow authenticated insert music_tracks'
      AND n.nspname = 'public'
      AND c.relname = 'music_tracks'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow authenticated insert music_tracks" ON "public"."music_tracks" FOR INSERT TO "authenticated" WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: journals Allow authenticated update journals; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow authenticated update journals'
      AND n.nspname = 'public'
      AND c.relname = 'journals'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow authenticated update journals" ON "public"."journals" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: music_tracks Allow authenticated update music_tracks; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow authenticated update music_tracks'
      AND n.nspname = 'public'
      AND c.relname = 'music_tracks'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow authenticated update music_tracks" ON "public"."music_tracks" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: tag_catalog Allow read tag_catalog for all; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow read tag_catalog for all'
      AND n.nspname = 'public'
      AND c.relname = 'tag_catalog'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow read tag_catalog for all" ON "public"."tag_catalog" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles Allow users insert own profile; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow users insert own profile'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow users insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles Allow users update own profile; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow users update own profile'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow users update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: app_settings Anyone can read app_settings; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone can read app_settings'
      AND n.nspname = 'public'
      AND c.relname = 'app_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone can read app_settings" ON "public"."app_settings" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: invitation_codes Public can update used invitation_codes; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public can update used invitation_codes'
      AND n.nspname = 'public'
      AND c.relname = 'invitation_codes'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Public can update used invitation_codes" ON "public"."invitation_codes" FOR UPDATE USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: invitation_codes Public can verify invitation_codes; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public can verify invitation_codes'
      AND n.nspname = 'public'
      AND c.relname = 'invitation_codes'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Public can verify invitation_codes" ON "public"."invitation_codes" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: app_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;

--
-- Name: invitation_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."invitation_codes" ENABLE ROW LEVEL SECURITY;

--
-- Name: journal_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."journal_versions" ENABLE ROW LEVEL SECURITY;

--
-- Name: journals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."journals" ENABLE ROW LEVEL SECURITY;

--
-- Name: music_tracks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."music_tracks" ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: tag_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."tag_catalog" ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




-- ============================================================
-- SECTION: DIFF FILTER OBJECTS
-- ============================================================
-- Objects that match diff-filter.json but cannot be represented
-- precisely by pg_dump --filter.

-- policy: "Anyone upload journal-images" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone upload journal-images'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Anyone upload journal-images" ON storage.objects AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK ((bucket_id = ''journal-images''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Anyone upload music" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone upload music'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Anyone upload music" ON storage.objects AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK ((bucket_id = ''music''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Public read journal-images" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public read journal-images'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Public read journal-images" ON storage.objects AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((bucket_id = ''journal-images''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Public read music" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public read music'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Public read music" ON storage.objects AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((bucket_id = ''music''::text));';
  END IF;
END
$pg_schema_restore$;

-- ============================================================
-- SECTION: STORAGE BUCKETS DATA
-- ============================================================

INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('journal-images', 'journal-images', NULL, '2026-09-24 06:11:20.006416+00', '2026-09-24 06:11:20.006416+00', 'true', 'false', NULL, NULL, NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";
INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('music', 'music', NULL, '2026-09-24 06:11:20.006416+00', '2026-09-24 06:11:20.006416+00', 'true', 'false', NULL, NULL, NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";

-- ============================================================
-- SECTION: CRON JOBS
-- ============================================================
-- 用户自定义 pg_cron 任务。

