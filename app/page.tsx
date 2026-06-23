'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react'; 
import { Card, Title, Button, TextInput } from '@tremor/react';
import { heroData, calculateScore } from '@/utils/heroData';
import { supabase } from '@/utils/supabase';

// 画面の種類
type ScreenState = 'home' | 'entry' | 'quiz' | 'result' | 'help';

function AssessmentContent() {
  const searchParams = useSearchParams();
  const cid = searchParams.get('cid');
  const router = useRouter();
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('home');
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [tier, setTier] = useState(1);
  const [empInfo, setEmpInfo] = useState({ companyId: '', employeeId: '', department: '', role: '' });
  const [originalEmpInfo, setOriginalEmpInfo] = useState({ companyId: '', employeeId: '', department: '', role: '' })
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [resultData, setResultData] = useState<any>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [entryError, setEntryError] = useState('');

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        
        const { data: existingEmps, error: fetchError } = await supabase
          .from('employees')
          .select('company_id, employee_id_or_name, department, role')
          .eq('user_id', user.id)
          .limit(1);

        const existingEmp = existingEmps?.[0];

        if (existingEmp) {
          const fetchedData = {
            companyId: existingEmp.company_id,
            employeeId: existingEmp.employee_id_or_name,
            department: existingEmp.department || '',
            role: existingEmp.role || ''
          };

          setEmpInfo(fetchedData);
          setOriginalEmpInfo(fetchedData);
          setIsRegistered(true); 
        }
      }
    };
    fetchUserAndProfile();
  }, []);

  const startEntry = (selectedTier: number) => {
    setTier(selectedTier);
    setCurrentScreen('entry');
    setEntryError(''); 
  };

  const startQuiz = async () => {
    setEntryError('');

    if (!empInfo.companyId || !empInfo.employeeId) {
      setEntryError("企業コードと氏名（社員番号）は必須です");
      return;
    }

    setIsChecking(true);

    try {
      const response = await fetch('/api/check-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: empInfo.companyId })
      });

      const data = await response.json();

      if (data.exists || empInfo.companyId === 'GUEST_TRIAL') {
        const targetQuestions = heroData.questions.filter((q: any) => q.tier <= tier);
        setQuestions(targetQuestions);
        setCurrentIdx(0);
        setAnswers({});
        setCurrentScreen('quiz');
      } else {
        setEntryError('入力された企業コードは登録されていません。');
      }
    } catch (error) {
      setEntryError('通信エラーが発生しました。');
    } finally {
      setIsChecking(false);
    }
  };

  const startGuestQuiz = () => {
    setEmpInfo({
      companyId: 'GUEST_TRIAL',
      employeeId: 'お試しゲスト_' + Math.floor(Math.random() * 1000),
      department: 'ゲスト',
      role: 'ゲスト'
    });
    
    const targetQuestions = heroData.questions.filter((q: any) => q.tier <= tier);
    setQuestions(targetQuestions);
    setCurrentIdx(0);
    setAnswers({});
    setCurrentScreen('quiz');
  };

  const handleAnswer = (qId: string, value: number) => {
    setAnswers({ ...answers, [qId]: value });
  };

  const goNext = async () => {
    const currentQ = questions[currentIdx];
    if (!answers[currentQ.id]) {
      alert("回答を選択してください");
      return;
    }

    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      setIsSaving(true);
      const { typeStr, percentages } = calculateScore(questions, answers);
      
      try {
        await fetch('/api/save-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: empInfo.companyId,
            employeeId: empInfo.employeeId,
            department: empInfo.department || '未設定',
            role: empInfo.role || '未設定',
            type: typeStr,
            tier: tier,
            percentages: percentages,
            userId: currentUser?.id 
          })
        });
        
        setResultData({ typeStr, percentages });
        setCurrentScreen('result');
      } catch (err) {
        alert("データの保存に失敗しました");
      }
      setIsSaving(false);
    }
  };

  const renderHome = () => (
    <Card className="max-w-2xl mx-auto mt-10 p-8">
      <Title className="text-2xl font-bold text-center mb-2">心理的資本アセスメント</Title>
      <p className="text-center text-slate-500 mb-8">HEROに基づく組織レジリエンス及びコンピテンシー診断</p>
      
      {currentUser ? (
        <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-lg text-center text-sm font-medium border border-emerald-100">
          現在 {currentUser.email} でログインしています
        </div>
      ) : (
        <div className="mb-6 p-4 bg-amber-50 text-amber-700 rounded-lg text-center text-sm font-medium border border-amber-100">
          <Link href="/login" className="underline font-bold">ログイン</Link> すると、過去の履歴と紐づけて受診できます
        </div>
      )}

      <div className="mb-8 border-b border-slate-200 pb-8">
        <Button 
          variant="light" 
          className="w-full justify-center bg-blue-50 hover:bg-blue-100 text-blue-700 py-3 rounded-lg border border-blue-200 shadow-sm"
          onClick={() => setCurrentScreen('help')}
        >
          📖 初めての方へ：アセスメントの解説と使い方を読む
        </Button>
      </div>

      <div className="space-y-4">
        <p className="text-sm font-bold text-slate-600 text-center mb-2">▼ 診断を開始する</p>
        <Button className="w-full" variant="secondary" onClick={() => startEntry(1)}>簡易診断 (12問)</Button>
        <Button className="w-full" variant="secondary" onClick={() => startEntry(2)}>標準診断 (28問)</Button>
        <Button className="w-full" variant="secondary" onClick={() => startEntry(3)}>精密診断 (48問)</Button>
      </div>
      
      <div className="mt-12 pt-6 border-t border-slate-200 text-center flex flex-col gap-3">
        <Link 
          href="/admin-login" 
          className="text-sm text-slate-400 hover:text-blue-600 underline underline-offset-4 inline-block"
        >
        法人管理者用ダッシュボードはこちら
        </Link>
        {currentUser && (
          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.reload();
            }}
            className="text-sm text-slate-400 hover:text-red-500 transition-colors"
          >
            別のアカウントでログインし直す（ログアウト）
          </button>
        )}
      </div>
    </Card>
  );

  const renderHelp = () => (
    <Card className="max-w-3xl mx-auto mt-10 p-8 shadow-xl border-t-4 border-indigo-500">
      <div className="flex justify-between items-center mb-8 pb-4 border-b">
        <Title className="text-2xl font-bold text-slate-800">📖 アセスメント・マニュアル</Title>
        <Button variant="light" onClick={() => setCurrentScreen('home')}>← ホームに戻る</Button>
      </div>

      <div className="space-y-12 text-slate-700 leading-relaxed">
        <section>
          <h3 className="text-xl font-bold text-indigo-700 mb-4 flex items-center gap-2">
            <span className="bg-indigo-100 text-indigo-800 w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
            心理的資本（PsyCap）とは？
          </h3>
          <p className="mb-4">
            心理的資本とは、一言で言えば「前向きにやり抜く力」の源泉です。本アセスメントでは、以下の4つの要素（頭文字をとって <strong>HERO</strong>）を測定し、あなたの現在の心のエネルギー状態を可視化します。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-lg border">
              <strong className="text-blue-600 text-lg block mb-1">H (Hope / 意志力)</strong>
              目標に向かって複数の道筋を考え、困難があっても進み続ける「Waypower（道を見つける力）」と「Willpower（意志の力）」です。
            </div>
            <div className="bg-slate-50 p-4 rounded-lg border">
              <strong className="text-teal-600 text-lg block mb-1">E (Efficacy / 自己効力感)</strong>
              「自分ならこの課題を達成できる」と信じる自信です。過去の成功体験や、他者の成功を観察することで高まります。
            </div>
            <div className="bg-slate-50 p-4 rounded-lg border">
              <strong className="text-amber-600 text-lg block mb-1">R (Resilience / 復元力)</strong>
              逆境や失敗、時には大きな成功による変化などから素早く立ち直り、さらに前へ進むための「バネ」のような力です。
            </div>
            <div className="bg-slate-50 p-4 rounded-lg border">
              <strong className="text-rose-600 text-lg block mb-1">O (Optimism / 楽観性)</strong>
              成功は「自分の能力のおかげで、今後も続く」と捉え、失敗は「たまたま運が悪かっただけで、次はうまくいく」と柔軟に捉える思考法です。
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-xl font-bold text-indigo-700 mb-4 flex items-center gap-2">
            <span className="bg-indigo-100 text-indigo-800 w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
            16パターンのコンピテンシー分類
          </h3>
          <p className="mb-4">
            診断結果では、上記のHEROそれぞれのスコアが高い（High）か低い（Low）かによって、2の4乗＝<strong>全16タイプの傾向</strong>に分類されます。これは「性格の優劣」ではなく、<strong>現在のあなたがどの部分でエネルギーを消費しやすいか、どこを強みとしているか</strong>を示す状態（State）です。
          </p>
          <div className="bg-white border rounded-lg p-5">
            <h4 className="font-bold text-slate-800 mb-3 border-b pb-2">💡 代表的なタイプの例</h4>
            <ul className="space-y-4 text-sm">
              <li>
                <strong className="inline-block w-16 text-blue-600">HHHH</strong>
                <span className="font-bold text-slate-700">自律型ハイパフォーマー</span><br/>
                全要素が高く、自ら目標を掲げて逆境も乗り越える理想的な状態。ただし、無理をしすぎないよう適度な休息が必要です。
              </li>
              <li>
                <strong className="inline-block w-16 text-rose-600">LLLL</strong>
                <span className="font-bold text-slate-700">枯渇/バーンアウト予備軍</span><br/>
                一時的にエネルギーが低下している状態。まずは心身の回復を最優先にし、小さな成功体験を積むことが推奨されます。
              </li>
              <li>
                <strong className="inline-block w-16 text-teal-600">HHLH</strong>
                <span className="font-bold text-slate-700">前のめりチャレンジャー</span><br/>
                意志や自信は高いものの、失敗時の復元力（R）が低め。一度挫折すると長引く可能性があるため、リスクヘッジの視点を持つことが鍵です。
              </li>
              <li>
                <strong className="inline-block w-16 text-amber-600">LHHH</strong>
                <span className="font-bold text-slate-700">サポーター/現状維持型</span><br/>
                周囲の支援や自己効力感は高いが、自ら新しい目標（H）を立てるのが少し苦手。明確な指標やリーダーシップを与えられると輝きます。
              </li>
            </ul>
            <p className="text-xs text-slate-400 mt-4">※これらはあくまで16種の一部です。診断後にあなた自身の詳細なプロフィールとアクションプランが表示されます。</p>
          </div>
        </section>

        <section>
          <h3 className="text-xl font-bold text-indigo-700 mb-4 flex items-center gap-2">
            <span className="bg-indigo-100 text-indigo-800 w-8 h-8 rounded-full flex items-center justify-center text-sm">3</span>
            受診時の心構え
          </h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>直感で答える：</strong> 深く考え込まず、最初のインスピレーションで回答する方が正確な結果が出ます。</li>
            <li><strong>「今の状態」で答える：</strong> 心理的資本は変化するものです。「過去」や「理想の自分」ではなく、直近1〜2週間の「今の自分」の状態で回答してください。</li>
            <li><strong>正解はありません：</strong> このアセスメントはあなたを評価・採点するものではありません。自分自身の状態を客観視するための「鏡」としてご活用ください。</li>
          </ul>
        </section>

      </div>

      <div className="mt-12 pt-8 border-t flex justify-center">
        <Button size="xl" onClick={() => setCurrentScreen('home')}>
          理解してホームに戻る
        </Button>
      </div>
    </Card>
  );

  const renderEntry = () => (
    <Card className="max-w-2xl mx-auto mt-10 p-8 border-t-4 border-blue-500 shadow-lg">
      <Title className="text-xl font-bold mb-6 text-slate-800">受診者情報の入力</Title>
      
      <div className="mb-8 bg-indigo-50 border border-indigo-100 rounded-lg p-4">
        <details className="group">
          <summary className="flex items-center font-bold cursor-pointer text-sm text-indigo-800 outline-none">
            <span className="mr-2">ℹ️</span>
            入力項目に関するヘルプ（初めての方へ）
            <span className="ml-auto transition-transform duration-300 group-open:rotate-180">
              ▼
            </span>
          </summary>
          <div className="text-sm text-indigo-900 mt-4 space-y-4 leading-relaxed border-t border-indigo-200 pt-4">
            <div>
              <strong className="block text-indigo-700">Q. 企業コードとは何ですか？</strong>
              <p>あなたの所属する企業・組織から指定された専用のコードです。入力することで、診断結果が組織のHR（人事）担当者に共有され、組織全体の環境改善やサポートに役立てられます。</p>
            </div>
            <div>
              <strong className="block text-indigo-700">Q. 社員番号・部署はなぜ必要ですか？</strong>
              <p>組織側で「誰のデータか」を識別するために使用します。所属組織からの案内に従って、正確に入力してください。</p>
            </div>
            <div>
              <strong className="block text-indigo-700">Q. 「無料でお試し診断」とは何ですか？</strong>
              <p>企業コードをお持ちでない個人の方でも、ご自身の心理的資本を測定できる機能です。お試し診断の場合、結果はどの企業にも送信されず、あなた個人だけが確認できます。</p>
            </div>
          </div>
        </details>
      </div>

      {isRegistered && (
        <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100 flex justify-between items-center">
          <p className="text-sm text-blue-800 font-medium">
            {isEditing ? '🔓 新しい情報を入力してください。' : '🔒 以下のアカウント情報に紐づけられています。'}
          </p>
          {!isEditing ? (
            <Button size="xs" variant="secondary" onClick={() => setIsEditing(true)}>
              情報を更新する
            </Button>
          ) : (
            <Button 
              size="xs" 
              variant="light" 
              onClick={() => {
                setEmpInfo(originalEmpInfo);
                setIsEditing(false);
              }}
            >
              更新をキャンセル
            </Button>
          )}
        </div>
      )}

      <div className="space-y-4 mb-8">
        <div>
          <label className="text-sm font-medium text-slate-700">企業コード *（変更不可）</label>
          <TextInput 
            placeholder="例: COMP-A" className="mt-1 bg-slate-50"
            value={empInfo.companyId} onChange={(e) => setEmpInfo({...empInfo, companyId: e.target.value})}
            disabled={isRegistered} 
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">社員番号 または 氏名 *</label>
          <TextInput 
            placeholder="例: EMP-001 / 山田太郎" className="mt-1"
            value={empInfo.employeeId} onChange={(e) => setEmpInfo({...empInfo, employeeId: e.target.value})}
            disabled={isRegistered && !isEditing} 
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">部署（任意）</label>
          <TextInput 
            placeholder="例: 営業部 / 開発部" className="mt-1"
            value={empInfo.department} onChange={(e) => setEmpInfo({...empInfo, department: e.target.value})}
            disabled={isRegistered && !isEditing} 
          />
        </div>
        {/* 💡 ここに「役職」の入力欄を追加！ */}
        <div>
          <label className="text-sm font-medium text-slate-700">役職・肩書（任意）</label>
          <TextInput 
            placeholder="例: マネージャー / リーダー / メンバー" className="mt-1"
            value={empInfo.role} onChange={(e) => setEmpInfo({...empInfo, role: e.target.value})}
            disabled={isRegistered && !isEditing} 
          />
        </div>
      </div>
      
      {entryError && (
        <p className="text-red-500 text-sm font-bold mb-4 bg-red-50 p-3 rounded">{entryError}</p>
      )}

      <div className="flex gap-4">
        <Button variant="light" onClick={() => setCurrentScreen('home')} className="w-1/3">戻る</Button>
        <Button 
          onClick={startQuiz} 
          className="w-2/3"
          loading={isChecking}
          disabled={!empInfo.companyId || !empInfo.employeeId || isChecking}
        >
          {isRegistered ? 'この情報で診断を開始する' : '同意して診断を開始する'}
        </Button>
      </div>

      {!isRegistered && (
        <>
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-4 text-slate-500 font-medium tracking-wide">または</span>
            </div>
          </div>

          <div className="text-center p-6 bg-slate-50 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
            <p className="text-sm text-slate-600 mb-4 font-bold">
              企業コードをお持ちでない個人の方・まずはお試ししたい方
            </p>
            <Button
              variant="secondary"
              className="w-full bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
              onClick={startGuestQuiz}
            >
              無料でお試し診断をする
            </Button>
          </div>
        </>
      )}
    </Card>
  );

  const renderQuiz = () => {
    if (questions.length === 0) return null;
    const q = questions[currentIdx];

    return (
      <Card className="max-w-2xl mx-auto mt-10 p-8">
        <div className="flex justify-between items-center mb-6">
          <span className="text-sm font-medium text-slate-500">設問 {currentIdx + 1} / {questions.length}</span>
          <Button variant="light" color="red" onClick={() => setCurrentScreen('home')}>中断</Button>
        </div>
        
        <div className="mb-8 p-6 bg-slate-50 rounded-lg border">
          <p className="text-lg text-slate-800 font-medium">{q?.text?.ja || q?.text}</p>
        </div>

        <div className="space-y-3 mb-8">
          {heroData.app_config.scale.map((scale: any) => (
            <Button 
              key={scale.value}
              variant={answers[q?.id] === scale.value ? "primary" : "secondary"}
              className="w-full justify-start"
              onClick={() => handleAnswer(q?.id, scale.value)}
            >
              {scale.label?.ja || scale.label}
            </Button>
          ))}
        </div>

        <div className="flex justify-between">
          <Button variant="light" onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))} disabled={currentIdx === 0}>戻る</Button>
          <Button onClick={goNext} loading={isSaving}>
            {currentIdx === questions.length - 1 ? '結果を解析する' : '次へ'}
          </Button>
        </div>
      </Card>
    );
  };

  const renderResult = () => {
    if (!resultData) return null;
    // @ts-ignore
    const typeInfo = heroData.types[resultData.typeStr] || { title: { ja: '不明なタイプ' }, profile: { ja: '' }, action_plan: { ja: '' } };

    return (
      <Card className="max-w-2xl mx-auto mt-10 p-8">
        <div className="text-center mb-6 text-sm font-bold text-blue-600">Class: {resultData.typeStr}</div>
        <Title className="text-2xl font-bold text-center mb-6">{typeInfo.title?.ja || typeInfo.title}</Title>
        
        <div className="bg-slate-50 p-6 rounded-lg mb-6 text-sm leading-relaxed text-slate-700">
          {typeInfo.profile?.ja || typeInfo.profile}
        </div>
        
        <div className="border p-6 rounded-lg mb-8">
          <strong className="block mb-2 text-blue-700">■ アクションプラン</strong>
          <p className="text-sm text-slate-700">{typeInfo.action_plan?.ja || typeInfo.action_plan}</p>
        </div>

        <Button className="w-full" onClick={() => setCurrentScreen('home')}>
          ホームに戻る
        </Button>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      {currentScreen === 'home' && renderHome()}
      {currentScreen === 'help' && renderHelp()}
      {currentScreen === 'entry' && renderEntry()}
      {currentScreen === 'quiz' && renderQuiz()}
      {currentScreen === 'result' && renderResult()}
    </div>
  );
}

export default function AssessmentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">画面を準備中...</div>}>
      <AssessmentContent />
    </Suspense>
  );
}