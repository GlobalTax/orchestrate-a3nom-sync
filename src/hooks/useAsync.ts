import { useState, useEffect, useCallback } from "react";

export interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

/**
 * Custom hook for managing async operations
 */
export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  immediate = true
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    isLoading: immediate,
    isSuccess: false,
    isError: false,
  });

  const execute = useCallback(async () => {
    setState({
      data: null,
      error: null,
      isLoading: true,
      isSuccess: false,
      isError: false,
    });

    try {
      const response = await asyncFunction();
      setState({
        data: response,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
      });
      return response;
    } catch (error) {
      setState({
        data: null,
        error: error as Error,
        isLoading: false,
        isSuccess: false,
        isError: true,
      });
      throw error;
    }
  }, [asyncFunction]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { ...state, execute };
}
