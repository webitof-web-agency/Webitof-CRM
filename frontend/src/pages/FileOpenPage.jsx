import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, API_BASE_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';

// Opens a file referenced by a file id or the Drive id of an older upload. The API's view routes
// only serve Drive-id references for public assets, so the signed-in user's session is used to
// look up the file's own view link first.
export function FileOpenPage() {
  const { ref } = useParams();
  const { token } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.files.link(token, ref)
      .then((response) => {
        if (cancelled) return;
        const viewUrl = response?.data?.viewUrl;
        if (!viewUrl) throw new Error('File not found');
        window.location.replace(`${API_BASE_URL}${viewUrl}`);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'This file could not be opened');
      });
    return () => {
      cancelled = true;
    };
  }, [token, ref]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-6 text-sm text-[var(--text-muted)]">
      {error ? (
        <p role="alert" className="text-[var(--danger,#dc2626)]">{error}</p>
      ) : (
        <p role="status">Opening file…</p>
      )}
    </div>
  );
}
