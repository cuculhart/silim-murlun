// 連鎖編集ペイン — 右ペインの連鎖テキスト欄。
// 編集対象は常に連鎖テキスト1本（エリア内直接編集は持たない）。
// IME 確定・キャレット維持・順序崩れの問題が構造的に消える設計。

import type { Chain } from 'inimbal';
import type { TextAreaData } from './types';
import { FONT_FAMILIES, FONT_SIZES_MM } from './types';

export function ChainPane({
  chain,
  /** ペインを開いたエリア（フォント等はこのエリア単位） */
  areaData,
  overflow,
  onText,
  onAreaData,
  onClose,
}: {
  chain: Chain;
  areaData: TextAreaData | null;
  overflow: string;
  onText: (text: string) => void;
  onAreaData: (patch: Partial<TextAreaData>) => void;
  onClose: () => void;
}) {
  return (
    <aside className="chain-pane">
      <header>
        <span>連鎖テキスト（{chain.areas.length}エリア）</span>
        <button onClick={onClose} title="閉じる">
          ×
        </button>
      </header>
      <textarea
        className="chain-text"
        value={chain.text}
        spellCheck={false}
        placeholder="ここに連鎖テキスト全体を入力…"
        onChange={(e) => onText(e.currentTarget.value)}
      />
      {overflow && (
        <div className="chain-overflow">
          あふれ {overflow.length}字 「{overflow.replace(/\n/g, '⏎').slice(0, 14)}
          …」
        </div>
      )}
      {areaData && (
        <div className="chain-font">
          <label>
            フォント
            <select
              value={areaData.fontFamily}
              onChange={(e) =>
                onAreaData({ fontFamily: e.currentTarget.value })
              }
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            サイズ
            <select
              value={areaData.fontSize}
              onChange={(e) =>
                onAreaData({ fontSize: Number(e.currentTarget.value) })
              }
            >
              {FONT_SIZES_MM.map((s) => (
                <option key={s} value={s}>
                  {s}mm
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <footer className="chain-links">
        {chain.areas.length > 1
          ? `${chain.areas.join(' → ')}`
          : 'リンクなし（リンクモードで2エリアを接続）'}
      </footer>
    </aside>
  );
}
