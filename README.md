# ITSM Incident Tracker

Next.js 16 / React 19 で実装された ITSM 向けインシデント管理アプリです。インシデントの起票、ステータス追跡、SLA 可視化、監査ログ、Slack 通知、パスワード認証と GitHub OAuth に対応しています。

## 主な機能

- インシデント一覧、検索、優先度フィルタ、ステータスフィルタ
- `INC-0001` 形式の DB 管理連番 ID
- 優先度別 SLA 期限の自動計算
- 応答 SLA / 解決 SLA のバッジ表示
- 詳細画面でのステータス、優先度、担当者、タイトル、コメント更新
- 変更履歴を監査ログとしてタイムライン表示
- admin ロールによる一括論理削除と削除済み一覧表示
- JWT Cookie によるパスワードログイン
- GitHub OAuth ログインとメールアドレスによる既存ユーザー自動リンク
- Slack Webhook 通知
- ローカル SQLite / 本番 Turso libSQL

## 技術スタック

| 区分 | 技術 |
|---|---|
| フロントエンド | Next.js 16.2.4 / React 19.2 / Tailwind CSS 4 / shadcn 系 UI |
| バックエンド | Next.js App Router Route Handlers |
| DB | SQLite (`better-sqlite3`) / Turso libSQL |
| ORM | Drizzle ORM |
| 認証 | JWT (`jose`) / PBKDF2 / GitHub OAuth |
| 通知 | Slack Incoming Webhook |
| デプロイ | Vercel |

## セットアップ

```bash
npm install
```

`.env.local` を作成し、最低限 `JWT_SECRET` を設定します。

```bash
JWT_SECRET=change-me-to-a-long-random-secret
DB_PATH=data/itsm.db

# 任意: GitHub OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# 任意: Slack 通知
SLACK_WEBHOOK_URL=

# 任意: Vercel Cron / 本番 SLA チェック
CRON_SECRET=
```

初期ユーザーを作成します。

```bash
npm run migrate
npm run seed:user -- admin admin@example.com password123 admin
```

開発サーバーを起動します。

```bash
npm run dev
```

`npm run dev` は起動前に `npm run migrate` を実行します。ブラウザで `http://localhost:3000` を開いてください。

## スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | ローカルマイグレーション後に Next.js 開発サーバーを起動 |
| `npm run build` | 本番ビルド |
| `npm run start` | 本番サーバー起動 |
| `npm run lint` | ESLint |
| `npm run migrate` | ローカル SQLite にスキーマ適用 |
| `npm run migrate:turso` | Turso にスキーマ適用 |
| `npm run seed:user` | ローカル SQLite にユーザー作成 |

## ドキュメント

- [要件定義](docs/requirements.md)
- [技術ガイド](docs/technical-guide.md)
- [オペレータ向けユーザーマニュアル](docs/user-guide-operator.md)
- [画面操作ガイド](docs/visual-guide.md)
- [解説動画スクリプト](docs/video-script.md)
- [Vercel デプロイ手順](docs/deploy-vercel.md)
