-- Academia: Cursos del admin + Videos de la comunidad
-- Ejecutar en Supabase SQL Editor

-- ============================================
-- Tabla: academia_courses (cursos del admin)
-- ============================================
CREATE TABLE IF NOT EXISTS academia_courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  category TEXT DEFAULT 'general',
  is_published BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Tabla: academia_lessons (lecciones de un curso)
-- ============================================
CREATE TABLE IF NOT EXISTS academia_lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES academia_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  youtube_url TEXT NOT NULL,
  youtube_video_id TEXT,
  duration_seconds INT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Tabla: academia_community (videos comunidad)
-- ============================================
CREATE TABLE IF NOT EXISTS academia_community (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  youtube_url TEXT NOT NULL,
  youtube_video_id TEXT,
  user_name TEXT,
  user_avatar_url TEXT,
  is_approved BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_academia_courses_user ON academia_courses(user_id);
CREATE INDEX IF NOT EXISTS idx_academia_lessons_course ON academia_lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_academia_community_user ON academia_community(user_id);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE academia_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE academia_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE academia_community ENABLE ROW LEVEL SECURITY;

-- Cursos: todos ven publicados, admin gestiona todo
CREATE POLICY "Anyone can view published courses"
  ON academia_courses FOR SELECT
  USING (is_published = true OR auth.uid() = user_id);

CREATE POLICY "Owner can manage courses"
  ON academia_courses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update courses"
  ON academia_courses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can delete courses"
  ON academia_courses FOR DELETE
  USING (auth.uid() = user_id);

-- Lecciones: todos leen
CREATE POLICY "Anyone can view lessons"
  ON academia_lessons FOR SELECT
  USING (true);

CREATE POLICY "Lesson insert via service role"
  ON academia_lessons FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Lesson update via service role"
  ON academia_lessons FOR UPDATE
  USING (true);

CREATE POLICY "Lesson delete via service role"
  ON academia_lessons FOR DELETE
  USING (true);

-- Comunidad: todos ven aprobados, cada usuario crea/borra los suyos
CREATE POLICY "Anyone can view approved community videos"
  ON academia_community FOR SELECT
  USING (is_approved = true OR auth.uid() = user_id);

CREATE POLICY "Users can create community videos"
  ON academia_community FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own community videos"
  ON academia_community FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Seed: Cursos iniciales (Dropshipping con IA)
-- ============================================
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'trucosecomydrop@gmail.com' LIMIT 1;

  IF admin_id IS NOT NULL THEN
    -- Modulo 1: Crea tus Cuentas de TikTok
    INSERT INTO academia_courses (user_id, title, description, thumbnail_url, category, is_published, sort_order)
    VALUES (
      admin_id,
      'Crea tus Cuentas de TikTok',
      'Aprende a crear y configurar tus cuentas de TikTok para vender con dropshipping. Configura tu perfil, optimiza tu bio y prepara todo para empezar a generar contenido.',
      '/academia/modulo-1.jpg',
      'marketing',
      true,
      1
    );

    -- Modulo 2: Creativos
    INSERT INTO academia_courses (user_id, title, description, thumbnail_url, category, is_published, sort_order)
    VALUES (
      admin_id,
      'Creativos',
      'Domina la creacion de contenido creativo para tus productos. Videos, imagenes y estrategias de contenido que convierten usando inteligencia artificial.',
      '/academia/modulo-2.jpg',
      'marketing',
      true,
      2
    );

    -- Modulo 3: Busqueda de Productos
    INSERT INTO academia_courses (user_id, title, description, thumbnail_url, category, is_published, sort_order)
    VALUES (
      admin_id,
      'Busqueda de Productos',
      'Encuentra productos ganadores con tecnicas avanzadas de investigacion. Aprende a validar productos, analizar competencia y encontrar nichos rentables.',
      '/academia/modulo-3.jpg',
      'dropshipping',
      true,
      3
    );

    -- Modulo 4: De 0 a 100 Ventas
    INSERT INTO academia_courses (user_id, title, description, thumbnail_url, category, is_published, sort_order)
    VALUES (
      admin_id,
      'De 0 a 100 Ventas',
      'Estrategias probadas para escalar tu negocio de dropshipping desde cero hasta tus primeras 100 ventas. Publicidad, optimizacion y escalamiento.',
      '/academia/modulo-4.jpg',
      'ecommerce',
      true,
      4
    );
  END IF;
END $$;
