/**
 * Supabase客户端配置 (客户端专用)
 * * 这个文件创建了用于客户端组件（浏览器中运行的React组件）的Supabase连接。
 * 它不包含任何服务器端的代码（比如 'next/headers'）。
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

/**
 * 获取浏览器端的Supabase客户端
 * 用于客户端组件中的数据操作和用户认证
 */
export const createClient = () => createClientComponentClient()