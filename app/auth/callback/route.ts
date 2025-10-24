/**
 * Google OAuth Callback Handler
 * 处理Google登录后的回调
 */

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  // 处理错误情况
  if (error) {
    console.error('OAuth error:', error, error_description)
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error_description || error)}`, requestUrl.origin)
    )
  }

  // 交换授权码为会话
  if (code) {
    try {
      const supabase = createRouteHandlerClient({ cookies })
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        console.error('Session exchange error:', exchangeError)
        return NextResponse.redirect(
          new URL(`/?error=${encodeURIComponent(exchangeError.message)}`, requestUrl.origin)
        )
      }

      // 登录成功，创建用户记录（如果不存在）
      if (data.user) {
        const nowIso = new Date().toISOString()

        const { data: existingUsers, error: fetchError } = await supabase
          .from('users')
          .select('id, email')
          .eq('id', data.user.id)

        if (fetchError) {
          console.error('Failed to query existing user record:', fetchError)
        }

        const existingUser = existingUsers?.[0]

        if (!existingUser) {
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: data.user.id,
              email: data.user.email,
              credits: 3, // 新用户默认赠送的积分
              created_at: nowIso,
              updated_at: nowIso,
            })

          if (insertError) {
            if (insertError.code === '23505') {
              console.error(
                'User email already exists with a different id. Please resolve manually in the database.',
                insertError
              )
            } else {
              console.error('Failed to insert user record:', insertError)
            }
          }
        } else if (existingUser.email !== data.user.email) {
          const { error: updateError } = await supabase
            .from('users')
            .update({ email: data.user.email, updated_at: nowIso })
            .eq('id', data.user.id)

          if (updateError) {
            console.error('Failed to refresh stored email for user:', updateError)
          }
        }

        console.log('User logged in successfully:', data.user.email)
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      return NextResponse.redirect(
        new URL('/?error=Unexpected%20error%20occurred', requestUrl.origin)
      )
    }
  }

  // 重定向回首页
  return NextResponse.redirect(new URL('/', requestUrl.origin))
}
