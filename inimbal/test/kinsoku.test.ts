import { describe, expect, it } from 'vitest';
import {
  fitLines,
  fitText,
  isEndKinsoku,
  isHangKinsoku,
  isHeadKinsoku,
  kinsokuBreak,
  lineRanges,
  type KinsokuMode,
} from '../src/kinsoku';

// テスト用計測: 幅 = 1字あたり1、行高さ = 1（全字均一）。
// 「収まる接頭辞長」と「行の切れ目」だけを検証する。
const MET = {
  widthOf: (s: number, e: number) => e - s,
  sizeAt: () => 1,
  maxSizeIn: () => 1,
};

/** 幅 w 字・高さ1行の箱へ流し込み、収まる接頭辞長を返す。
    返り値 - 1行目の終端 = 次行頭の位置（禁則の効果を直接見る） */
const fit1 = (text: string, w: number, kinsoku?: KinsokuMode) =>
  fitText(text, w, 1.4, MET, { lineHeight: 1.4, kinsoku });

describe('禁則字種表', () => {
  it('行頭禁則: 句読点・閉じ括弧・長音。行末禁則: 開き括弧・ハイフン', () => {
    for (const ch of '。、！？」』ー…っ') expect(isHeadKinsoku(ch)).toBe(true);
    expect(isHeadKinsoku('あ')).toBe(false);
    expect(isHeadKinsoku('「')).toBe(false);
    for (const ch of '（「『([{') expect(isEndKinsoku(ch)).toBe(true);
    expect(isEndKinsoku('-')).toBe(true);
    expect(isEndKinsoku('あ')).toBe(false);
    expect(isEndKinsoku('」')).toBe(false);
  });
});

describe('kinsokuBreak — 追い出しの分割点前倒し', () => {
  it('次行頭が行頭禁則なら1字前倒し', () => {
    // 「あいう|、え」→「あい|う、え」
    expect(kinsokuBreak('あいう、え', 0, 3)).toBe(2);
  });

  it('前行末が行末禁則なら1字前倒し', () => {
    // 「あい「|う」→「あい|「う」
    expect(kinsokuBreak('あい「う」', 0, 3)).toBe(2);
  });

  it('禁則でなければ分割点はそのまま', () => {
    expect(kinsokuBreak('あいうえお', 0, 3)).toBe(3);
  });

  it('前倒しは最大2字 — 3字目の違反は残る（フォールバック）', () => {
    // 「あい。|、、お」…「あ|い。、、お」と3字倒す必要があるが
    // 2字まで →「あい|。、、お」（行頭の。は残る）
    expect(kinsokuBreak('あい。、、お', 0, 4)).toBe(2);
  });

  it('現行に最低1字は残す（行を空にする前倒しはしない）', () => {
    // 「あ|、」…1字しかない行からは前倒しできず、
    // 、の行頭はやむなし
    expect(kinsokuBreak('あ、', 0, 1)).toBe(1);
  });
});

describe('fitText + 禁則（追い出し）', () => {
  it('、。が行頭に来ない', () => {
    // 幅3字の箱 — 素直なら1行目は「あいう」で2行目が「、」始まり。
    // oidashi では1字前倒しして「あい」となり「う、」が次行へ
    expect(fit1('あいう、えお', 3, 'oidashi')).toBe(2);
    // 直後の行境界でも同じ規則が効く（2行目以降も）
    const rest = 'う、えおかきくけこさしす';
    expect(fit1(rest, 3, 'oidashi')).toBe(3); // 「う、え」
    expect(fit1(rest.slice(3), 3, 'oidashi')).toBe(3); // 「おかき」
  });

  it('「」が行跨ぎしない（開き括弧は行末に残らない）', () => {
    // 「あい「|う」→ 前行末の「が行末禁則 →「あい|「う」へ前倒し
    expect(fit1('あい「う」えお', 3, 'oidashi')).toBe(2);
  });

  it('kinsoku 未指定は従来動作（、が行頭に来うる）', () => {
    // 前倒しが入らず「あいう」で切れる → 2行目は「、」始まり
    expect(fit1('あいう、えおかき', 3)).toBe(3);
    expect(fit1('あいう、えおかき', 3, undefined)).toBe(3);
  });

  it('空白切りの欧文折り返しは従来どおり（空白は前行末へ残す）', () => {
    expect(fit1('aa bb cc', 4, 'oidashi')).toBe(3); // 'aa '
  });

  it('行高さ超過の打ち切りは従来どおり（2行目が入らなければ1行目で切る）', () => {
    // 幅2字・高さ1行 → 先頭2字のみ収まる
    expect(fit1('あいうえお', 2)).toBe(2);
    // \n 行送り×2 → 2行目の \n で高さ超過となりその行頭で打ち切り
    expect(fit1('あ\nい\nう', 9)).toBe(2);
  });
});

describe('ぶら下げ（burasage）', () => {
  it('ぶら下げ対象は句読点類のみ', () => {
    for (const ch of '。、．，｡､') expect(isHangKinsoku(ch)).toBe(true);
    expect(isHangKinsoku('」')).toBe(false);
    expect(isHangKinsoku('っ')).toBe(false);
    expect(isHangKinsoku('あ')).toBe(false);
  });

  it('、が行の規定幅へ1字はみ出す', () => {
    // 幅3字 — 、をはみ出して「あいう、」が1行目。高さ1行なので
    // 2行目「えおか」の次の折返しで打ち切り → 接頭辞は4字ぶん
    expect(fit1('あいう、えおかき', 3, 'burasage')).toBe(4);
  });

  it('はみ出しは原則1字 — 連続句読点は前倒しでまとめて次行へ', () => {
    // 、をはみ出しても直後の。が来る → 追い出し側の前倒しで
    // 「う、。」が次行へ送られる（接頭辞は「あい」の2字）
    expect(fit1('あいう、。えお', 3, 'burasage')).toBe(2);
  });

  it('対象外の行頭禁則字は追い出しと同じく次行へ送る', () => {
    // 」・っ はぶら下げ対象外 → oidashi と同じ前倒し
    expect(fit1('あいう」えお', 3, 'burasage')).toBe(2);
    expect(fit1('あいうっえお', 3, 'burasage')).toBe(2);
  });

  it('oidashi ははみ出さない（回帰確認）', () => {
    expect(fit1('あいう、えお', 3, 'oidashi')).toBe(2);
  });
});

describe('fitLines — 行の区切り位置', () => {
  it('折返し位置を breaks として返す', () => {
    // 幅3字・高さ2行 — burasage で「あいう、」「えお」の2行
    const r = fitLines('あいう、えお', 3, 2.8, MET, {
      lineHeight: 1.4,
      kinsoku: 'burasage',
    });
    expect(r).toEqual({ n: 6, breaks: [4] });
  });

  it('改行も区切りとして返す', () => {
    const r = fitLines('あ\nい', 9, 9, MET, { lineHeight: 1.4 });
    expect(r).toEqual({ n: 3, breaks: [2] });
  });

  it('lineRanges が行区間を返す（描画の行分割と同じ座標系）', () => {
    const text = 'あいう、えお';
    const ranges = lineRanges(text, [4]);
    expect(ranges.map(([s, e]) => text.slice(s, e))).toEqual([
      'あいう、',
      'えお',
    ]);
    // breaks なし = 全体が1区間（自由折返しフォールバック）
    expect(lineRanges(text, undefined)).toEqual([[0, text.length]]);
  });
});
