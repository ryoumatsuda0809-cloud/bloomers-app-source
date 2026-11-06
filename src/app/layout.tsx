import type { Metadata } from 'next'
import { Source_Serif_4, Noto_Serif_JP, DM_Sans } from 'next/font/google'
import './globals.css'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SidebarProvider } from '@/components/providers/SidebarProvider'

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: ['400', '600'],
  display: 'swap',
})

const notoSerifJP = Noto_Serif_JP({
  subsets: ['latin'],
  variable: '--font-serif-jp',
  weight: ['400', '600'],
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Bloomers Quest Dashboard',
  description: 'Your development roadmap',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Bloomers',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className={`${sourceSerif.variable} ${notoSerifJP.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
          try {
            var saved = localStorage.getItem('bloomer_theme');
            var isDark;
            if (saved === 'dark') isDark = true;
            else if (saved === 'light') isDark = false;
            else isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (isDark) document.documentElement.classList.add('dark');
            else document.documentElement.classList.remove('dark');
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
              if (localStorage.getItem('bloomer_theme')) return;
              if (e.matches) document.documentElement.classList.add('dark');
              else document.documentElement.classList.remove('dark');
            });
          } catch(e) {}
        })();`,
          }}
        />
        <meta name="theme-color" content="#6b2040" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="font-sans antialiased">
        <TooltipProvider>
          <SidebarProvider>
            {children}
          </SidebarProvider>
        </TooltipProvider>
      </body>
    </html>
  )
}
