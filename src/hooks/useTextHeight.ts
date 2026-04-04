import { useMemo } from 'react';
import { prepare, layout } from '@chenglou/pretext';

/**
 * Helper to measure text height using Pretext
 */
export const useTextHeight = (text: string, font: string, width: number, lineHeight: number, extraPadding = 0) => {
  return useMemo(() => {
    if (!text || width <= 0) return 0;
    try {
      const prepared = prepare(text, font, { whiteSpace: 'pre-wrap' });
      const { height } = layout(prepared, width, lineHeight);
      return height + extraPadding;
    } catch (e) {
      console.warn('Pretext layout failed:', e);
      return 0;
    }
  }, [text, font, width, lineHeight, extraPadding]);
};
