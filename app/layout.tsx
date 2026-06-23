export const dynamic = 'force-dynamic';

import "./globals.css";
import { AuthProvider } from './AuthProvider'; // 💡 追加

export const metadata = {
  title: "HERO Assessment B2B",
  description: "組織レジリエンス分析ダッシュボード",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {/* 💡 アプリ全体を認証システムで包む */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}