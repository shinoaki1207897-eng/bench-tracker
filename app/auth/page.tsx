"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError("メールアドレスまたはパスワードが間違っています");
      } else {
        router.push("/dashboard");
      }
    } else {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError("登録に失敗しました: " + signUpError.message);
      } else if (data.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({ id: data.user.id, username });
        if (profileError) {
          setError("ユーザー名が既に使われています");
        } else {
          router.push("/dashboard");
        }
      }
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-2">💪 BenchTracker</h1>
        <p className="text-gray-500 text-sm mb-6">
          {isLogin ? "ログインして記録を確認" : "アカウントを作成"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium mb-1">ユーザー名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="例: akira"
                required
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="example@email.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="6文字以上"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50"
          >
            {loading ? "処理中..." : isLogin ? "ログイン" : "アカウント作成"}
          </button>
        </form>

        <button
          onClick={() => { setIsLogin(!isLogin); setError(""); }}
          className="mt-4 text-sm text-gray-500 hover:text-gray-900 w-full text-center"
        >
          {isLogin ? "アカウントをお持ちでない方はこちら" : "すでにアカウントをお持ちの方"}
        </button>
      </div>
    </div>
  );
}
