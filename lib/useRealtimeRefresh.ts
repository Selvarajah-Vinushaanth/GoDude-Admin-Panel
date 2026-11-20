'use client';

import { useEffect, useRef } from 'react';

export interface RealtimeSyncEvent {
  type: string;
  changed: string[];
  alerts?: {
    pendingRestaurants: number;
    unverifiedRiders: number;
  };
}

export function useRealtimeRefresh(
  sections: string[],
  onChange: (event: RealtimeSyncEvent) => void
) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const sectionsKey = sections.join(',');

  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }

    const wanted = new Set(sectionsKey.split(',').filter(Boolean));
    const source = new EventSource('/api/realtime/stream');

    source.onmessage = (evt) => {
      try {
        const parsed = JSON.parse(evt.data) as RealtimeSyncEvent;
        if (parsed.type === 'sync') {
          if (
            wanted.size === 0 ||
            parsed.changed.some((c) => wanted.has(c))
          ) {
            onChangeRef.current(parsed);
          }
        }
      } catch {
        // Ignore malformed frame
      }
    };

    return () => {
      source.close();
    };
  }, [sectionsKey]);
}
