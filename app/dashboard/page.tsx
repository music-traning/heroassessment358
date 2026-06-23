'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  Card, Title, Text, Button, Table, TableHead, TableRow, TableHeaderCell, 
  TableBody, TableCell, Badge, BarChart, DonutChart, Grid 
} from '@tremor/react';
import { useRouter } from 'next/navigation';

type EmployeeData = {
  id: string;
  employee_id_or_name: string;
  department: string;
  role: string;
  assessment_results: {
    type_str: string;
    tier: number;
    percentages: { H: number; E: number; R: number; O: number };
    created_at: string;
  }[];
};

function DashboardContent() {
  const router = useRouter();
  
  // データ保持用のState
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentCompanyId, setCurrentCompanyId] = useState(''); // 💡 企業コードを保持するState
  const [userEmail, setUserEmail] = useState('');
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  
  // UI制御用のState
  const [loading, setLoading] = useState(true);
  const [aiReport, setAiReport] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  // ==========================================
  // 1. 初期化：ログインユーザーの自動判定とデータ取得
  // ==========================================
  useEffect(() => {
    const initDashboard = async () => {
      // ① Supabaseから現在のログインユーザーを取得
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        router.push('/login');
        return;
      }
      
      setCurrentUserId(user.id);
      setUserEmail(user.email || '管理者');

      // ② companiesテーブルから、このユーザーが管理する「企業コード」を探す
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('admin_user_id', user.id)
        .maybeSingle(); // エラーを出さずに0件か1件を取得

      if (companyError || !companyData) {
        console.warn('このアカウントに紐づく企業コードが見つかりません。');
        setLoading(false);
        return; // 企業が見つからない場合はここでストップ
      }

      const companyId = companyData.id;
      setCurrentCompanyId(companyId);
      
      // ③ 見つけた「企業コード」を使って社員データを取得
      await fetchEmployeesData(companyId);
    };
    
    initDashboard();
  }, [router]);

  // 引数として受け取った企業コード(cid)で社員を検索
  const fetchEmployeesData = async (cid: string) => {
    setLoading(true);
    try {
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select(`
          id, employee_id_or_name, department, role,
          assessment_results ( type_str, tier, percentages, created_at )
        `)
        .eq('company_id', cid); // 💡 UUIDではなく、見つけた企業コードで検索！

      if (empError) throw empError;
      setEmployees((empData as EmployeeData[]) || []);
    } catch (err) {
      console.error('データ取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 2. テストデータ生成処理
  // ==========================================
  const generateTestData = async () => {
    if (!currentCompanyId) {
      alert("企業コードが紐付いていないためテストデータを生成できません。Supabaseのcompaniesテーブルに、あなたのユーザーIDを登録してください。");
      return;
    }
    
    setLoading(true);
    try {
      const { data: emps, error: empError } = await supabase
        .from('employees')
        .insert([
          // 💡 企業コード(currentCompanyId)を使って社員を登録
          { company_id: currentCompanyId, employee_id_or_name: 'デモ社員A', department: '営業部', role: 'リーダー' },
          { company_id: currentCompanyId, employee_id_or_name: 'デモ社員B', department: '開発部', role: 'メンバー' }
        ])
        .select();

      if (empError) throw empError;

      if (emps && emps.length === 2) {
        await supabase.from('assessment_results').insert([
          { company_id: currentCompanyId, employee_id: emps[0].id, type_str: 'HHHH', tier: 1, percentages: { H: 90, E: 85, R: 80, O: 95 }, user_id: currentUserId },
          { company_id: currentCompanyId, employee_id: emps[1].id, type_str: 'LLHL', tier: 1, percentages: { H: 40, E: 30, R: 75, O: 45 }, user_id: currentUserId }
        ]);
      }
      
      // 生成後、再度データを取得して画面を更新
      await fetchEmployeesData(currentCompanyId);
    } catch (error: any) {
      console.error(error);
      alert("テストデータの生成に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 3. AI分析処理（プラン判定）
  // ==========================================
  const generateAiReport = async () => {
    // 💡 プレミアム権限のチェック
    const premiumEmails = ['admin@example.com']; 

    if (!premiumEmails.includes(userEmail)) {
      setShowPaywall(true);
      return;
    }

    setIsAnalyzing(true);
    const chartData = employees.map(emp => {
      const latestResult = emp.assessment_results[0];
      return {
        name: emp.employee_id_or_name,
        department: emp.department,
        role: emp.role,
        heroType: latestResult ? latestResult.type_str : '未受診',
        scores: latestResult ? latestResult.percentages : null,
      };
    });

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chartData })
      });
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 503) throw new Error("現在AIサーバーが混み合っています。数分待って再度お試しください。");
        throw new Error(data.error || "分析中にエラーが発生しました。");
      }
      
      setAiReport(data.report);
    } catch (error: any) {
      console.error(error);
      alert(error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login'); 
  };

  // ==========================================
  // 4. グラフ計算処理
  // ==========================================
  const averageScores = useMemo(() => {
    const validResults = employees.map(emp => emp.assessment_results[0]?.percentages).filter(Boolean);
    if (validResults.length === 0) return [];
    const sums = validResults.reduce((acc, curr) => ({
      H: acc.H + (curr.H || 0), E: acc.E + (curr.E || 0), R: acc.R + (curr.R || 0), O: acc.O + (curr.O || 0),
    }), { H: 0, E: 0, R: 0, O: 0 });
    const count = validResults.length;
    return [{
        name: '組織平均値',
        'Hope (意志力)': Math.round(sums.H / count),
        'Efficacy (自己効力感)': Math.round(sums.E / count),
        'Resilience (復元力)': Math.round(sums.R / count),
        'Optimism (楽観性)': Math.round(sums.O / count),
    }];
  }, [employees]);

  const typeDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach(emp => {
      const type = emp.assessment_results[0]?.type_str;
      if (type) counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).map(([type, count]) => ({ name: type, '社員数': count }));
  }, [employees]);

  const getScoreColor = (score: number) => {
    if (score >= 75) return "emerald";
    if (score >= 50) return "amber";
    return "rose";
  };

  if (loading && employees.length === 0) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">データを読み込み中...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8 relative animate-fade-in">
        
        <div className="flex justify-between items-end border-b pb-4">
          <div>
            <Title className="text-3xl font-bold text-slate-800">HRマネジメント・ダッシュボード</Title>
            <Text className="mt-1">
              ログインアカウント: <span className="font-medium text-blue-600">{userEmail}</span>
            </Text>
          </div>
          <div className="flex gap-4 items-center">
            <Button variant="light" onClick={() => router.back()}>
              ← 前に戻る
            </Button>

            <Button variant="secondary" onClick={() => router.push('/dashboard/settings')}>
             ⚙️ 企業設定
            </Button>

            <Button color="fuchsia" onClick={generateAiReport} loading={isAnalyzing} disabled={employees.length === 0}>
              ✨ AI組織分析を実行する（プレミアム）
            </Button>
            <Button variant="secondary" onClick={handleLogout}>
              ログアウト
            </Button>
          </div>
        </div>

        {employees.length === 0 ? (
          <Card className="text-center p-10 bg-blue-50 border-blue-200">
            <Title className="mb-4 text-blue-900">アセスメントデータがありません</Title>
            <p className="text-blue-700 mb-6">無料体験用にダミーの組織データを生成して、グラフの動作を確認できます。</p>
            <Button onClick={generateTestData} loading={loading}>テストデータを自動生成する</Button>
          </Card>
        ) : (
          <>
            <Grid numItemsSm={1} numItemsLg={3} className="gap-6">
              <Card>
                <Title>組織全体のHERO平均</Title>
                <BarChart className="h-60 mt-4" data={averageScores} index="name" categories={["Hope (意志力)", "Efficacy (自己効力感)", "Resilience (復元力)", "Optimism (楽観性)"]} colors={["blue", "teal", "amber", "rose"]} valueFormatter={(number) => `${number}%`} yAxisWidth={48} />
              </Card>

              <Card>
                <Title>コンピテンシータイプの分布</Title>
                <DonutChart className="h-60 mt-4" data={typeDistribution} category="社員数" index="name" colors={["indigo", "violet", "fuchsia", "pink", "cyan", "teal", "emerald", "lime", "amber", "orange", "red", "rose"]} valueFormatter={(number) => `${number} 名`} />
              </Card>

              {aiReport ? (
                <Card className="bg-fuchsia-50 border-fuchsia-200 overflow-y-auto max-h-[340px]">
                  <Title className="text-fuchsia-800 mb-2 flex items-center gap-2">✨ AI組織開発レポート</Title>
                  <div className="prose max-w-none text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">{aiReport}</div>
                </Card>
              ) : (
                <Card className="flex flex-col items-center justify-center text-slate-400 border-dashed bg-slate-100 h-60 mt-0">
                  <p className="text-center px-4 leading-relaxed">右上の「✨ AI組織分析を実行する」ボタンを押すと、<br/>Geminiによる高度なシナジー分析レポートが生成されます。</p>
                </Card>
              )}
            </Grid>

            <Card>
              <Title className="mb-4">従業員アセスメント一覧</Title>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>氏名</TableHeaderCell>
                    <TableHeaderCell>部署</TableHeaderCell>
                    <TableHeaderCell>HEROタイプ</TableHeaderCell>
                    <TableHeaderCell>H</TableHeaderCell>
                    <TableHeaderCell>E</TableHeaderCell>
                    <TableHeaderCell>R</TableHeaderCell>
                    <TableHeaderCell>O</TableHeaderCell>
                    <TableHeaderCell>受診日</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {employees.map((emp) => {
                    const latestResult = emp.assessment_results[0];
                    const p = latestResult?.percentages;
                    return (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">
                          <div>{emp.employee_id_or_name}</div>
                          <div className="text-xs text-slate-400">{emp.role}</div>
                        </TableCell>
                        <TableCell>{emp.department}</TableCell>
                        <TableCell>{latestResult ? <Badge color="blue">{latestResult.type_str}</Badge> : <Badge color="gray">未受診</Badge>}</TableCell>
                        <TableCell>{p ? <Badge color={getScoreColor(p.H)}>{Math.round(p.H)}%</Badge> : '-'}</TableCell>
                        <TableCell>{p ? <Badge color={getScoreColor(p.E)}>{Math.round(p.E)}%</Badge> : '-'}</TableCell>
                        <TableCell>{p ? <Badge color={getScoreColor(p.R)}>{Math.round(p.R)}%</Badge> : '-'}</TableCell>
                        <TableCell>{p ? <Badge color={getScoreColor(p.O)}>{Math.round(p.O)}%</Badge> : '-'}</TableCell>
                        <TableCell>{latestResult ? new Date(latestResult.created_at).toLocaleDateString('ja-JP') : '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </>
        )}

        {showPaywall && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm transition-opacity">
            <Card className="max-w-lg w-full mx-4 bg-white shadow-2xl border-t-4 border-fuchsia-500">
              <Title className="text-2xl font-bold mb-4 text-slate-800">法人向けプレミアム機能</Title>
              <p className="text-slate-600 mb-6 leading-relaxed">
                Gemini AIによる高度な組織開発コンサルティングレポートの生成は、法人向けプレミアムプラン限定の機能です。
              </p>
              <div className="flex gap-4 justify-end mt-8">
                <Button variant="secondary" onClick={() => setShowPaywall(false)}>閉じる</Button>
                <Button color="blue" onClick={() => alert('※ここから問い合わせページに遷移します')}>料金プランを問い合わせる</Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">ダッシュボードを準備中...</div>}>
      <DashboardContent />
    </Suspense>
  );
}