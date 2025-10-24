/**
 * Home Page - AI Document Parser
 * 修复版：正确支持PDF + Google登录配置指南
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { 
  Upload, Copy, CheckCircle, XCircle, Loader2, Sparkles, 
  FileText, Calculator, Table, Languages, Zap, Download, FileDown,
  AlertCircle
} from 'lucide-react'

type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error'
type DownloadFormat = 'txt' | 'html' | 'md'

// Google Analytics事件追踪函数
const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, params)
  }
}

export default function HomePage() {
  const router = useRouter()
  
  const [user, setUser] = useState<any>(null)
  const [credits, setCredits] = useState<number>(3)
  const [status, setStatus] = useState<ProcessingStatus>('idle')
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    checkUser()
    trackEvent('page_view', {
      page_title: 'Home',
      page_location: window.location.href,
    })
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      setUser(user)
      const { data: userData } = await supabase
        .from('users')
        .select('credits')
        .eq('email', user.email)
        .single()
      
      if (userData) {
        setCredits(userData.credits)
      }
    }
  }

  const handleGoogleLogin = async () => {
    trackEvent('login_attempt', { method: 'google' })
    
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      
      if (error) {
        console.error('Login error:', error)
        setError(`Login failed: ${error.message}. Please check Supabase Google OAuth configuration.`)
        trackEvent('login_error', { error: error.message })
      }
    } catch (err: any) {
      console.error('Login exception:', err)
      setError('Login failed. Please ensure Google OAuth is configured in Supabase.')
      trackEvent('login_error', { error: err.message })
    }
  }

  const handleFileSelect = (file: File) => {
    console.log('Selected file:', {
      name: file.name,
      type: file.type,
      size: file.size,
    })

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be under 5MB')
      trackEvent('file_error', { reason: 'size_exceeded', size: file.size })
      return
    }

    // 支持的文件类型 - 重要：PDF的MIME类型是 application/pdf
    const supportedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/bmp',
      'application/pdf'  // PDF支持
    ]
    
    if (!supportedTypes.includes(file.type)) {
      console.error('Unsupported file type:', file.type)
      setError(`Unsupported file format. Please upload JPG, PNG, BMP, or PDF. (Your file type: ${file.type})`)
      trackEvent('file_error', { reason: 'invalid_type', type: file.type })
      return
    }

    setSelectedFile(file)
    
    // 如果是图片，显示预览
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    } else {
      setPreviewUrl('') // PDF不预览
    }
    
    setError('')
    
    trackEvent('file_selected', { 
      file_type: file.type, 
      file_size: file.size 
    })
  }

  const handleOCR = async () => {
    if (!selectedFile) {
      setError('Please select a file first')
      return
    }

    if (credits <= 0) {
      setError('Insufficient credits. Please purchase more.')
      return
    }

    setStatus('uploading')
    setError('')
    
    trackEvent('ocr_start', {
      file_type: selectedFile.type,
      file_size: selectedFile.size,
    })

    try {
      const formData = new FormData()
      formData.append('image', selectedFile)
      console.log('Uploading file:', selectedFile.name, selectedFile.type)

      setStatus('processing')
      const startTime = Date.now()
      
      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      console.log('OCR Response:', data)

      if (!response.ok) {
        let errorMessage = data.error || 'Recognition failed'

        if (response.status === 401) {
          errorMessage = 'Please sign in to use OCR.'
          setUser(null)
        } else if (response.status === 429) {
          errorMessage = 'Too many requests. Please try again in a moment.'
        } else if (response.status === 403) {
          errorMessage = data.error || 'Insufficient credits. Please purchase more.'
        }

        throw new Error(errorMessage)
      }

      const processingTime = Date.now() - startTime

      setResult(data.text)
      setStatus('success')
      
      if (data.remainingCredits !== undefined) {
        setCredits(data.remainingCredits)
      }

      trackEvent('ocr_success', {
        processing_time: processingTime,
        text_length: data.text.length,
        file_size: selectedFile.size,
      })

    } catch (err: any) {
      console.error('OCR Error:', err)
      setStatus('error')
      setError(err.message || 'Recognition failed, please try again')
      
      trackEvent('ocr_error', {
        error: err.message,
        file_type: selectedFile.type,
      })
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result)
      alert('Copied to clipboard!')
      trackEvent('copy_result', { text_length: result.length })
    } catch (err) {
      alert('Copy failed, please copy manually')
    }
  }

  const handleDownload = (format: DownloadFormat) => {
    let content = result
    let filename = 'ocr-result'
    let mimeType = 'text/plain'

    switch (format) {
      case 'txt':
        // Remove HTML tags for plain text
        content = result.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
        filename = 'ocr-result.txt'
        mimeType = 'text/plain'
        break
      
      case 'html':
        // Wrap in proper HTML structure
        content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OCR Result</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 1200px; margin: 0 auto; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    table td, table th { border: 1px solid #ddd; padding: 8px; text-align: center; }
    table th { background-color: #f2f2f2; font-weight: bold; }
    table tr:hover { background-color: #f5f5f5; }
  </style>
</head>
<body>
  ${result}
</body>
</html>`
        filename = 'ocr-result.html'
        mimeType = 'text/html'
        break
      
      case 'md':
        // Convert HTML table to Markdown (basic conversion)
        content = result
          .replace(/<table[^>]*>/gi, '\n')
          .replace(/<\/table>/gi, '\n')
          .replace(/<tr[^>]*>/gi, '\n| ')
          .replace(/<\/tr>/gi, ' |')
          .replace(/<td[^>]*>/gi, '')
          .replace(/<\/td>/gi, ' | ')
          .replace(/<th[^>]*>/gi, '**')
          .replace(/<\/th>/gi, '** | ')
          .replace(/<[^>]*>/g, '')
        filename = 'ocr-result.md'
        mimeType = 'text/markdown'
        break
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    
    setShowDownloadMenu(false)
    
    trackEvent('download_result', {
      format,
      text_length: content.length,
    })
  }

  const handleReset = () => {
    setSelectedFile(null)
    setPreviewUrl('')
    setResult('')
    setStatus('idle')
    setError('')
    trackEvent('reset')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">
              AI Document Parser
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <div className="flex items-center space-x-2 bg-blue-50 px-4 py-2 rounded-full">
                  <span className="text-sm text-gray-600">Credits:</span>
                  <span className="font-bold text-blue-600">{credits}</span>
                </div>
                <button
                  onClick={() => {
                    supabase.auth.signOut()
                    setUser(null)
                    trackEvent('logout')
                  }}
                  className="text-sm text-gray-600 hover:text-gray-900 transition"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={handleGoogleLogin}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition shadow-sm"
              >
                Sign in with Google
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            AI-Powered Document Parser
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Extract text, tables, formulas, and handwriting from images with 98% accuracy.
            <br />
            <span className="text-blue-600 font-medium">Supports 100+ languages</span> • Based on PaddleOCR Technology
          </p>
        </div>

        {/* Upload Area */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-12">
          {status === 'idle' ? (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                e.currentTarget.classList.add('border-blue-500', 'bg-blue-50')
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50')
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50')
                const file = e.dataTransfer.files[0]
                if (file) handleFileSelect(file)
              }}
              className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-blue-400 transition cursor-pointer"
              onClick={() => document.getElementById('fileInput')?.click()}
            >
              <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Click to upload or drag and drop
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                <span className="font-medium text-blue-600">Supports: JPG, PNG, JPEG, BMP, PDF</span>
                <br />
                Max file size: 5MB
              </p>
              {selectedFile && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg inline-block">
                  <p className="text-sm font-medium text-blue-900">
                    ✅ {selectedFile.name}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Type: {selectedFile.type} • Size: {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              )}
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg inline-block max-w-2xl">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-600 text-left">{error}</p>
                  </div>
                </div>
              )}
              <input
                id="fileInput"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/bmp,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileSelect(file)
                }}
              />
            </div>
          ) : null}

          {selectedFile && status === 'idle' && (
            <div className="mt-6 flex justify-center space-x-4">
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleOCR}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-md flex items-center space-x-2"
              >
                <Sparkles className="w-5 h-5" />
                <span>Start Recognition</span>
              </button>
            </div>
          )}

          {status === 'processing' && (
            <div className="text-center py-16">
              <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-6"></div>
              <p className="text-lg font-medium text-gray-900 mb-2">
                AI is analyzing your document...
              </p>
              <p className="text-sm text-gray-500">
                Usually takes 3-5 seconds
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-6">
              <div className="flex items-center justify-center text-green-600 mb-4">
                <CheckCircle className="w-8 h-8 mr-2" />
                <span className="text-xl font-semibold">Recognition Complete!</span>
              </div>

              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-900 text-lg">Result</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleCopy}
                      className="flex items-center space-x-1.5 text-blue-600 hover:text-blue-700 transition text-sm font-medium px-3 py-2 rounded-lg hover:bg-blue-50"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </button>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-6 border border-gray-200 max-h-[500px] overflow-y-auto">
                  {/* Render HTML table */}
                  <div 
                    className="prose prose-sm max-w-none text-gray-800"
                    dangerouslySetInnerHTML={{ __html: result }}
                  />
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleReset}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition"
                >
                  Process Another File
                </button>
                
                <div className="relative flex-1">
                  <button
                    onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition shadow-sm flex items-center justify-center space-x-2"
                  >
                    <Download className="w-5 h-5" />
                    <span>Download</span>
                  </button>
                  
                  {showDownloadMenu && (
                    <div className="absolute bottom-full mb-2 left-0 right-0 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-10">
                      <button
                        onClick={() => handleDownload('txt')}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 transition flex items-center space-x-2"
                      >
                        <FileText className="w-4 h-4 text-gray-600" />
                        <span>Plain Text (.txt)</span>
                      </button>
                      <button
                        onClick={() => handleDownload('html')}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 transition flex items-center space-x-2"
                      >
                        <FileDown className="w-4 h-4 text-gray-600" />
                        <span>HTML with Table (.html)</span>
                      </button>
                      <button
                        onClick={() => handleDownload('md')}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 transition flex items-center space-x-2"
                      >
                        <FileDown className="w-4 h-4 text-gray-600" />
                        <span>Markdown (.md)</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
              <p className="text-lg font-medium text-red-600 mb-4">
                {error || 'Recognition failed'}
              </p>
              <button
                onClick={handleReset}
                className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Features Section */}
        <div className="mb-12">
          <h3 className="text-3xl font-bold text-gray-900 text-center mb-8">
            Why Choose AI Document Parser?
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition">
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-blue-600" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2 text-lg">Smart Document Understanding</h4>
              <p className="text-sm text-gray-600 mb-3">
                Not just text recognition - understands document structure, tables, formulas, and complex elements
              </p>
              <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                <span className="text-red-500 line-through">Traditional OCR:</span> Plain text only
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition">
              <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center mb-4">
                <Languages className="w-6 h-6 text-orange-600" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2 text-lg">100+ Languages Support</h4>
              <p className="text-sm text-gray-600 mb-3">
                English, Chinese, Japanese, Korean, Arabic... Global languages recognized instantly
              </p>
              <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                <span className="text-red-500 line-through">Traditional OCR:</span> Single language or switching required
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition">
              <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2 text-lg">98% Ultra-High Accuracy</h4>
              <p className="text-sm text-gray-600 mb-3">
                Based on latest PaddleOCR AI technology, far exceeds traditional OCR accuracy
              </p>
              <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                <span className="text-red-500 line-through">Traditional OCR:</span> 70-80% accuracy
              </div>
            </div>
          </div>
        </div>

        {/* Use Cases */}
        <div className="mb-12">
          <h3 className="text-3xl font-bold text-gray-900 text-center mb-8">
            Use Cases
          </h3>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 text-center">
              <FileText className="w-8 h-8 text-cyan-600 mx-auto mb-3" />
              <h5 className="font-semibold text-gray-900 mb-1">Academic Papers</h5>
              <p className="text-xs text-gray-600">Preserves formatting and formulas</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 text-center">
              <svg className="w-8 h-8 text-purple-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <h5 className="font-semibold text-gray-900 mb-1">Handwritten Notes</h5>
              <p className="text-xs text-gray-600">Even messy writing recognized</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl p-6 text-center">
              <Table className="w-8 h-8 text-orange-600 mx-auto mb-3" />
              <h5 className="font-semibold text-gray-900 mb-1">Table Extraction</h5>
              <p className="text-xs text-gray-600">Auto-structured data</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 text-center">
              <Calculator className="w-8 h-8 text-green-600 mx-auto mb-3" />
              <h5 className="font-semibold text-gray-900 mb-1">Formula Recognition</h5>
              <p className="text-xs text-gray-600">Math formulas accurately converted</p>
            </div>
          </div>
        </div>

        {/* How to Use */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl p-8 mb-12">
          <h3 className="text-3xl font-bold text-gray-900 text-center mb-8">
            How to Use
          </h3>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-3">1</div>
              <h5 className="font-semibold text-gray-900 mb-1">Upload Image</h5>
              <p className="text-sm text-gray-600">Supports JPG, PNG, BMP, PDF</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-3">2</div>
              <h5 className="font-semibold text-gray-900 mb-1">AI Analysis</h5>
              <p className="text-sm text-gray-600">Smart document structure recognition</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-3">3</div>
              <h5 className="font-semibold text-gray-900 mb-1">Get Results</h5>
              <p className="text-sm text-gray-600">Recognition complete in 3 seconds</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-3">4</div>
              <h5 className="font-semibold text-gray-900 mb-1">Export & Use</h5>
              <p className="text-sm text-gray-600">Copy or download as TXT/HTML/MD</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-center md:text-left">
              <div className="flex items-center space-x-2 justify-center md:justify-start mb-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-gray-900">AI Document Parser</span>
              </div>
              <p className="text-sm text-gray-600">
                Powered by PaddleOCR AI Technology · Making Document Processing Smarter
              </p>
            </div>
            <div className="flex items-center space-x-6 text-sm text-gray-600">
              <a href="/privacy" className="hover:text-blue-600 transition">Privacy Policy</a>
              <a href="/terms" className="hover:text-blue-600 transition">Terms of Service</a>
              <a href="/about" className="hover:text-blue-600 transition">About Us</a>
            </div>
          </div>
          <div className="text-center mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              © 2025 AI Document Parser. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Table Styles */}
      <style jsx global>{`
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.5rem 0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        table td, table th {
          border: 1px solid #e5e7eb;
          padding: 12px;
          text-align: center;
        }
        
        table th {
          background-color: #f9fafb;
          font-weight: 600;
          color: #374151;
        }
        
        table tr:hover {
          background-color: #f3f4f6;
        }
        
        table tr:nth-child(even) {
          background-color: #fafafa;
        }
      `}</style>
    </div>
  )
}
