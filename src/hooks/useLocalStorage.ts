import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";

/**
 * Custom hook for managing state in localStorage
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  // Get from localStorage or use initial value
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      logger.error('useLocalStorage', `Error loading localStorage key "${key}"`, error);
      return initialValue;
    }
  });

  // Update localStorage when value changes
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      logger.error('useLocalStorage', `Error setting localStorage key "${key}"`, error);
    }
  };

  // Remove from localStorage
  const removeValue = () => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      logger.error('useLocalStorage', `Error removing localStorage key "${key}"`, error);
    }
  };

  return [storedValue, setValue, removeValue];
}
