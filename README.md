# 電気図面作成ツール（単線結線図 / 分電盤図）

ブラウザで動作する、日本の電気設備向け作図ツールです。フォームに仕様を入力すると図面を自動生成し、キャンバス上で手直しできます。

- 高圧受電設備（6.6kV キュービクル）単線結線図
- 低圧分電盤（単相2線 / 単相3線 / 三相3線）単線結線図・盤面配置図・回路表
- 出力: PDF（ブラウザ印刷、図枠・表題欄付き）、DXF（R12, Shift_JIS。JW-CAD / AutoCAD で読込可）、SVG、JSON 保存/読込

## 開発

```bash
npm install
npm run dev        # 開発サーバー
npm test           # 単体テスト (vitest)
npm run typecheck  # 型検査
npm run build      # dist/ に本番ビルド
```

## Cloudflare へのデプロイ

Cloudflare Workers の Static Assets 機能で `dist/` を配信します（設定は `wrangler.jsonc`）。

### 手元から

```bash
npx wrangler login
npm run deploy
```

### GitHub Actions から

リポジトリの Secrets に以下を登録すると、`main` への push で自動デプロイされます（未登録の場合はスキップ）。

| Secret | 内容 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 「Workers スクリプトの編集」権限を持つ API トークン |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare ダッシュボードのアカウント ID |
