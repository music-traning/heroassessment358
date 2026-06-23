'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/utils/supabase';
import { Card, Title, TextInput, Button, Text } from '@tremor/react';
import { useRouter } from 'next/navigation';

function SettingsContent() {
  const router = useRouter();
  const [companyCode, setCompanyCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [message, setMessage] = useState({ text: '', isError: false });

  useEffect(() => {
    // ログインチェック
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
      }
      setIsFetching(false);
    };
    checkUser();
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', isError: false });

    try {
      // Supabaseの 'companies' テーブルに企業コードを登録（上書き）する
      const { error } = await supabase
        .from('companies')
        .upsert([
          { 
            id: companyCode,     // これが「COMP-A」などの企業コードになります
            name: companyName    // 企業名（任意）
          }
        ]);

      if (error) throw error;

      setMessage({ text: '企業コードの登録が完了しました！従業員に共有してください。', isError: false });
    } catch (error: any) {
      setMessage({ text: `登録に失敗しました: ${error.message}`, isError: true });
    } finally {
      setLoading(false);
    }
  };

  if (isFetching) return <div className="min-h-screen flex items-center justify-center bg-slate-50">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <Title className="text-2xl font-bold text-slate-800">⚙️ 企業コード設定</Title>
          <Button variant="light" onClick={() => router.back()}>
            ← ダッシュボードに戻る
          </Button>
        </div>

        <Card>
          <Text className="mb-6 leading-relaxed">
            従業員がアセスメントを受診する際に入力する「企業コード」を作成します。
            ここで登録したコードを、受診対象の従業員へ共有してください。
          </Text>

          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">企業コード（必須）</label>
              <TextInput 
                placeholder="例: COMP-A （半角英数字で自由に決定）" 
                value={companyCode} 
                onChange={(e) => setCompanyCode(e.target.value)}
                required
              />
              <Text className="text-xs text-slate-500 mt-1">※このコードが認証用のパスワード代わりになります。</Text>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">企業名（任意）</label>
              <TextInput 
                placeholder="例: 株式会社HERO" 
                value={companyName} 
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            {/* メッセージ表示エリア */}
            {message.text && (
              <div className={`p-4 rounded-md text-sm font-bold ${message.isError ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                {message.text}
              </div>
            )}

            <Button type="submit" className="w-full" loading={loading} disabled={!companyCode}>
              この企業コードを登録する
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

// Vercelデプロイ時のエラーを防ぐためのSuspenseラップ
export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">準備中...</div>}>
      <SettingsContent />
    </Suspense>
  );
}