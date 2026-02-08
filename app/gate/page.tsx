'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function GateForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push(redirect);
        router.refresh();
      } else {
        setError(true);
        setPassword('');
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: '#0B0B0F' }}
    >
      <div className="w-full max-w-sm text-center">
        {/* Logo */}
        <div className="mb-10">
          <img
            src="/images/logos/drive-exotiq-lockup-transparent.png"
            alt="Drive Exotiq"
            className="h-10 mx-auto mb-6"
          />
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: 'rgba(110, 193, 228, 0.08)',
              border: '1px solid rgba(110, 193, 228, 0.2)',
              color: '#6EC1E4',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: '#6EC1E4' }}
            />
            Private Preview
          </div>
        </div>

        {/* Heading */}
        <h1
          className="text-2xl font-bold mb-2"
          style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5' }}
        >
          Marketplace Preview
        </h1>
        <p className="text-sm mb-8" style={{ color: '#8888A0' }}>
          Enter the access code to continue.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              placeholder="Access code"
              autoFocus
              className="w-full px-5 py-3.5 rounded-xl text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-[#6EC1E4]/40"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: error
                  ? '1px solid rgba(231, 76, 60, 0.6)'
                  : '1px solid rgba(110, 193, 228, 0.15)',
                color: '#F0F0F5',
              }}
            />
            {error && (
              <p className="text-xs mt-2 text-left" style={{ color: '#E74C3C' }}>
                Invalid access code. Please try again.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all duration-300 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#6EC1E4', color: '#0B0B0F' }}
          >
            {loading ? 'Verifying...' : 'Enter'}
          </button>
        </form>

        {/* Footer */}
        <p className="text-xs mt-10" style={{ color: '#555570' }}>
          © 2025 Drive Exotiq. Confidential.
        </p>
      </div>
    </div>
  );
}

export default function GatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0B0B0F' }}>
        <div className="w-8 h-8 border-2 border-[#6EC1E4] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <GateForm />
    </Suspense>
  );
}
