/**
 * OCR API路由 - 使用模力方舟 PaddleOCR-VL（文档解析API）
 * 
 * 【v5.0 - 最小修改版】在原代码基础上：
 * 1. 支持PDF格式
 * 2. 错误信息英文化
 * 3. 添加更多调试日志
 * 
 * 重要：保持原有的异步API调用方式！
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
    console.log(`📡 Polling task status (${attempt + 1}/${maxAttempts})...`)
    
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Query failed: HTTP ${response.status}`)
    }

    const result = await response.json()
    const status = result.status || 'unknown'
    
    console.log(`Status: ${status}`)
    
    // 检查任务状态
    if (status === 'success') {
      console.log('✅ Task completed!')
      return result
    } else if (status === 'failed' || status === 'cancelled') {
      throw new Error(result.error?.message || result.message || 'Task failed')
    } else {
      // 任务还在处理中，等待后继续
      await new Promise(resolve => setTimeout(resolve, intervalMs))
      continue
    }
  }
  
  throw new Error('Task timeout, please try again later')
}

/**
 * POST /api/ocr
 * 处理图片和PDF文字识别请求
 */
export async function POST(request: NextRequest) {
  try {
    // ====== 第一步：获取并验证请求数据 ======
    
    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    const userId = formData.get('userId') as string | null

    if (!imageFile) {
      return NextResponse.json(
        { error: 'Please upload a file' },
        { status: 400 }
      )
    }

    // 🔥 修改1：支持PDF和图片格式
    console.log('📁 File received:', {
      name: imageFile.name,
      type: imageFile.type,
      size: imageFile.size
    })

    const supportedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/bmp',
      'image/gif',
      'application/pdf'  // ✅ 支持PDF
    ]

    if (!supportedTypes.includes(imageFile.type)) {
      console.error('❌ Unsupported file type:', imageFile.type)
      return NextResponse.json(
        { 
          error: `Unsupported file format: ${imageFile.type}. Please upload JPG, PNG, BMP, GIF, or PDF.`,
          fileType: imageFile.type
        },
        { status: 400 }
      )
    }

    // 🔥 修改2：PDF允许更大的文件（10MB）
    const maxSize = imageFile.type === 'application/pdf' 
      ? 10 * 1024 * 1024  // PDF: 10MB
      : 5 * 1024 * 1024   // 图片: 5MB

    if (imageFile.size > maxSize) {
      return NextResponse.json(
        { error: `File size exceeds ${maxSize / 1024 / 1024}MB limit` },
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
        console.error('❌ Failed to query user credits:', userError)
        return NextResponse.json(
          { error: 'User information error' },
          { status: 400 }
        )
      }

      if (userData) {
        userCredits = userData.credits
      }

      if (userCredits <= 0) {
        return NextResponse.json(
          { error: 'Insufficient credits. Please purchase more.' },
          { status: 403 }
        )
      }
    }

    // ====== 第三步：调用模力方舟文档解析服务 ======
    
    const startTime = Date.now()
    const apiToken = process.env.GITEE_AI_API_TOKEN

    if (!apiToken) {
      console.error('❌ Gitee AI API token not configured!')
      console.error('Please add to .env.local:')
      console.error('GITEE_AI_API_TOKEN=your_token')
      
      return NextResponse.json(
        { error: 'System configuration error. Please contact administrator.' },
        { status: 500 }
      )
    }

    try {
      // 步骤3.1：提交文档解析任务
      console.log('🚀 Submitting document parse task...')
      
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
        console.error('❌ Task submission failed:', errorText)
        throw new Error(`Task submission failed: HTTP ${submitResponse.status}`)
      }

      const submitData = await submitResponse.json()
      console.log('📋 Task submitted successfully:', submitData)

      // 步骤3.2：获取任务ID
      const taskId = submitData.task_id
      
      if (!taskId) {
        console.error('❌ Invalid response format:', submitData)
        throw new Error('Task ID not received')
      }

      console.log(`🎯 Task ID: ${taskId}`)

      // 步骤3.3：轮询等待任务完成
      console.log('⏳ Waiting for recognition to complete...')
      const result = await pollTaskResult(taskId, apiToken, 30, 1000)

      const processingTime = Date.now() - startTime
      console.log(`⏱️  Total processing time: ${processingTime}ms`)

      // 步骤3.4：提取识别的文字
      let extractedText = ''
      
      // 尝试多种可能的字段（模力方舟返回格式可能不同）
      console.log('🔍 Extracting text...')
      
      // 方式1：text_result字段（最常见）
      if (result.output?.text_result) {
        console.log('✅ Found text_result field')
        extractedText = result.output.text_result
      }
      // 方式2：segments字段（数组格式）
      else if (result.output?.segments && Array.isArray(result.output.segments)) {
        console.log('✅ Found segments field')
        extractedText = result.output.segments
          .map((seg: any) => seg.text || seg.content || '')
          .join('\n')
      }
      // 方式3：file_url字段（需要下载）
      else if (result.output?.file_url) {
        console.log('📥 Downloading result file:', result.output.file_url)
        const fileResponse = await fetch(result.output.file_url)
        extractedText = await fileResponse.text()
      }
      // 方式4：直接text字段
      else if (result.output?.text) {
        console.log('✅ Found text field')
        extractedText = result.output.text
      }
      // 方式5：content字段
      else if (result.output?.content) {
        console.log('✅ Found content field')
        extractedText = result.output.content
      }
      // 方式6：result.text字段
      else if (result.result?.text) {
        console.log('✅ Found result.text field')
        extractedText = result.result.text
      }
      // 方式7：直接text字段
      else if (result.text) {
        console.log('✅ Found top-level text field')
        extractedText = result.text
      }
      
      console.log(`📏 Extracted text length: ${extractedText.length}`)

      // 如果没有识别到文字
      if (!extractedText || extractedText.trim().length === 0) {
        console.error('❌ No text recognized. API response:', result)
        
        if (userId) {
          await supabase.from('ocr_results').insert({
            user_id: userId,
            success: false,
            file_size: imageFile.size,
            processing_time_ms: processingTime,
          })
        }

        return NextResponse.json(
          { error: 'No text recognized. Please ensure the image is clear and contains text.' },
          { status: 400 }
        )
      }

      console.log(`✅ Recognition successful. Text length: ${extractedText.length}`)

      // ====== 第四步：扣除积分并记录日志 ======
      
      if (userId) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ credits: userCredits - 1 })
          .eq('id', userId)

        if (updateError) {
          console.error('⚠️  Failed to deduct credits:', updateError)
        } else {
          console.log(`💎 Credits deducted. Remaining: ${userCredits - 1}`)
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
        fileType: imageFile.type,
      })

    } catch (error: any) {
      console.error('❌ Gitee AI OCR processing error:', error)
      
      if (userId) {
        await supabase.from('ocr_results').insert({
          user_id: userId,
          success: false,
          file_size: imageFile.size,
          processing_time_ms: Date.now() - startTime,
        })
      }

      let errorMessage = 'Recognition service temporarily unavailable. Please try again later.'
      if (error.message) {
        errorMessage = error.message
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('❌ OCR processing error:', error)
    return NextResponse.json(
      { error: error.message || 'Server error. Please try again.' },
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
    version: '5.0.0',
    status: 'operational',
    ocrProvider: 'Gitee AI (PaddleOCR-VL)',
    model: 'PaddleOCR-VL',
    configured: hasConfig,
    apiType: 'DocumentParse (Async)',
    apiEndpoint: '/v1/async/documents/parse',
    pricing: 'Free 100 pages/day',
    supportedFormats: ['JPG', 'PNG', 'BMP', 'GIF', 'PDF'],
    features: [
      'PaddleOCR-VL model',
      '92.56 accuracy score',
      '100+ languages',
      'Table recognition',
      'Formula recognition',
      'Handwriting recognition',
      'PDF support',
      'Free 100 pages daily',
    ],
  })
}