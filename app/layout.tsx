/**
 * Root Layout - 包含Google Analytics和SEO优化
 */

import { Inter } from 'next/font/google'
import './globals.css'
import { Metadata } from 'next'
import Script from 'next/script'

const inter = Inter({ subsets: ['latin'] })

// SEO元数据配置
export const metadata: Metadata = {
  title: 'AI Document Parser - Smart OCR for Text, Tables & Formulas | Powered by PaddleOCR',
  description: 'Advanced AI-powered document parsing tool that extracts text, tables, formulas, and handwriting from images with 98% accuracy. Supports 100+ languages. Based on PaddleOCR technology.',
  keywords: [
    'OCR',
    'document parsing',
    'text recognition',
    'table extraction',
    'formula recognition',
    'PaddleOCR',
    'AI OCR',
    'document scanner',
    'image to text',
    'handwriting recognition',
    'multilingual OCR',
    'PDF OCR',
    'document analysis',
  ],
  authors: [{ name: 'AI Document Parser' }],
  creator: 'AI Document Parser',
  publisher: 'AI Document Parser',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://yourdomain.com'), // 替换为你的实际域名
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'AI Document Parser - Smart OCR Tool',
    description: 'Extract text, tables, and formulas from images with AI-powered accuracy',
    url: 'https://yourdomain.com',
    siteName: 'AI Document Parser',
    images: [
      {
        url: '/og-image.png', // 需要添加一个1200x630的Open Graph图片
        width: 1200,
        height: 630,
        alt: 'AI Document Parser',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Document Parser - Smart OCR Tool',
    description: 'Extract text, tables, and formulas from images with AI-powered accuracy',
    images: ['/twitter-image.png'], // 需要添加一个Twitter卡片图片
    creator: '@yourusername', // 替换为你的Twitter用户名
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code', // Google Search Console验证码
    // yandex: 'your-yandex-verification-code',
    // bing: 'your-bing-verification-code',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Google Analytics - 替换为你的测量ID */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-4LPPDWDXE6"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-4LPPDWDXE6', {
              page_path: window.location.pathname,
            });
          `}
        </Script>

        {/* 结构化数据 - Schema.org */}
        <Script
          id="structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'AI Document Parser',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
              description:
                'AI-powered document parsing tool for extracting text, tables, and formulas',
              featureList: [
                'Text Recognition',
                'Table Extraction',
                'Formula Recognition',
                'Handwriting Support',
                '100+ Languages',
                '98% Accuracy',
              ],
            }),
          }}
        />

        {/* Favicon和各种图标 */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        
        {/* 预连接优化 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://www.googletagmanager.com" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
