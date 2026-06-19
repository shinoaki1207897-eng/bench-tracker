"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { BenchRecord, Profile, Goal } from "@/lib/supabase";

function predictGoalDate(records: BenchRecord[], targetWeight: number): string {
  if (records.length < 2) return "記録が少なすぎます（2件以上必要）";

  const sorted = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const maxWeights = sorted.map((r) => ({ date: new Date(r.date).getTime(), weight: r.weight }));

  const n = maxWeights.length;
  const sumX = maxWeights.reduce((s, r) => s + r.date, 0);
  const sumY = maxWeights.reduce((s, r) => s + r.weight, 0);
  const sumXY = maxWeights.reduce((s, r) => s + r.date * r.weight, 0);
  const sumX2 = maxWeights.reduce((s, r) => s + r.date * r.date, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  if (slope <= 0) return "現在のペースでは目標達成が困難です";

  const targetTime = (targetWeight - intercept) / slope;
  const targetDate = new Date(targetTime);
  const now = new Date();
  if (targetDate < now) return "すでに達成できるペースです！";

  const diff = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return `約${diff}日後（${targetDate.toLocaleDateString("ja-JP")}頃）`;
}

function suggestMenu(maxWeight: number): { name: string; sets: string }[] {
  if (maxWeight < 40) {
    return [
      { name: "ベンチプレス", sets: "20kg × 10回 × 3セット" },
      { name: "ダンベルフライ", sets: "8kg × 12回 × 3セット" },
      { name: "プッシュアップ", sets: "10回 × 3セット" },
    ];
  } else if (maxWeight < 70) {
    return [
      { name: "ベンチプレス", sets: `${Math.round(maxWeight * 0.7)}kg × 8回 × 4セット` },
      { name: "インクラインベンチ", sets: `${Math.round(maxWeight * 0.6)}kg × 10回 × 3セット` },
      { name: "ダンベルフライ", sets: "15kg × 12回 × 3セット" },
    ];
  } else {
    return [
      { name: "ベンチプレス（メイン）", sets: `${Math.round(maxWeight * 0.85)}kg × 5回 × 5セット` },
      { name: "ベンチプレス（補助）", sets: `${Math.round(maxWeight * 0.65)}kg × 10回 × 3セット` },
      { name: "インクラインダンベル", sets: "20kg × 10回 × 3セット" },
    ];
  }
}

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [records, setRecords] = useState<BenchRecord[]>([]);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [rivals, setRivals] = useState<{ username: string; max: number }[]>([]);

  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [targetWeight, setTargetWeight] = useState("");
  const [tab, setTab] = useState<"record" | "ranking" | "menu">("record");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }

      const [{ data: prof }, { data: recs }, { data: g }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("records").select("*").eq("user_id", user.id).order("date", { ascending: false }),
        supabase.from("goals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).single(),
      ]);

      setProfile(prof);
      setRecords(recs || []);
      setGoal(g);
      if (g) setTargetWeight(String(g.target_weight));

      const { data: allRecords } = await supabase
        .from("records")
        .select("user_id, weight, profiles(username)");

      if (allRecords) {
        const maxByUser: { [key: string]: { username: string; max: number } } = {};
        for (const r of allRecords as any[]) {
          const uid = r.user_id;
          if (!maxByUser[uid] || r.weight > maxByUser[uid].max) {
            maxByUser[uid] = { username: r.profiles?.username || "???", max: r.weight };
          }
        }
        setRivals(Object.values(maxByUser).sort((a, b) => b.max - a.max));
      }

      setLoading(false);
    }
    load();
  }, [router]);

  async function addRecord(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("records")
      .insert({ user_id: user.id, weight: Number(weight), reps: Number(reps), date })
      .select()
      .single();

    if (data) setRecords([data, ...records]);
    setWeight(""); setReps("");
  }

  async function saveGoal(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("goals").upsert({ user_id: user.id, target_weight: Number(targetWeight) });
    const { data } = await supabase.from("goals").select("*").eq("user_id", user.id).single();
    setGoal(data);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">読み込み中...</div>;

  const maxWeight = records.length > 0 ? Math.max(...records.map((r) => r.weight)) : 0;
  const prediction = goal && records.length >= 2 ? predictGoalDate(records, goal.target_weight) : null;
  const menu = suggestMenu(maxWeight);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center">
        <h1 className="font-bold text-lg">💪 BenchTracker</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{profile?.username}</span>
          <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-700">ログアウト</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* ステータスカード */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="text-sm text-gray-500 mb-1">最大重量</div>
            <div className="text-3xl font-bold">{maxWeight > 0 ? `${maxWeight}kg` : "---"}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="text-sm text-gray-500 mb-1">目標達成予測</div>
            <div className="text-sm font-medium text-gray-800 mt-1">
              {prediction || (goal ? "記録を増やしてください" : "目標を設定してください")}
            </div>
          </div>
        </div>

        {/* 目標設定 */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold mb-3">目標重量</h2>
          <form onSubmit={saveGoal} className="flex gap-2">
            <input
              type="number"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              placeholder="例: 100"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <span className="flex items-center text-sm text-gray-500">kg</span>
            <button type="submit" className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition">
              設定
            </button>
          </form>
        </div>

        {/* タブ */}
        <div className="flex gap-2">
          {(["record", "ranking", "menu"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                tab === t ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t === "record" ? "記録" : t === "ranking" ? "ランキング" : "メニュー提案"}
            </button>
          ))}
        </div>

        {/* 記録タブ */}
        {tab === "record" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="font-semibold mb-3">記録を追加</h2>
              <form onSubmit={addRecord} className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">日付</label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">重量 (kg)</label>
                    <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="60"
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" required />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">回数</label>
                    <input type="number" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="5"
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" required />
                  </div>
                </div>
                <button type="submit" className="w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition">
                  追加
                </button>
              </form>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
              {records.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-8">まだ記録がありません</p>
              )}
              {records.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-gray-500">{r.date}</span>
                  <span className="font-semibold">{r.weight}kg × {r.reps}回</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ランキングタブ */}
        {tab === "ranking" && (
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
            {rivals.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">まだデータがありません</p>
            )}
            {rivals.map((r, i) => (
              <div key={r.username} className={`flex items-center justify-between px-5 py-4 ${r.username === profile?.username ? "bg-blue-50" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-bold ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-gray-300"}`}>
                    {i + 1}
                  </span>
                  <span className="font-medium">{r.username} {r.username === profile?.username ? "（あなた）" : ""}</span>
                </div>
                <span className="font-bold">{r.max}kg</span>
              </div>
            ))}
          </div>
        )}

        {/* メニュー提案タブ */}
        {tab === "menu" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">現在の最大重量 {maxWeight > 0 ? `${maxWeight}kg` : "未記録"} に基づくメニュー：</p>
            {menu.map((m) => (
              <div key={m.name} className="bg-white rounded-xl border border-gray-100 px-5 py-4 flex justify-between items-center">
                <span className="font-medium">{m.name}</span>
                <span className="text-sm text-gray-500">{m.sets}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
