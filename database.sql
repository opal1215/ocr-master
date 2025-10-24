/**
 * 数据库初始化脚本 (v3 - 终极智能防错版)
 *
 * 这份脚本是“幂等”的，你可以安全地运行它任意次数。
 * 它会智能地先删除所有旧的“规矩”和“工具”，再创建新的。
 * 这将一次性修复所有 "already exists" 的错误。
 */

-- ==============================
-- 1. 创建users表 (IF NOT EXISTS 是智能的)
-- ==============================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  credits INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ==============================
-- 2. 创建payments表 (IF NOT EXISTS 是智能的)
-- ==============================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  credits_purchased INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  payment_method TEXT,
  transaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- ==============================
-- 3. 创建ocr_results表 (IF NOT EXISTS 是智能的)
-- ==============================
CREATE TABLE IF NOT EXISTS ocr_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  success BOOLEAN NOT NULL,
  file_size INTEGER,
  text_length INTEGER,
  processing_time_ms INTEGER,
  language_detected TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ocr_results_user_id ON ocr_results(user_id);
CREATE INDEX IF NOT EXISTS idx_ocr_results_created_at ON ocr_results(created_at DESC);

-- ==============================
-- 4. 创建更新时间的触发器 (CREATE OR REPLACE 是智能的)
-- ==============================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 【智能修复 1】: 修复 "trigger ... already exists" 错误
-- 先智能地“拆除”旧工具，再“创建”新工具
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ==============================
-- 5. 启用行级安全策略（RLS）
-- ==============================
-- 【智能修复 2】: 修复 "policy ... already exists" 错误
-- 我们在“创建”每一条规矩(Policy)之前，都先“智能地”把它撕掉(DROP)
-- 这样不管你运行多少次，都不会再报错了

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_results ENABLE ROW LEVEL SECURITY;

-- --- 针对 users 表的规矩 ---
DROP POLICY IF EXISTS "Users can view their own data" ON users;
CREATE POLICY "Users can view their own data" 
  ON users FOR SELECT 
  USING (auth.uid()::text = id::text);

-- 这就是 Codex 新加的那条“关键规矩”！
DROP POLICY IF EXISTS "Users can insert their own data" ON users;
CREATE POLICY "Users can insert their own data" 
  ON users FOR INSERT 
  WITH CHECK (auth.uid()::text = id::text);

DROP POLICY IF EXISTS "Users can update their own data" ON users;
CREATE POLICY "Users can update their own data" 
  ON users FOR UPDATE 
  USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

-- --- fYt payments 表的规矩 ---
DROP POLICY IF EXISTS "Users can view their own payments" ON payments;
CREATE POLICY "Users can view their own payments" 
  ON payments FOR SELECT 
  USING (auth.uid()::text = user_id::text);

-- --- fYt ocr_results 表的规矩 ---
DROP POLICY IF EXISTS "Users can view their own OCR results" ON ocr_results;
CREATE POLICY "Users can view their own OCR results" 
  ON ocr_results FOR SELECT 
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can insert their own OCR results" ON ocr_results;
CREATE POLICY "Users can insert their own OCR results" 
  ON ocr_results FOR INSERT 
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can update their own OCR results" ON ocr_results;
CREATE POLICY "Users can update their own OCR results" 
  ON ocr_results FOR UPDATE 
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- ==============================
-- 6. OCR积分扣减事务函数 (CREATE OR REPLACE 是智能的)
-- ==============================
CREATE OR REPLACE FUNCTION record_ocr_attempt(
  p_success boolean,
  p_text_length integer DEFAULT 0,
  p_file_size integer DEFAULT 0,
  p_processing_time_ms integer DEFAULT 0,
  p_language_detected text DEFAULT NULL
) RETURNS TABLE (remaining_credits integer, attempt_id uuid) AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_remaining integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_success THEN
    UPDATE users
        SET credits = credits - 1,
            updated_at = NOW()
      WHERE id = v_uid
        AND credits > 0
    RETURNING credits INTO v_remaining;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
    END IF;
  ELSE
    SELECT credits INTO v_remaining FROM users WHERE id = v_uid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'USER_NOT_FOUND';
    END IF;
  END IF;

  INSERT INTO ocr_results (
    user_id,
    success,
    text_length,
    file_size,
    processing_time_ms,
    language_detected
  ) VALUES (
    v_uid,
    p_success,
    p_text_length,
    p_file_size,
    p_processing_time_ms,
    p_language_detected
  )
  RETURNING id INTO attempt_id;

  remaining_credits := v_remaining;

  RETURN NEXT;
  RETURN;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public;

GRANT EXECUTE ON FUNCTION record_ocr_attempt(boolean, integer, integer, integer, text) TO authenticated;