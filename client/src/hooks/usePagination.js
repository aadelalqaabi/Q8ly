import { useState, useCallback } from 'react';

/**
 * Generic pagination hook for FlatList infinite scroll.
 *
 * @param {Function} fetchFn - Async function that accepts (page, ...args) and returns { data, hasMore }
 * @param {any[]} args - Additional args passed to fetchFn
 */
export const usePagination = (fetchFn, args = []) => {
  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (p = 1) => {
    if (p === 1) setIsLoading(true);
    else setIsLoadingMore(true);
    setError(null);

    try {
      const result = await fetchFn(p, ...args);
      if (p === 1) setData(result.data);
      else setData((prev) => [...prev, ...result.data]);
      setHasMore(result.hasMore);
      setPage(p);
    } catch (e) {
      setError(e.message || 'An error occurred');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [fetchFn, ...args]);

  const refresh = useCallback(() => load(1), [load]);

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) load(page + 1);
  }, [isLoadingMore, hasMore, load, page]);

  return { data, isLoading, isLoadingMore, hasMore, error, refresh, loadMore };
};

export default usePagination;
