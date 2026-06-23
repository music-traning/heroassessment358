import { NextResponse } from 'next/server';

// 💡 Vercelのキャッシュバグを防ぎ、常にサーバー側で最新の処理を行うための設定
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { chartData } = body;

    const prompt = `あなたはプロの組織開発コンサルタントです。
以下の「HERO（心理的資本）」のアセスメント結果データを分析し、経営陣に向けて「組織の現状の強み・弱み」と「具体的な改善アクション」を提示してください。
回答は読みやすいMarkdown形式（見出しや箇条書きを使用）で出力してください。

【社員のアセスメントデータ】
${JSON.stringify(chartData, null, 2)}`;

    // 💡 修正：process.env.GEMINI_API_KEY を直接参照する形を徹底
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      // 💡 デバッグ用：何が原因で弾かれているのかログをより詳細に出力する
      console.error("【エラー詳細】Vercel上でGEMINI_API_KEYが認識できていません。");
      throw new Error("APIキーがシステムに設定されていません。VercelのEnvironment Variablesをご確認ください。");
    }

    // 💡 モデル名を現在世界で最も安定しており、かつ超低コストな最新の「gemini-1.5-flash」に変更します
    // ※gemini-2.5-flashはまだ実験的（Beta）なエンドポイントのため、本番サーバーから拒否されるケースがあります
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        }),
        // 💡 サーバーサイドでのFetchのキャッシュを無効化する（Vercel対策）
        cache: 'no-store'
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Google API Error:", data);
      
      if (response.status === 429 || (data.error && data.error.code === 429)) {
         throw new Error("現在AIのアクセス制限に達しています。残高を確認するか、しばらく待ってから再度お試しください。");
      }
      if (response.status === 503 || (data.error && data.error.code === 503)) {
         throw new Error("現在、GoogleのAIサーバーが混み合っています。数分待ってから再度「分析する」ボタンを押してください。");
      }
      
      throw new Error(data.error?.message || "AI分析中にエラーが発生しました。");
    }

    const text = data.candidates[0].content.parts[0].text;
    return NextResponse.json({ report: text });

  } catch (error: any) {
    console.error("Fetch API Error:", error.message || error);
    return NextResponse.json({ error: error.message || "分析中にエラーが発生しました" }, { status: 500 });
  }
}