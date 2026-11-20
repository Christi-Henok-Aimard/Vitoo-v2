import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { errorMessage } from '../api';

export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fn, deps);

  const run = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await load();
      setData(result);
      return result;
    } catch (err) {
      setError(errorMessage(err));
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void run();
  }, [run]);

  return { data, setData, loading, error, reload: run };
}

export function usePolling(callback: () => unknown | Promise<unknown>, intervalMs: number, enabled = true) {
  const ref = useRef(callback);
  useEffect(() => {
    ref.current = callback;
  }, [callback]);
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => { void ref.current(); }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled]);
}
