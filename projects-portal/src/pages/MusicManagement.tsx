import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Music2,
  Plus,
  Pencil,
  Trash2,
  Play,
  Pause,
  Upload,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import apiClient from '../services/apiClient';

const TARGET_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: 'app-background', label: 'App background', hint: 'Loop while browsing (Settings toggle in the app).' },
  { value: 'game-strength', label: 'Strength game', hint: 'Used when the strength modal is open (if wired in app).' },
  { value: 'onboarding', label: 'Onboarding', hint: 'Onboarding flow.' },
  { value: 'lesson-complete', label: 'Lesson complete', hint: 'Lesson completion moment.' },
  { value: 'achievement', label: 'Achievement', hint: 'Achievement unlocked.' },
  { value: 'coin-reward', label: 'Coin reward', hint: 'Coin reward SFX.' },
  { value: 'level-up', label: 'Level up', hint: 'Level up celebration.' },
  { value: 'menu', label: 'Menu / navigation', hint: 'Menu navigation ambiance.' },
];

interface MusicDoc {
  _id: string;
  target: string;
  name: string;
  description?: string;
  audioUrl: string;
  originalFilename?: string;
  defaultVolume?: number;
  loop?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const emptyForm = () => ({
  target: 'app-background',
  name: '',
  description: '',
  audioUrl: '',
  defaultVolume: 0.35,
  loop: true,
  isActive: true,
});

const MusicManagement: React.FC = () => {
  const [tracks, setTracks] = useState<MusicDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MusicDoc | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchTracks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<MusicDoc[]>('/api/music');
      setTracks(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      alert('Failed to load app music. Check API / auth.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFile(null);
    setModalOpen(true);
  };

  const openEdit = (t: MusicDoc) => {
    setEditing(t);
    setForm({
      target: t.target,
      name: t.name,
      description: t.description || '',
      audioUrl: t.audioUrl,
      defaultVolume: typeof t.defaultVolume === 'number' ? t.defaultVolume : 0.35,
      loop: t.loop !== false,
      isActive: t.isActive !== false,
    });
    setFile(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setFile(null);
  };

  const fileToBase64 = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });

  const handleSave = async () => {
    if (!form.target.trim() || !form.name.trim()) {
      alert('Target and name are required.');
      return;
    }
    if (!editing && !file && !form.audioUrl.trim()) {
      alert('Add an audio file or paste an audio URL.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        target: form.target,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        audioUrl: file ? undefined : form.audioUrl.trim() || undefined,
        defaultVolume: Number(form.defaultVolume),
        loop: form.loop,
        isActive: form.isActive,
      };
      if (file) {
        payload.audioBase64 = await fileToBase64(file);
        payload.filename = file.name;
      }

      if (editing) {
        await apiClient.put(`/api/music/${editing._id}`, payload);
      } else {
        await apiClient.post('/api/music', payload);
      }
      await fetchTracks();
      closeModal();
    } catch (err: unknown) {
      console.error(err);
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: MusicDoc) => {
    if (!confirm(`Delete music for "${t.target}" (${t.name})?`)) return;
    try {
      await apiClient.delete(`/api/music/${t._id}`);
      await fetchTracks();
    } catch (e) {
      console.error(e);
      alert('Delete failed');
    }
  };

  const togglePlay = (t: MusicDoc) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (playingId === t._id) {
      setPlayingId(null);
      return;
    }
    const a = new Audio(t.audioUrl);
    audioRef.current = a;
    a.play().catch(() => alert('Could not play (CORS or blocked autoplay). Open URL in a new tab.'));
    setPlayingId(t._id);
    a.onended = () => setPlayingId(null);
  };

  const targetLabel = (target: string) =>
    TARGET_OPTIONS.find((o) => o.value === target)?.label || target;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Music2 className="w-7 h-7 text-indigo-600" />
            App &amp; UI music
          </h1>
          <p className="text-gray-600 text-sm mt-1 max-w-xl">
            Configure loops and cues used by the mobile app (separate from the Devotional &quot;Story Music Library&quot;).
            The <strong>app-background</strong> track is what users can enable under Settings → Background music.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fetchTracks()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            Add / replace by target
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500 py-12 text-center">Loading…</div>
      ) : tracks.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-900">
          <p className="font-medium">No app music documents yet.</p>
          <p className="text-sm mt-2">
            Add at least <code className="bg-amber-100 px-1 rounded">app-background</code> so the app can download a loop
            from <code className="bg-amber-100 px-1 rounded">GET /api/music/active</code>.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-3 font-semibold text-gray-700">Target</th>
                <th className="text-left p-3 font-semibold text-gray-700">Name</th>
                <th className="text-center p-3 font-semibold text-gray-700">Active</th>
                <th className="text-center p-3 font-semibold text-gray-700">Loop</th>
                <th className="text-center p-3 font-semibold text-gray-700">Vol</th>
                <th className="text-right p-3 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((t) => (
                <tr key={t._id} className="border-b border-gray-100 hover:bg-gray-50/80">
                  <td className="p-3">
                    <div className="font-mono text-xs text-indigo-700">{t.target}</div>
                    <div className="text-gray-500 text-xs">{targetLabel(t.target)}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-gray-900">{t.name}</div>
                    {t.description && <div className="text-gray-500 text-xs line-clamp-2">{t.description}</div>}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {t.isActive !== false ? 'On' : 'Off'}
                    </span>
                  </td>
                  <td className="p-3 text-center text-gray-700">{t.loop !== false ? 'Yes' : 'No'}</td>
                  <td className="p-3 text-center text-gray-700">
                    {typeof t.defaultVolume === 'number' ? t.defaultVolume.toFixed(2) : '—'}
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => togglePlay(t)}
                        className="p-2 rounded-lg hover:bg-gray-200 text-gray-700"
                        title="Preview"
                      >
                        {playingId === t._id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <a
                        href={t.audioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg hover:bg-gray-200 text-gray-700"
                        title="Open URL"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="p-2 rounded-lg hover:bg-gray-200 text-gray-700"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(t)}
                        className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">
                {editing ? 'Edit track' : 'Add track (one per target)'}
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                Upload an MP3/WAV or paste a hosted URL. Saving upserts by <strong>target</strong> when creating.
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target</label>
                <select
                  value={form.target}
                  disabled={!!editing}
                  onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100"
                >
                  {TARGET_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label} ({o.value})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {TARGET_OPTIONS.find((o) => o.value === form.target)?.hint}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="e.g. Soft morning loop"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Audio file</label>
                <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg py-4 hover:border-indigo-400 hover:bg-indigo-50/50"
                >
                  <Upload className="w-5 h-5 text-gray-500" />
                  {file ? file.name : 'Choose file (optional if URL below)'}
                </button>
                {file && (
                  <button type="button" className="text-xs text-red-600 mt-1" onClick={() => setFile(null)}>
                    Remove file
                  </button>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Or audio URL</label>
                <input
                  type="url"
                  value={form.audioUrl}
                  onChange={(e) => setForm((f) => ({ ...f, audioUrl: e.target.value }))}
                  disabled={!!file}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100"
                  placeholder="https://..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default volume</label>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={form.defaultVolume}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, defaultVolume: Math.min(1, Math.max(0, Number(e.target.value))) }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div className="flex flex-col justify-end gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.loop}
                      onChange={(e) => setForm((f) => ({ ...f, loop: e.target.checked }))}
                    />
                    <span className="text-sm text-gray-800">Loop</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    />
                    <span className="text-sm text-gray-800">Active (served to app)</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-2 bg-gray-50">
              <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MusicManagement;
