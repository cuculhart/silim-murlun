import type { WorldObject } from '@kimetron/core';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FONT_STACK,
  DEFAULT_TEXT_DATA,
  followFontObjects,
  IMG_KIND,
  TEXT_KIND,
  type TextAreaData,
} from './types';

const LATIN =
  "'Noto Sans', 'Noto Sans JP', 'Noto Sans CJK JP', 'Hiragino Sans', 'Yu Gothic', sans-serif";
const CUSTOM = "'Hiragino Sans', sans-serif";

const ta = (id: string, d: Partial<TextAreaData>): WorldObject => ({
  id,
  kind: TEXT_KIND,
  x: 0,
  y: 0,
  w: 10,
  h: 10,
  data: { ...DEFAULT_TEXT_DATA, ...d },
});

const dataOf = (o: WorldObject) => o.data as TextAreaData;

describe('followFontObjects', () => {
  it('書式なしで旧既定のままのエリアへ新既定を反映する', () => {
    const objs = [ta('a', { fontFamily: DEFAULT_FONT_STACK })];
    const out = followFontObjects(objs, DEFAULT_FONT_STACK, LATIN);
    expect(dataOf(out[0]).fontFamily).toBe(LATIN);
  });

  it('エリア単位で書体を変えたものは温存する', () => {
    const objs = [ta('a', { fontFamily: CUSTOM })];
    const out = followFontObjects(objs, DEFAULT_FONT_STACK, LATIN);
    expect(dataOf(out[0]).fontFamily).toBe(CUSTOM);
  });

  it('書式適用中のエリアは温存する（fontFamily が旧既定と一致していても）', () => {
    const objs = [
      ta('a', { fontFamily: DEFAULT_FONT_STACK, style: 'std' }),
    ];
    const out = followFontObjects(objs, DEFAULT_FONT_STACK, LATIN);
    expect(dataOf(out[0]).fontFamily).toBe(DEFAULT_FONT_STACK);
    expect(dataOf(out[0]).style).toBe('std');
  });

  it('テキストエリア以外は触らない', () => {
    const img: WorldObject = {
      id: 'im1',
      kind: IMG_KIND,
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      data: { url: 'x', aspect: 1, lock: true },
    };
    const out = followFontObjects([img], DEFAULT_FONT_STACK, LATIN);
    expect(out[0]).toBe(img);
  });

  it('混在 — 継承エリアのみ追従し、カスタム・書式付き・非テキストは維持', () => {
    const objs = [
      ta('inherited', {}),
      ta('custom', { fontFamily: CUSTOM }),
      ta('styled', { style: 'std' }),
    ];
    const out = followFontObjects(objs, DEFAULT_FONT_STACK, LATIN);
    expect(dataOf(out[0]).fontFamily).toBe(LATIN);
    expect(dataOf(out[1]).fontFamily).toBe(CUSTOM);
    expect(dataOf(out[2]).fontFamily).toBe(DEFAULT_FONT_STACK);
  });
});
