import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '社媒增长中台',
  description: '支持多项目与多 SPU 的内容增长、评论执行、舆情与竞品分析平台',
  referrer: 'no-referrer',
  metadataBase: new URL(process.env.SITE_ORIGIN || 'http://localhost:5173'),
  openGraph: {
    title: '社媒增长中台',
    description: '多项目管理 · 数据接入 · 评论审查 · 增长复盘',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: '社媒增长中台',
    description: '多项目管理 · 数据接入 · 评论审查 · 增长复盘',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><head><meta name="referrer" content="no-referrer" /><script defer src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js" /></head><body>{children}</body></html>;
}
