// テキスト計測: canvas measureText による実寸（96dpi）計測。
// spike index.html の fitText を inimbal の TextMeasurer IF に移植。
// 行分割の判断（空白切り・強制切断・禁則前倒し）は inimbal の
// fitText へ委譲し、ここではラン別の幅・字サイズ計測だけを担当する。
// slices の join === text を保つため、常に「収まる接頭辞長」を返す。
// box.marks（部分装飾）があるとラン境界で ctx.font を切替え、
// 行高さは行内の最大 fontSize で計る。

import { fitText, sliceRuns, type TextAttrs } from 'inimbal';
import type { KinsokuMode, TextMeasurer } from 'inimbal';
import { LINE_HEIGHT, MM_PX } from './types';

function fontStr(a: TextAttrs): string {
  const px = (a.fontSize ?? 4) * MM_PX;
  return `${a.italic ? 'italic ' : ''}${a.bold ? 'bold ' : ''}${px}px ${a.fontFamily ?? 'sans-serif'}`;
}

/** v0.11: kinsoku（文書設定）は閉包で保持 — 変更時は作り直す */
export function createCanvasMeasurer(kinsoku?: KinsokuMode): TextMeasurer {
  const ctx = document.createElement('canvas').getContext('2d')!;
  return {
    fit(text, box) {
      const base: TextAttrs = {
        fontSize: box.fontSize ?? 4,
        fontFamily: box.fontFamily ?? 'sans-serif',
        bold: box.bold,
        italic: box.italic,
      };
      // ラン境界（text 先頭基準）。marks は chain 座標なので textOffset で変換
      const segs = sliceRuns(text, box.marks, box.textOffset ?? 0, base).map(
        (r) => ({ text: r.text, attrs: r.attrs }),
      );
      const rb: { s: number; e: number; attrs: TextAttrs }[] = [];
      {
        let a = 0;
        for (const r of segs) {
          rb.push({ s: a, e: a + r.text.length, attrs: r.attrs });
          a += r.text.length;
        }
      }
      const runAt = (i: number) => {
        for (const r of rb) if (i < r.e) return r;
        return rb[rb.length - 1];
      };
      const widthOf = (s: number, e: number) => {
        let w = 0;
        for (const r of rb) {
          if (r.e <= s) continue;
          if (r.s >= e) break;
          ctx.font = fontStr(r.attrs);
          w += ctx.measureText(
            text.slice(Math.max(s, r.s), Math.min(e, r.e)),
          ).width;
        }
        return w;
      };
      const maxPxIn = (s: number, e: number) => {
        let m = base.fontSize! * MM_PX;
        for (const r of rb) {
          if (r.e <= s) continue;
          if (r.s >= e) break;
          m = Math.max(m, (r.attrs.fontSize ?? 4) * MM_PX);
        }
        return m;
      };

      return fitText(
        text,
        box.width * MM_PX,
        box.height * MM_PX,
        {
          widthOf,
          sizeAt: (i) => (runAt(i).attrs.fontSize ?? 4) * MM_PX,
          maxSizeIn: maxPxIn,
        },
        { lineHeight: LINE_HEIGHT, kinsoku },
      );
    },
  };
}
