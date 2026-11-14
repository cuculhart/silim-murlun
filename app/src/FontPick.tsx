import { useState } from 'react';
import {
  firstFamily,
  FONT_PRESETS,
  fontStackFor,
  missingFont,
} from './fonts';
import { useSysFonts } from './useSysFonts';
import type { TFunc } from './i18n';

/** フォント選択UI — kusuma-plava 方式（文書既定・エリア・選択範囲
    マーク・一括適用の共通部品）。推奨プリセット ＋ システムフォント
    （列挙 or プローブで取れたもの。取れない環境では静かに省略）
    ＋「カスタム…」自由入力。保存値は常に font-family スタック文字列
    （名前は既定スタックをフォールバックに連結） */
export function FontPick({
  value,
  onPick,
  t,
  placeholder,
  disabled,
  className,
}: {
  /** 現在値（スタック or カスタム名）。'' は未選択の表示用 */
  value: string;
  onPick: (stack: string) => void;
  t: TFunc;
  /** 先頭に出す未選択オプションのラベル（一括適用セレクト等） */
  placeholder?: string;
  disabled?: boolean;
  /** セレクト要素へ付けるクラス（既存レイアウトの幅制御用） */
  className?: string;
}) {
  const sysFonts = useSysFonts();
  // プリセットの先頭ファミリと重複する列挙名は畳む
  const presetHeads = new Set(FONT_PRESETS.map((f) => firstFamily(f.stack)));
  const extraFonts = sysFonts.filter((f) => !presetHeads.has(f));
  const presetMatch = FONT_PRESETS.some((f) => f.stack === value);
  const sysMatch = extraFonts.includes(firstFamily(value))
    ? firstFamily(value)
    : null;
  const isCustom = !!value && !presetMatch && !sysMatch;
  // セレクトの表示モード。null=値から導出（カスタム選択直後の
  // 未入力状態を保持するためのローカルモード）
  const [mode, setMode] = useState<string | null>(null);
  const [draft, setDraft] = useState(isCustom ? firstFamily(value) : '');
  const selValue = mode ?? (isCustom ? '__custom' : sysMatch ?? value);
  const customOpen = selValue === '__custom';
  const commit = () => {
    const v = draft.trim();
    if (v && fontStackFor(v) !== value) onPick(fontStackFor(v));
  };
  const missing =
    customOpen && draft.trim() !== '' && missingFont(draft);

  return (
    <>
      <select
        className={className}
        value={selValue}
        disabled={disabled}
        onChange={(e) => {
          const v = e.currentTarget.value;
          setMode(v === '__custom' ? '__custom' : null);
          if (v === '__custom') {
            if (isCustom) setDraft(firstFamily(value));
            return;
          }
          if (v === '') return;
          // プリセットはスタック、システム名は既定へ畳んだスタックで保存
          const p = FONT_PRESETS.find((f) => f.stack === v);
          onPick(p ? p.stack : fontStackFor(v));
        }}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {FONT_PRESETS.map((f) => {
          // 実体名も併記 — 同梱フォント（Noto Sans JP 等）が
          // 「ゴシック」ラベルの裏に隠れて選べない/分からないのを防ぐ。
          // 汎用ファミリ（sans-serif 等）はラベルと同義なので併記しない
          const head = firstFamily(f.stack);
          const text =
            head.toLowerCase() === f.label.toLowerCase()
              ? f.label
              : `${f.label}（${head}）`;
          return (
            <option key={f.key} value={f.stack} style={{ fontFamily: f.stack }}>
              {text}
            </option>
          );
        })}
        {extraFonts.map((f) => (
          <option key={f} value={f} style={{ fontFamily: f }}>
            {f}
          </option>
        ))}
        <option value="__custom">{t('font.custom')}</option>
      </select>
      {customOpen && (
        <>
          <input
            value={draft}
            placeholder={t('font.customPh')}
            disabled={disabled}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
            }}
          />
          {missing && (
            <span className="dim" title={t('font.missing')}>
              ⚠
            </span>
          )}
        </>
      )}
    </>
  );
}
