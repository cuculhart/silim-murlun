// テキスト計測: canvas measureText による実寸（96dpi）計測。
// spike index.html の fitText を inimbal の TextMeasurer IF に移植。
// 英単語は空白で折り返し、日本語等は文字単位で強制切断。
// slices の join === text を保つため、常に「収まる接頭辞長」を返す。

import type { TextMeasurer } from 'inimbal';
import { LINE_HEIGHT, MM_PX } from './types';

export function createCanvasMeasurer(): TextMeasurer {
  const ctx = document.createElement('canvas').getContext('2d')!;
  return {
    fit(text, box) {
      const fpx = (box.fontSize ?? 4) * MM_PX;
      ctx.font = `${box.italic ? 'italic ' : ''}${box.bold ? 'bold ' : ''}${fpx}px ${box.fontFamily ?? 'sans-serif'}`;
      const maxW = box.width * MM_PX;
      const maxLines = Math.max(
        1,
        Math.floor((box.height * MM_PX) / (fpx * LINE_HEIGHT)),
      );
      let pos = 0;
      let lineStart = 0;
      let lines = 0;
      while (pos < text.length && lines < maxLines) {
        const ch = text[pos];
        if (ch === '\n') {
          lines++;
          pos++;
          lineStart = pos;
          continue;
        }
        if (ctx.measureText(text.slice(lineStart, pos + 1)).width <= maxW) {
          pos++;
          continue;
        }
        if (pos === lineStart) {
          pos++; // 1字でも幅超過 → 強制進行
          continue;
        }
        // 直前の空白で切る（空白は前行末へ残す）
        const sp = text.lastIndexOf(' ', pos);
        pos = sp >= lineStart ? sp + 1 : pos;
        lineStart = pos;
        lines++;
      }
      return pos;
    },
  };
}
