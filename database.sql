/**
 * 数据库初始化脚本
 * 
 * 这个SQL脚本创建了我们OCR工具站需要的所有数据表。
 * 请在Supabase控制台的SQL编辑器中运行这些命令。
 * 
 * 我们的数据库设计非常简单，只有三个核心表：
 * 1. users表：存储用户基本信息和剩余积分
 * 2. payments表：记录所有支付交易
 * 3. ocr_results表：记录每次OCR识别的结果（用于统计）
 */

-- ==============================
-- 1. 创建users表
-- ==============================
-- 这个表存储用户信息，包括他们的邮箱和剩余的OCR识别次数（积分）
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,  -- 用户邮箱，必须唯一
  credits INTEGER DEFAULT 3,    -- 剩余积分数，新用户默认3次免费
  created_at TIMESTAMPTZ DEFAULT NOW(),  -- 注册时间
  updated_at TIMESTAMPTZ DEFAULT NOW()   -- 最后更新时间
);

-- 创建索引加快邮箱查询速度
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ==============================
-- 2. 创建payments表
-- ==============================
-- 这个表记录所有的支付交易
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- 关联到用户
  amount_cents INTEGER NOT NULL,  -- 支付金额（分为单位，499表示$4.99）
  credits_purchased INTEGER NOT NULL,  -- 购买的积分数
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),  -- 支付状态
  payment_method TEXT,  -- 支付方式（stripe、paypal等）
  transaction_id TEXT,  -- 第三方支付平台的交易ID
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引加快查询速度
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- ==============================
-- 3. 创建ocr_results表
-- ==============================
-- 这个表记录每次OCR识别的结果，用于统计和分析
CREATE TABLE IF NOT EXISTS ocr_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- 关联到用户
  success BOOLEAN NOT NULL,  -- 识别是否成功
  file_size INTEGER,  -- 图片文件大小（字节）
  processing_time_ms INTEGER,  -- 处理耗时（毫秒）
  language_detected TEXT,  -- 检测到的语言
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ocr_results_user_id ON ocr_results(user_id);
CREATE INDEX IF NOT EXISTS idx_ocr_results_created_at ON ocr_results(created_at DESC);

-- ==============================
-- 4. 创建更新时间的触发器
-- ==============================
-- 这个触发器自动更新users表的updated_at字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ==============================
-- 5. 启用行级安全策略（RLS）
-- ==============================
-- RLS确保用户只能访问自己的数据，这是Supabase的安全最佳实践
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_results ENABLE ROW LEVEL SECURITY;

-- 用户只能查看和更新自己的数据
CREATE POLICY "Users can view their own data" 
  ON users FOR SELECT 
  USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update their own data" 
  ON users FOR UPDATE 
  USING (auth.uid()::text = id::text);

-- 用户只能查看自己的支付记录
CREATE POLICY "Users can view their own payments" 
  ON payments FOR SELECT 
  USING (auth.uid()::text = user_id::text);

-- 用户只能查看自己的OCR记录
CREATE POLICY "Users can view their own OCR results" 
  ON ocr_results FOR SELECT 
  USING (auth.uid()::text = user_id::text);
