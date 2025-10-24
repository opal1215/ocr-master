/**
 * Google OAuth认证回调路由
 * * ... (你的注释都保留，这很棒) ...
 * */

// ⬇️⬇️⬇️ 这是唯一的修改 ⬇️⬇️⬇️
// 我们把 '@/lib/supabase' 改成了 '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase-server'
// ⬆️⬆️⬆️ 这是唯一的修改 ⬆️⬆️⬆️

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // 从URL中获取认证代码（由Google提供）
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    // 创建Supabase客户端实例
    const supabase = createServerClient()
    
    /**
     * 使用认证代码交换会话
     * ... (你的注释都保留) ...
     */
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      /**
       * 在数据库中创建或更新用户记录
       * ... (你的注释都保留) ...
       */
      await supabase
        .from('users')
        .upsert({
          id: data.user.id,
          email: data.user.email,
          credits: 3, // 新用户默认3次免费
        }, {
          onConflict: 'email', // 如果邮箱已存在，则更新而不是插入
          ignoreDuplicates: false,
        })
    }
  }

  /**
   * 重定向用户回到首页
   * ... (你的注释都保留) ...
   */
  return NextResponse.redirect(new URL('/', request.url))
}