/**
 * Supabase客户端配置 (服务器专用)
 * * 这个文件创建了用于服务器组件（在服务器上运行）的Supabase连接。
 * 它导入了 'next/headers'，因此这个文件绝对不能被任何客户端组件导入。
 */

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * 获取服务器端的Supabase客户端
 * 用于服务器组件和API路由中的数据操作
 * 需要传入cookies来维持用户会话
 */
export const createServerClient = () => createServerComponentClient({ cookies })