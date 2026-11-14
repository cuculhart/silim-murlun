import { createRoot } from 'react-dom/client';
import { App } from './App';

// 同梱フォント（OFL）— サンプル文書を含め、どのマシンでも同じ
// 組版・計測・印刷になるようフォントをバンドルする。
//   和文: Noto Sans JP（japanese ＋ latin サブセット、400/700）
//   欧文: Noto Sans（latin ＋ latin-ext、400/700、italic 込み）
// @font-face 名はそれぞれ 'Noto Sans JP' / 'Noto Sans' —
// 同名のローカルフォントより文書フォントが優先されるため、
// fonts.ts のスタック先頭に載せれば必ず同梱版へ解決される
import '@fontsource/noto-sans-jp/japanese-400.css';
import '@fontsource/noto-sans-jp/japanese-700.css';
import '@fontsource/noto-sans-jp/latin-400.css';
import '@fontsource/noto-sans-jp/latin-700.css';
import '@fontsource/noto-sans/latin-400.css';
import '@fontsource/noto-sans/latin-700.css';
import '@fontsource/noto-sans/latin-ext-400.css';
import '@fontsource/noto-sans/latin-ext-700.css';
import '@fontsource/noto-sans/latin-400-italic.css';
import '@fontsource/noto-sans/latin-700-italic.css';
import '@fontsource/noto-sans/latin-ext-400-italic.css';
import '@fontsource/noto-sans/latin-ext-700-italic.css';

// 初回計測（measureText による行分割）がフォント到着前の
// 代替メトリクスで走るのを防ぐため、同梱2書体のロードを待って
// から描画する。遅い環境では 1.5s で打ち切る
const boot = async () => {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load("12px 'Noto Sans JP'"),
        document.fonts.load("12px 'Noto Sans'"),
      ]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch {
    // フォント読み込み失敗時もフォールバックで起動する
  }
  createRoot(document.getElementById('root')!).render(<App />);
};
boot();
