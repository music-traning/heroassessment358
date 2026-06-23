import { NextResponse } from 'next/server';

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

    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error("【エラー詳細】Vercel上でGEMINI_API_KEYが認識できていません。");
      throw new Error("APIキーがシステムに設定されていません。VercelのEnvironment Variablesをご確認ください。");
    }

    // 💡 修正：あなたの最初の大正解「gemini-2.5-flash」に戻します！！
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        }),
        cache: 'no-store' // 💡 Vercel対策のキャッシュ無効化は残しておきます
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