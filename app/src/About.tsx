// v0.9: About — 「Silim Murlun について」オーバーレイ。
// アプリ名・コンセプト・バージョン・作者・外部導線をまとめる。
// バージョン表記はここが唯一の表示場所（MenuPane 側は撤去済み）
// — リリース時は APP_VERSION を package.json と揃える。

import type { Lang, TFunc } from './i18n';

/** 表示バージョン — リリース時に package.json×3 と揃える同期対象 */
export const APP_VERSION = 'v0.10.0';

/** 配布元トップ — About からの外部導線（cuculhart.com）。
    英語 UI では英語トップ（index.en.html）へ */
export const APP_URL = 'https://cuculhart.com/';
export const APP_URL_EN = 'https://cuculhart.com/index.en.html';

export function About({
  onClose,
  lang,
  t,
}: {
  onClose: () => void;
  lang: Lang;
  t: TFunc;
}) {
  return (
    <div className="dlg-backdrop" onClick={onClose}>
      <div className="dlg about" onClick={(e) => e.stopPropagation()}>
        <h1 className="about-name">Silim Murlun</h1>
        <div className="about-ver">{APP_VERSION}</div>
        <p className="about-body">{t('about.body')}</p>
        <p className="about-author">
          {t('about.author')}{' '}
          <a
            href={lang === 'en' ? APP_URL_EN : APP_URL}
            target="_blank"
            rel="noopener"
          >
            cuculhart.com
          </a>
        </p>
        <p className="about-author">
          {t('about.fonts')}{' '}
          <a
            href="licenses/OFL-noto-sans-jp.txt"
            target="_blank"
            rel="noopener"
          >
            Noto Sans JP
          </a>{' '}
          /{' '}
          <a
            href="licenses/OFL-noto-sans.txt"
            target="_blank"
            rel="noopener"
          >
            Noto Sans
          </a>{' '}
          (SIL OFL 1.1)
        </p>
        <div className="btns">
          <button onClick={onClose}>{t('print.close')}</button>
        </div>
      </div>
    </div>
  );
}
