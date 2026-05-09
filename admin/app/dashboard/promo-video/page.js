'use client';

import { useState, useEffect, useRef } from 'react';
import { apiJSON, apiFetch, getToken } from '../../../lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function PromoVideoPage() {
  const [current, setCurrent] = useState(null);   // { video_url, updated_at } | null
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);     // 0-100 upload progress
  const inputRef = useRef(null);

  function load() {
    setLoading(true);
    apiJSON('/admin/promo-video').then((data) => setCurrent(data)).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function uploadFile(file) {
    if (!file) return;
    const allowed = ['video/mp4', 'video/quicktime', 'video/webm'];
    if (!allowed.includes(file.type)) {
      setUploadError('Only MP4, MOV, or WebM files are accepted.');
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      setUploadError('File exceeds 200 MB limit.');
      return;
    }

    setUploading(true); setUploadError(''); setProgress(0);

    try {
      const fd = new FormData();
      fd.append('video', file);
      const token = getToken();

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE}/admin/promo-video/upload`);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            try { reject(new Error(JSON.parse(xhr.responseText).error || `Upload failed (${xhr.status})`)); }
            catch { reject(new Error(`Upload failed (${xhr.status})`)); }
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(fd);
      });

      load();
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false); setProgress(0);
    }
  }

  async function handleDelete() {
    if (!confirm('Remove the current promotional video? This will delete it from storage.')) return;
    setDeleting(true);
    try {
      await apiFetch('/admin/promo-video', { method: 'DELETE' });
      setCurrent(null);
    } catch { /* ignore */ } finally { setDeleting(false); }
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    uploadFile(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-nunito, sans-serif)' }}>
          Promotional Video
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Shown in the "How it works" screen on the app. One video at a time — uploading a new one replaces the current.
        </p>
      </div>

      {/* Specs hint */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3.5">
        <svg className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-sm text-blue-800 leading-relaxed space-y-0.5">
          <p className="font-semibold">Recommended video specs for smooth playback</p>
          <ul className="text-xs text-blue-700 space-y-0.5 mt-1">
            <li>• Format: <strong>MP4 (H.264)</strong> — widest device compatibility</li>
            <li>• Resolution: <strong>1080p (1920×1080)</strong> or 720p (1280×720)</li>
            <li>• Bitrate: <strong>2–4 Mbps</strong> — good quality, fast to start</li>
            <li>• Duration: <strong>30–90 seconds</strong> recommended</li>
            <li>• Max file size: <strong>200 MB</strong></li>
          </ul>
        </div>
      </div>

      {/* Current video */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center text-slate-400 text-sm animate-pulse">
          Loading…
        </div>
      ) : current ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-800 text-sm">Current video</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Last updated {new Date(current.updated_at).toLocaleString()}
              </p>
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold transition-colors disabled:opacity-50">
              {deleting ? 'Removing…' : 'Remove video'}
            </button>
          </div>
          <div className="p-5">
            {/* HTML5 video preview — no controls, muted, no autoplay in admin (admin should review it) */}
            <video
              src={current.video_url}
              controls
              className="w-full rounded-xl bg-black"
              style={{ maxHeight: 360 }}
            />
            <p className="mt-3 text-xs text-slate-400 break-all">{current.video_url}</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
          <p className="text-slate-400 text-sm">No promotional video set yet.</p>
          <p className="text-slate-300 text-xs mt-1">Upload one below — it will appear in the app immediately.</p>
        </div>
      )}

      {/* Upload area */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <p className="font-semibold text-slate-800 text-sm">
          {current ? 'Replace video' : 'Upload video'}
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors py-12 px-6
            ${uploading ? 'cursor-default' : ''}
            ${dragOver ? 'border-teal-400 bg-teal-50' : 'border-slate-200 bg-slate-50 hover:border-teal-300 hover:bg-teal-50/40'}`}>

          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={(e) => uploadFile(e.target.files?.[0])}
          />

          {uploading ? (
            <div className="w-full max-w-xs space-y-3 text-center">
              <div className="flex items-center gap-2 justify-center">
                <svg className="w-5 h-5 text-teal-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm text-slate-600 font-medium">Uploading… {progress}%</p>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-teal-500 h-2 rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-400">Please don't close this page</p>
            </div>
          ) : (
            <>
              <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M15 10l4.553-2.07A1 1 0 0121 8.845v6.31a1 1 0 01-1.447.894L15 14M4 8a2 2 0 012-2h9a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" />
              </svg>
              <div className="text-center">
                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-teal-600">Click to browse</span> or drag & drop
                </p>
                <p className="text-xs text-slate-400 mt-1">MP4, MOV, WebM · max 200 MB</p>
              </div>
            </>
          )}
        </div>

        {uploadError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
            {uploadError}
          </p>
        )}
      </div>
    </div>
  );
}
