'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function post(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState('request'); // 'request' | 'reset'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleRequestOTP(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await post('/auth/forgot-password', { email });
      setSuccess('OTP sent to your email. Enter it below to set a new password.');
      setStep('reset');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await post('/auth/reset-password', { email, otp, password: newPassword });
      setSuccess('Password changed successfully. Redirecting to sign in…');
      setTimeout(() => router.replace('/login'), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span
            className="text-3xl font-extrabold tracking-tight text-teal-600"
            style={{ fontFamily: 'var(--font-nunito, sans-serif)' }}
          >
            GatherrGo
          </span>
          <p className="mt-1 text-sm text-slate-500 font-medium">Admin Panel</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-lg shadow-teal-900/5 p-8">
          <h1 className="text-xl font-bold text-slate-900 mb-1">Reset password</h1>
          <p className="text-sm text-slate-500 mb-6">
            {step === 'request'
              ? "Enter your admin email and we'll send you a one-time code."
              : 'Enter the code we emailed you along with your new password.'}
          </p>

          {success && (
            <div className="mb-5 text-sm text-teal-700 bg-teal-50 border border-teal-100 rounded-xl px-4 py-3">
              {success}
            </div>
          )}

          {step === 'request' ? (
            <form onSubmit={handleRequestOTP} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-slate-800 text-sm transition-all"
                  placeholder="admin@example.com"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors shadow-sm mt-2"
              >
                {loading ? 'Sending…' : 'Send code'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">OTP code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  maxLength={6}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-slate-800 text-sm tracking-widest font-mono transition-all"
                  placeholder="123456"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-slate-800 text-sm transition-all"
                  placeholder="Min. 8 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-slate-800 text-sm transition-all"
                  placeholder="Re-enter new password"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setStep('request'); setError(''); setSuccess(''); setOtp(''); setNewPassword(''); setConfirmPassword(''); }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                >
                  {loading ? 'Updating…' : 'Reset password'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          <Link href="/login" className="font-semibold text-teal-600 hover:text-teal-700 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
