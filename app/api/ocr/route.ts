/**
 * OCR API路由 - 使用模力方舟 PaddleOCR-VL（文档解析API）
 * 
 * 【v4.0终极版】使用正确的文档解析端点
 * 
 * 重要发现：
 * - PaddleOCR-VL在"文档解析"API下，不在"图像OCR"API下
 * - 端点：/v1/async/documents/parse（不是/v1/async/images/ocr）
 * - 每天免费100页
 * 
 * API文档：https://ai.gitee.com/docs
 * 端点：POST /v1/async/documents/parse
 * 查询：GET /v1/task/{task_id}
 * 格式：multipart/form-data
 * 
 * 环境变量配置：
 * - GITEE_AI_API_TOKEN: 模力方舟访问令牌
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

/**
 * 轮询查询任务结果
 * @param taskId 任务ID
 * @param apiToken API令牌
 * @param maxAttempts 最大尝试次数
 * @param intervalMs 轮询间隔（毫秒）
 */
async function pollTaskResult(
  taskId: string,
  apiToken: string,
  maxAttempts: number = 30,
  intervalMs: number = 1000
): Promise<any> {
  // 使用正确的查询URL格式
  const statusUrl = `https://ai.gitee.com/v1/task/${taskId}`
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    console.log(`📡 轮询任务状态 (${attempt + 1}/${maxAttempts})...`)
    
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`查询任务失败: HTTP ${response.status}`)
    }

    const result = await response.json()
    const status = result.status || 'unknown'
    
    console.log(`状态: ${status}`)
    
    // 检查任务状态
    if (status === 'success') {
      console.log('✅ 任务完成！')
      return result
    } else if (status === 'failed' || status === 'cancelled') {
      throw new Error(result.error?.message || result.message || '任务失败')
    } else {
      // 任务还在处理中，等待后继续
      await new Promise(resolve => setTimeout(resolve, intervalMs))
      continue
    }
  }
  
  throw new Error('任务超时，请稍后重试')
}

/**
 * POST /api/ocr
 * 处理图片文字识别请求
 */
export async function POST(request: NextRequest) {
  try {
    // ====== 第一步：获取并验证请求数据 ======
    
    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    const userId = formData.get('userId') as string | null

    if (!imageFile) {
      return NextResponse.json(
        { error: '请上传图片文件' },
        { status: 400 }
      )
    }

    if (!imageFile.type.startsWith('image/')) {
      return NextResponse.json(
        { error: '只支持图片格式（JPG、PNG、GIF等）' },
        { status: 400 }
      )
    }

    const maxSize = 5 * 1024 * 1024
    if (imageFile.size > maxSize) {
      return NextResponse.json(
        { error: '图片大小不能超过5MB' },
        { status: 400 }
      )
    }

    // ====== 第二步：检查用户积分 ======
    
    const supabase = createClient()
    let userCredits = 3

    if (userId) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('credits')
        .eq('id', userId)
        .single()

      if (userError) {
        console.error('查询用户积分失败:', userError)
        return NextResponse.json(
          { error: '用户信息错误' },
          { status: 400 }
        )
      }

      if (userData) {
        userCredits = userData.credits
      }

      if (userCredits <= 0) {
        return NextResponse.json(
          { error: '积分不足，请购买更多积分' },
          { status: 403 }
        )
      }
    }

    // ====== 第三步：调用模力方舟文档解析服务 ======
    
    const startTime = Date.now()
    const apiToken = process.env.GITEE_AI_API_TOKEN

    if (!apiToken) {
      console.error('❌ 模力方舟API令牌配置缺失！')
      console.error('请在.env.local文件中添加：')
      console.error('GITEE_AI_API_TOKEN=你的访问令牌')
      
      return NextResponse.json(
        { error: '系统配置错误，请联系管理员' },
        { status: 500 }
      )
    }

    try {
      // 步骤3.1：提交文档解析任务
      console.log('🚀 正在提交文档解析任务...')
      
      // 使用正确的文档解析API端点
      const submitUrl = 'https://ai.gitee.com/v1/async/documents/parse'
      
      // 构建multipart/form-data请求
      const apiFormData = new FormData()
      apiFormData.append('model', 'PaddleOCR-VL')  // 指定PaddleOCR-VL模型
      apiFormData.append('file', imageFile)  // 文件字段名是"file"
      apiFormData.append('include_image', 'true')  // 包含图片
      apiFormData.append('include_image_base64', 'true')  // Base64格式
      apiFormData.append('output_format', 'md')  // 输出Markdown格式

      const submitResponse = await fetch(submitUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          // 不设置Content-Type，让浏览器自动设置
        },
        body: apiFormData,
      })

      if (!submitResponse.ok) {
        const errorText = await submitResponse.text()
        console.error('❌ 提交任务失败:', errorText)
        throw new Error(`提交任务失败: HTTP ${submitResponse.status}`)
      }

      const submitData = await submitResponse.json()
      console.log('📋 任务提交成功:', submitData)

      // 步骤3.2：获取任务ID
      const taskId = submitData.task_id
      
      if (!taskId) {
        console.error('❌ 响应格式错误:', submitData)
        throw new Error('未获取到任务ID')
      }

      console.log(`🎯 任务ID: ${taskId}`)

      // 步骤3.3：轮询等待任务完成
      console.log('⏳ 等待识别完成...')
      const result = await pollTaskResult(taskId, apiToken, 30, 1000)

      const processingTime = Date.now() - startTime
      console.log(`⏱️  总处理耗时: ${processingTime}ms`)

      // 步骤3.4：提取识别的文字
      let extractedText = ''
      
      // 尝试多种可能的字段（模力方舟返回格式可能不同）
      console.log('🔍 开始提取文字...')
      
      // 方式1：text_result字段（最常见）
      if (result.output?.text_result) {
        console.log('✅ 找到text_result字段')
        extractedText = result.output.text_result
      }
      // 方式2：segments字段（数组格式）
      else if (result.output?.segments && Array.isArray(result.output.segments)) {
        console.log('✅ 找到segments字段')
        extractedText = result.output.segments
          .map((seg: any) => seg.text || seg.content || '')
          .join('\n')
      }
      // 方式3：file_url字段（需要下载）
      else if (result.output?.file_url) {
        console.log('📥 下载结果文件:', result.output.file_url)
        const fileResponse = await fetch(result.output.file_url)
        extractedText = await fileResponse.text()
      }
      // 方式4：直接text字段
      else if (result.output?.text) {
        console.log('✅ 找到text字段')
        extractedText = result.output.text
      }
      // 方式5：content字段
      else if (result.output?.content) {
        console.log('✅ 找到content字段')
        extractedText = result.output.content
      }
      // 方式6：result.text字段
      else if (result.result?.text) {
        console.log('✅ 找到result.text字段')
        extractedText = result.result.text
      }
      // 方式7：直接text字段
      else if (result.text) {
        console.log('✅ 找到顶层text字段')
        extractedText = result.text
      }
      
      console.log(`📏 提取的文字长度: ${extractedText.length}`)

      // 如果没有识别到文字
      if (!extractedText || extractedText.trim().length === 0) {
        console.error('❌ 未识别到文字，API响应:', result)
        
        if (userId) {
          await supabase.from('ocr_results').insert({
            user_id: userId,
            success: false,
            file_size: imageFile.size,
            processing_time_ms: processingTime,
          })
        }

        return NextResponse.json(
          { error: '未能识别到文字，请确保图片清晰且包含文字内容' },
          { status: 400 }
        )
      }

      console.log(`✅ 识别成功，文字长度: ${extractedText.length}`)

      // ====== 第四步：扣除积分并记录日志 ======
      
      if (userId) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ credits: userCredits - 1 })
          .eq('id', userId)

        if (updateError) {
          console.error('⚠️  扣除积分失败:', updateError)
        } else {
          console.log(`💎 积分扣除成功，剩余: ${userCredits - 1}`)
        }

        await supabase.from('ocr_results').insert({
          user_id: userId,
          success: true,
          text_length: extractedText.length,
          file_size: imageFile.size,
          processing_time_ms: processingTime,
        })

        userCredits -= 1
      }

      // ====== 第五步：返回识别结果 ======
      
      return NextResponse.json({
        success: true,
        text: extractedText,
        remainingCredits: userCredits,
        processingTime: processingTime,
        fileSize: imageFile.size,
        model: 'PaddleOCR-VL',
        apiType: 'DocumentParse',
      })

    } catch (error: any) {
      console.error('❌ 模力方舟OCR处理错误:', error)
      
      if (userId) {
        await supabase.from('ocr_results').insert({
          user_id: userId,
          success: false,
          file_size: imageFile.size,
          processing_time_ms: Date.now() - startTime,
        })
      }

      let errorMessage = '识别服务暂时不可用，请稍后重试'
      if (error.message) {
        errorMessage = error.message
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('❌ OCR处理错误:', error)
    return NextResponse.json(
      { error: error.message || '服务器错误，请重试' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ocr
 * 健康检查接口
 */
export async function GET() {
  const hasConfig = !!process.env.GITEE_AI_API_TOKEN
  
  return NextResponse.json({
    service: 'AI Document Parser API',
    version: '4.0.0',
    status: 'operational',
    ocrProvider: 'Gitee AI (PaddleOCR-VL)',
    model: 'PaddleOCR-VL',
    configured: hasConfig,
    apiType: 'DocumentParse',
    apiEndpoint: '/v1/async/documents/parse',
    pricing: 'Free 100 pages/day',
    features: [
      'PaddleOCR-VL model',
      '92.56 accuracy score',
      '100+ languages',
      'Table recognition',
      'Formula recognition',
      'Handwriting recognition',
      'Free 100 pages daily',
    ],
  })
}