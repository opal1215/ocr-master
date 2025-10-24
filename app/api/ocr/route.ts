import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

const RATE_LIMIT_MAX_ATTEMPTS = 5
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const SUPPORTED_FILE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/bmp',
  'image/gif',
  'application/pdf',
]
const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024
const MAX_PDF_FILE_SIZE_BYTES = 10 * 1024 * 1024

type RecordAttemptOptions = {
  success: boolean
  textLength?: number
  fileSize: number
  processingTimeMs: number
  languageDetected?: string | null
}

async function pollTaskResult(
  taskId: string,
  apiToken: string,
  maxAttempts = 30,
  intervalMs = 1000
): Promise<any> {
  const statusUrl = `https://ai.gitee.com/v1/task/${taskId}`

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Query failed: HTTP ${response.status}`)
    }

    const result = await response.json()
    const status = String(result.status ?? result.state ?? '').toLowerCase()

    if (status === 'success' || status === 'succeeded' || status === 'finished') {
      return result
    }

    if (status === 'failed' || status === 'error' || status === 'cancelled') {
      throw new Error(result.error?.message || result.message || 'Task failed')
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error('Task timeout, please try again later')
}

function extractTextFromResult(result: any): { text: string; language: string | null } {
  if (!result || typeof result !== 'object') {
    return { text: '', language: null }
  }

  const collected = new Set<string>()
  const languages: string[] = []

  const push = (value: unknown) => {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed.length > 0) {
        collected.add(trimmed)
      }
    }
  }

  const captureLanguage = (value: unknown) => {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed.length > 0) {
        languages.push(trimmed)
      }
    }
  }

  const baseLanguage =
    result.language ??
    result.data?.language ??
    result.result?.language ??
    result.metadata?.language ??
    null

  if (baseLanguage) {
    captureLanguage(baseLanguage)
  }

  const collectFromPage = (page: any) => {
    if (!page) {
      return
    }
    push(page.markdown)
    push(page.text)
    if (typeof page.language === 'string') {
      captureLanguage(page.language)
    }
    if (Array.isArray(page.blocks)) {
      page.blocks.forEach((block: any) => {
        push(block?.markdown)
        push(block?.text)
      })
    }
    if (Array.isArray(page.cells)) {
      page.cells.forEach((cell: any) => {
        push(cell?.markdown)
        push(cell?.text)
      })
    }
  }

  const pageCollections = [
    result.data?.pages,
    result.result?.pages,
    result.data?.chunks,
    result.data?.structured_result,
    result.structured_result,
  ]

  pageCollections.forEach((collection: any) => {
    if (Array.isArray(collection)) {
      collection.forEach(collectFromPage)
    }
  })

  const contentCollections = [
    result.data?.content,
    result.result?.content,
    result.content,
  ]

  contentCollections.forEach((collection: any) => {
    if (Array.isArray(collection)) {
      collection.forEach((item: any) => {
        push(item?.markdown)
        push(item?.text)
        push(item?.value)
        if (typeof item?.language === 'string') {
          captureLanguage(item.language)
        }
      })
    }
  })

  if (collected.size === 0) {
    const visited = new Set<any>()
    const skipKeys = new Set(['image', 'image_base64', 'thumbnail', 'file', 'preview'])
    const isBase64Like = (value: string) =>
      value.length > 128 && /^[A-Za-z0-9+/=\r\n]+$/.test(value.replace(/\s+/g, ''))

    const traverse = (value: any, key?: string) => {
      if (value === null || value === undefined) {
        return
      }
      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (
          trimmed.length > 0 &&
          trimmed.length < 20000 &&
          !isBase64Like(trimmed) &&
          !skipKeys.has((key || '').toLowerCase())
        ) {
          collected.add(trimmed)
        }
        return
      }

      if (typeof value !== 'object' || visited.has(value)) {
        return
      }

      visited.add(value)

      if (Array.isArray(value)) {
        value.forEach(item => traverse(item))
      } else {
        Object.entries(value).forEach(([childKey, childValue]) =>
          traverse(childValue, childKey)
        )
      }
    }

    traverse(result)
  }

  push(result.data?.markdown)
  push(result.data?.text)
  push(result.result?.markdown)
  push(result.result?.text)
  push(result.markdown)
  push(result.text)
  push(result.output)

  const text = Array.from(collected)
    .filter(entry => entry.length > 12 || /\s/.test(entry))
    .join('\n\n')
  const language = languages.find(Boolean) ?? baseLanguage ?? null

  return { text, language }
}

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error('Failed to validate session:', authError)
    return NextResponse.json({ error: 'Authentication error' }, { status: 401 })
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const imageField = formData.get('image')

  if (!(imageField instanceof File)) {
    return NextResponse.json({ error: 'Please upload a file' }, { status: 400 })
  }

  const imageFile = imageField
  const fileType = imageFile.type || 'application/octet-stream'

  if (!SUPPORTED_FILE_TYPES.includes(fileType)) {
    return NextResponse.json(
      {
        error: `Unsupported file format: ${fileType}. Please upload JPG, PNG, BMP, GIF, or PDF.`,
        fileType,
      },
      { status: 400 }
    )
  }

  const maxSize =
    fileType === 'application/pdf'
      ? MAX_PDF_FILE_SIZE_BYTES
      : MAX_IMAGE_FILE_SIZE_BYTES

  if (imageFile.size > maxSize) {
    return NextResponse.json(
      { error: `File size exceeds ${maxSize / 1024 / 1024}MB limit` },
      { status: 400 }
    )
  }

  const { data: userProfile, error: userProfileError } = await supabase
    .from('users')
    .select('credits')
    .eq('id', user.id)
    .single()

  if (userProfileError) {
    console.error('Failed to load user profile:', userProfileError)
    return NextResponse.json({ error: 'User profile not found' }, { status: 400 })
  }

  if (!userProfile) {
    console.error('User profile missing:', user.id)
    return NextResponse.json({ error: 'User profile not found' }, { status: 400 })
  }

  let userCredits = userProfile.credits ?? 0

  if (userCredits <= 0) {
    return NextResponse.json(
      { error: 'Insufficient credits. Please purchase more.' },
      { status: 403 }
    )
  }

  const rateLimitWindowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_MS
  ).toISOString()

  const { count: recentCount, error: rateLimitError } = await supabase
    .from('ocr_results')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', rateLimitWindowStart)

  if (rateLimitError) {
    console.error('Rate limit check failed:', rateLimitError)
    return NextResponse.json(
      { error: 'Rate limit check failed. Please try again later.' },
      { status: 503 }
    )
  }

  if ((recentCount ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429 }
    )
  }

  const apiToken = process.env.GITEE_AI_API_TOKEN

  if (!apiToken) {
    console.error('Gitee AI API token not configured')
    return NextResponse.json(
      { error: 'System configuration error. Please contact administrator.' },
      { status: 500 }
    )
  }

  const startTime = Date.now()

  const recordAttempt = async (
    options: RecordAttemptOptions
  ): Promise<{ remainingCredits: number | null; error: Error | null }> => {
    try {
      const { data, error } = await supabase.rpc('record_ocr_attempt', {
        p_success: options.success,
        p_text_length: options.textLength ?? 0,
        p_file_size: options.fileSize,
        p_processing_time_ms: options.processingTimeMs,
        p_language_detected: options.languageDetected ?? null,
      })

      if (error) {
        return { remainingCredits: null, error }
      }

      const payload = Array.isArray(data) ? data[0] : data
      const remainingCredits =
        payload && typeof payload.remaining_credits === 'number'
          ? payload.remaining_credits
          : null

      return { remainingCredits, error: null }
    } catch (err) {
      return { remainingCredits: null, error: err as Error }
    }
  }

  try {
    const apiFormData = new FormData()
    apiFormData.append('model', 'PaddleOCR-VL')
    apiFormData.append('file', imageFile)
    apiFormData.append('include_image', 'true')
    apiFormData.append('include_image_base64', 'true')
    apiFormData.append('output_format', 'md')

    const submitResponse = await fetch('https://ai.gitee.com/v1/async/documents/parse', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      body: apiFormData,
    })

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text()
      console.error('Task submission failed:', errorText)
      throw new Error(`Task submission failed: HTTP ${submitResponse.status}`)
    }

    const submitData = await submitResponse.json()
    const taskId = submitData.task_id ?? submitData.id

    if (!taskId) {
      console.error('Invalid response format:', submitData)
      throw new Error('Task ID not received')
    }

    const result = await pollTaskResult(taskId, apiToken)
    const processingTime = Date.now() - startTime

    const { text: extractedText, language } = extractTextFromResult(result)

    if (!extractedText || extractedText.trim().length === 0) {
      await recordAttempt({
        success: false,
        textLength: 0,
        fileSize: imageFile.size,
        processingTimeMs: processingTime,
        languageDetected: language,
      })

      return NextResponse.json(
        {
          error: 'No text recognized. Please ensure the image is clear and contains text.',
        },
        { status: 400 }
      )
    }

    const recordResult = await recordAttempt({
      success: true,
      textLength: extractedText.length,
      fileSize: imageFile.size,
      processingTimeMs: processingTime,
      languageDetected: language,
    })

    if (recordResult.error) {
      const message = recordResult.error.message ?? ''
      if (message.includes('INSUFFICIENT_CREDITS')) {
        return NextResponse.json(
          { error: 'Insufficient credits. Please purchase more.' },
          { status: 403 }
        )
      }

      console.error('Failed to record OCR attempt:', recordResult.error)
    }

    if (typeof recordResult.remainingCredits === 'number') {
      userCredits = recordResult.remainingCredits
    } else {
      userCredits = Math.max(0, userCredits - 1)
    }

    return NextResponse.json({
      success: true,
      text: extractedText,
      remainingCredits: userCredits,
      processingTime,
      fileSize: imageFile.size,
      fileType,
      language: language ?? undefined,
      model: 'PaddleOCR-VL',
      apiType: 'DocumentParse',
      taskId,
    })
  } catch (error) {
    const processingTime = Date.now() - startTime

    try {
      await recordAttempt({
        success: false,
        textLength: 0,
        fileSize: imageFile.size,
        processingTimeMs: processingTime,
        languageDetected: null,
      })
    } catch (logError) {
      console.error('Failed to record failed OCR attempt:', logError)
    }

    let message = 'Recognition service temporarily unavailable. Please try again later.'
    let status = 500

    if (error instanceof Error) {
      message = error.message || message
      if (message.toLowerCase().includes('timeout')) {
        status = 504
      }
    }

    console.error('OCR processing error:', error)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function GET() {
  const hasConfig = Boolean(process.env.GITEE_AI_API_TOKEN)

  return NextResponse.json({
    service: 'AI Document Parser API',
    version: '5.0.0',
    status: hasConfig ? 'operational' : 'missing_config',
    ocrProvider: 'Gitee AI (PaddleOCR-VL)',
    model: 'PaddleOCR-VL',
    configured: hasConfig,
    apiType: 'DocumentParse (Async)',
    apiEndpoint: '/v1/async/documents/parse',
    rateLimit: {
      maxAttempts: RATE_LIMIT_MAX_ATTEMPTS,
      windowMs: RATE_LIMIT_WINDOW_MS,
    },
    supportedFormats: ['JPG', 'PNG', 'BMP', 'GIF', 'PDF'],
  })
}
