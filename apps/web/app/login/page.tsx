"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { rehydrateAllStores } from "@/lib/persistence/storage";

export default function LoginPage() {
  const router = useRouter();
  const { login, register } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "", handle: "" });

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const result = isRegister
        ? await register({
            email: form.email,
            password: form.password,
            handle: form.handle,
            displayName: form.handle,
          })
        : await login({ email: form.email, password: form.password });

      if (!result.success) {
        setError(result.error || "Something went wrong. Please try again.");
        return;
      }

      // Rehydrate all stores with the new userId scoping
      rehydrateAllStores();

      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-green-400 tracking-widest mb-2">TCC</h1>
          <p className="text-white/40 text-sm tracking-widest uppercase">Trader's Command Center</p>
          <p className="text-white/20 text-xs mt-2">The world's first platform where trading is a sport</p>
        </div>

        <div className="glass border border-white/10 rounded-2xl p-8">
          <div className="flex mb-6 bg-white/5 rounded-xl p-1">
            <button onClick={() => setIsRegister(false)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${!isRegister ? "bg-green-500/20 text-green-400" : "text-white/40 hover:text-white/60"}`}>
              Login
            </button>
            <button onClick={() => setIsRegister(true)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${isRegister ? "bg-green-500/20 text-green-400" : "text-white/40 hover:text-white/60"}`}>
              Register
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {isRegister && (
              <div>
                <label className="text-white/40 text-xs mb-1 block">Handle</label>
                <input type="text" placeholder="e.g. nk0210"
                  value={form.handle}
                  onChange={(e) => setForm({ ...form, handle: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm focus:outline-none focus:border-green-400/50 transition" />
              </div>
            )}
            <div>
              <label className="text-white/40 text-xs mb-1 block">Email</label>
              <input type="email" placeholder="your@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm focus:outline-none focus:border-green-400/50 transition" />
            </div>
            <div>
              <label className="text-white/40 text-xs mb-1 block">Password</label>
              <input type="password" placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm focus:outline-none focus:border-green-400/50 transition" />
            </div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}
            <button onClick={handleSubmit} disabled={loading}
              className="mt-2 w-full bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 py-3.5 rounded-xl text-sm font-semibold transition disabled:opacity-50">
              {loading ? "Please wait..." : isRegister ? "Create Account" : "Enter the Platform"}
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5">
            <p className="text-white/20 text-xs text-center">Demo version · Paper trading · No real money</p>
            <p className="text-white/10 text-xs text-center mt-1">Owner access: set localStorage 'tcc:dev:role' = 'owner'</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[{ emoji: "📊", label: "Live Charts" }, { emoji: "🤖", label: "AI Journal" }, { emoji: "🏆", label: "Competitions" }].map(f => (
            <div key={f.label} className="glass border border-white/5 rounded-xl p-3 text-center">
              <p className="text-xl mb-1">{f.emoji}</p>
              <p className="text-white/30 text-xs">{f.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}