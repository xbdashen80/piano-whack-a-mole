// 把 index.html + src/ 整套打包成一个「自包含、可双击」的单文件 HTML。
// 用途：ES 模块版(index.html)双击打不开(file:// 拒载模块)，本脚本把所有 JS 打成一段
// 普通脚本、把 CSS 内联进去，产出一个双击即玩、且含全部功能的 HTML。
// 改完 src/ 后重新运行：  node build-single.mjs
// 这样「你玩的文件」永远等于「我们改的 src/」。
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = '钢琴打地鼠_小熊滑板版.html'; // 仍叫这个名字——你习惯双击的就是它

// 1) esbuild 把 src/main.js 及其依赖打成一段 IIFE(普通脚本,不依赖 file:// 加载模块)
const bundle = execFileSync(
  'npx',
  ['-y', 'esbuild', 'src/main.js', '--bundle', '--format=iife', '--charset=utf8'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: true }
);

// 2) 读 index.html 与 styles.css，把外链替换为内联
const css = readFileSync('styles.css', 'utf8');
let html = readFileSync('index.html', 'utf8');

html = html.replace(
  /<link rel="stylesheet" href="\.\/styles\.css">/,
  `<style>\n${css}\n</style>`
);
html = html.replace(
  /<script type="module" src="\.\/src\/main\.js"><\/script>/,
  `<script>\n${bundle}\n</script>`
);

// 3) 顶部加一行注释，提醒这是自动生成的，别手改
html = html.replace(
  '<!DOCTYPE html>',
  '<!DOCTYPE html>\n<!-- ⚠ 此文件由 build-single.mjs 自动生成：改逻辑请改 src/ 再重跑 node build-single.mjs，勿直接手改本文件 -->'
);

writeFileSync(OUT, html);
console.log(`已生成 ${OUT}（${(html.length / 1024).toFixed(0)} KB，可直接双击）`);
