import { describe, expect, it } from 'vitest';
import {
  canLink,
  chainOf,
  insertArea,
  layoutChain,
  linkChains,
  pruneChains,
  removeArea,
  unlinkAt,
  type Chain,
} from '../src/chain';

// テスト用計測: 幅 = 1行あたり文字数、高さ = 行数。
// 「収まる接頭辞長」を返す契約だけを検証する。
const meas = {
  fit: (t: string, b: { width: number; height: number }) =>
    Math.min(t.length, Math.floor(b.width) * Math.max(1, Math.floor(b.height))),
};

describe('layoutChain', () => {
  it('貪欲配分 — fit→rest→次エリア、残りは overflow', () => {
    const r = layoutChain(
      'abcdefghij',
      [
        { id: 'a', width: 3, height: 2 },
        { id: 'b', width: 3, height: 1 },
      ],
      meas,
    );
    expect(r.slices).toEqual([
      { areaId: 'a', text: 'abcdef' },
      { areaId: 'b', text: 'ghi' },
    ]);
    expect(r.overflow).toBe('j');
  });

  it('slices は chain text の厳密な分割（join === text）', () => {
    const text = 'hello world — 途中で切れても全体は保存される';
    const r = layoutChain(text, [{ id: 'a', width: 5, height: 1 }], meas);
    expect(r.slices[0].text + r.overflow).toBe(text);
  });

  it('空エリア列なら全文が overflow', () => {
    const r = layoutChain('abc', [], meas);
    expect(r.slices).toEqual([]);
    expect(r.overflow).toBe('abc');
  });
});

describe('link — 一方通行・線形のみ', () => {
  const two: Chain[] = [
    { id: 'c1', areas: ['a1', 'a2'], text: 'x' },
    { id: 'c2', areas: ['b1'], text: 'y' },
  ];

  it('末尾 → 別連鎖の先頭のみ可', () => {
    expect(canLink(two, 'a2', 'b1')).toBe(true);
    expect(canLink(two, 'a1', 'b1')).toBe(false); // 末尾でない
    expect(canLink(two, 'a2', 'a1')).toBe(false); // 同一連鎖（循環）
    expect(canLink(two, 'zz', 'b1')).toBe(false); // 未所属
  });

  it('linkChains: 連鎖が結合しテキストが連結される', () => {
    const out = linkChains(two, 'a2', 'b1');
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('c1');
    expect(out[0].areas).toEqual(['a1', 'a2', 'b1']);
    expect(out[0].text).toBe('x\ny');
    expect(chainOf(out, 'b1')!.id).toBe('c1');
  });

  it('1→複数 は出せない: 併合後は中間エリアから接続不可', () => {
    const three: Chain[] = [
      ...two,
      { id: 'c3', areas: ['d1'], text: 'z' },
    ];
    const linked = linkChains(three, 'a2', 'b1'); // [a1,a2,b1]
    expect(canLink(linked, 'a2', 'd1')).toBe(false); // a2 はもう末尾ではない
    expect(canLink(linked, 'b1', 'd1')).toBe(true); // 新末尾からは可
  });

  it('複数→1 は出せない: 併合済みの先頭は受け付けない', () => {
    const three: Chain[] = [
      ...two,
      { id: 'c3', areas: ['d1'], text: 'z' },
    ];
    const linked = linkChains(three, 'a2', 'b1'); // [a1,a2,b1]
    // b1 は連鎖の中間。別連鎖の末尾から指しても不可
    expect(canLink(linked, 'd1', 'b1')).toBe(false);
  });

  it('循環は出せない: 1→2→…→末尾から先頭へは繋げない', () => {
    const linked = linkChains(two, 'a2', 'b1'); // [a1,a2,b1]
    // 末尾 b1 → 先頭 a1 は同一連鎖なので不可
    expect(canLink(linked, 'b1', 'a1')).toBe(false);
  });

  it('不可なら chains は無変更', () => {
    expect(linkChains(two, 'a1', 'b1')).toBe(two);
  });
});

describe('unlinkAt — 切断時の巻き戻し', () => {
  it('テキストは全量 head 側に残り、tail は空の新連鎖', () => {
    const out = unlinkAt(
      [{ id: 'c', areas: ['a', 'b', 'c'], text: 'xyz' }],
      'c',
      0,
      'c2',
    );
    expect(out).toEqual([
      { id: 'c', areas: ['a'], text: 'xyz' },
      { id: 'c2', areas: ['b', 'c'], text: '' },
    ]);
  });

  it('範囲外 index なら無変更', () => {
    const cs: Chain[] = [{ id: 'c', areas: ['a'], text: 'x' }];
    expect(unlinkAt(cs, 'c', 0, 'c2')).toBe(cs);
  });
});

describe('途中挿入・削除', () => {
  it('insertArea: 連鎖途中にエリアを挿入、テキスト不変', () => {
    const cs = insertArea(
      [{ id: 'c', areas: ['a', 'b'], text: 't' }],
      'c',
      1,
      'n',
    );
    expect(cs[0].areas).toEqual(['a', 'n', 'b']);
    expect(cs[0].text).toBe('t');
  });

  it('removeArea: エリアを外す。テキストは残る。空連鎖は消える', () => {
    let cs: Chain[] = [{ id: 'c', areas: ['a', 'b'], text: 't' }];
    cs = removeArea(cs, 'a');
    expect(cs[0].areas).toEqual(['b']);
    expect(cs[0].text).toBe('t');
    cs = removeArea(cs, 'b');
    expect(cs).toHaveLength(0);
  });

  it('pruneChains: 存在しないエリアを全連鎖から除去', () => {
    const cs: Chain[] = [
      { id: 'c1', areas: ['a', 'b', 'c'], text: 't1' },
      { id: 'c2', areas: ['d'], text: 't2' },
    ];
    const out = pruneChains(cs, (id) => id !== 'b' && id !== 'd');
    expect(out).toEqual([{ id: 'c1', areas: ['a', 'c'], text: 't1' }]);
  });
});
