// 連鎖編集ペイン — 右ペインの連鎖テキスト欄。
// 編集対象は常に連鎖テキスト1本（エリア内直接編集は持たない）。
// IME 確定・キャレット維持・順序崩れの問題が構造的に消える設計。

import type { Chain } from 'inimbal';
import type { TFunc } from './i18n';
import { tf } from './i18n';
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
  t,
}: {
  chain: Chain;
  areaData: TextAreaData | null;
  overflow: string;
  onText: (text: string) => void;
  onAreaData: (patch: Partial<TextAreaData>) => void;
  onClose: () => void;
  t: TFunc;
}) {
  return (
    <aside className="chain-pane">
      <header>
        <span>{tf(t, 'chain.title', chain.areas.length)}</span>
        <button onClick={onClose} title={t('chain.close')}>
          ×
        </button>
      </header>
      <textarea
        className="chain-text"
        value={chain.text}
        spellCheck={false}
        placeholder={t('chain.placeholder')}
        onChange={(e) => onText(e.currentTarget.value)}
      />
      {overflow && (
        <div className="chain-overflow">
          {tf(
            t,
            'chain.overflow',
            overflow.length,
            overflow.replace(/\n/g, '⏎').slice(0, 14),
          )}
        </div>
      )}
      {areaData && (
        <div className="chain-font">
          <label>
            {t('chain.font')}
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
            {t('chain.size')}
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
          <label>
            {t('font.color')}
            <input
              type="color"
              value={areaData.color ?? '#222222'}
              onChange={(e) => onAreaData({ color: e.currentTarget.value })}
            />
          </label>
          <label>
            B
            <input
              type="checkbox"
              checked={!!areaData.bold}
              onChange={(e) => onAreaData({ bold: e.currentTarget.checked })}
            />
          </label>
          <label>
            I
            <input
              type="checkbox"
              checked={!!areaData.italic}
              onChange={(e) => onAreaData({ italic: e.currentTarget.checked })}
            />
          </label>
          <label>
            U
            <input
              type="checkbox"
              checked={!!areaData.underline}
              onChange={(e) =>
                onAreaData({ underline: e.currentTarget.checked })
              }
            />
          </label>
        </div>
      )}
      <footer className="chain-links">
        {chain.areas.length > 1
          ? `${chain.areas.join(' → ')}`
          : t('chain.nolink')}
      </footer>
    </aside>
  );
}
