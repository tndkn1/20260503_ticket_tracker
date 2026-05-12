# Vercel デプロイ手順

## 前提

- Vercel アカウント
- Turso アカウント
- GitHub OAuth を使う場合は GitHub OAuth App
- Slack 通知を使う場合は Slack Incoming Webhook URL

## 1. Turso データベースを作成

```bash
brew install tursodatabase/tap/turso
turso auth login
turso db create itsm-db
turso db show itsm-db
turso db tokens create itsm-db
```

控える値:

- `TURSO_DATABASE_URL`: `libsql://...`
- `TURSO_AUTH_TOKEN`: 生成されたトークン

## 2. Turso にマイグレーションを適用

```bash
TURSO_DATABASE_URL=libsql://... \
TURSO_AUTH_TOKEN=... \
npm run migrate:turso
```

## 3. GitHub OAuth App を作成

GitHub の Developer settings から OAuth App を作成します。

| 項目 | 値 |
|---|---|
| Application name | ITSM Incident Tracker |
| Homepage URL | `https://<your-app>.vercel.app` |
| Authorization callback URL | `https://<your-app>.vercel.app/api/auth/github/callback` |

作成後、`Client ID` と `Client Secret` を控えます。

ローカル開発でも GitHub OAuth を使う場合は、別の OAuth App を作り、callback URL を `http://localhost:3000/api/auth/github/callback` にします。

## 4. Vercel にインポート

1. Vercel で `Add New` -> `Project` を選びます。
2. このリポジトリをインポートします。
3. Framework Preset は `Next.js` を選びます。

`vercel.json` では以下を指定しています。

```json
{
  "buildCommand": "npm run build",
  "framework": "nextjs",
  "installCommand": "npm clean-install"
}
```

## 5. 環境変数

Vercel の `Settings` -> `Environment Variables` に設定します。

| 変数名 | 必須 | 説明 |
|---|---|---|
| `JWT_SECRET` | 必須 | JWT 署名シークレット |
| `TURSO_DATABASE_URL` | 必須 | Turso 接続 URL |
| `TURSO_AUTH_TOKEN` | 必須 | Turso 認証トークン |
| `GITHUB_CLIENT_ID` | GitHub 利用時 | OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub 利用時 | OAuth App Client Secret |
| `SLACK_WEBHOOK_URL` | 任意 | Slack Incoming Webhook URL |
| `CRON_SECRET` | SLA チェック定期実行時 | `/api/sla-check` の Bearer 認証用シークレット |

`JWT_SECRET` の生成例:

```bash
openssl rand -hex 32
```

## 6. デプロイ

環境変数を保存後、Vercel の Deployments から Redeploy します。

## 7. SLA チェックの定期実行

SLA 違反フラグは `/api/sla-check` の実行時に更新されます。本番では Vercel Cron または外部スケジューラーから定期実行してください。

Vercel Cron から呼び出す場合、Vercel は GET リクエストを送ります。`CRON_SECRET` を Vercel の環境変数に設定すると、Vercel は `Authorization: Bearer <CRON_SECRET>` ヘッダーを付けて呼び出します。このアプリの `/api/sla-check` はそのヘッダーを検証します。

`vercel.json` に Cron を追加する例:

```json
{
  "crons": [
    {
      "path": "/api/sla-check",
      "schedule": "0 * * * *"
    }
  ]
}
```

外部スケジューラーや手動実行の例:

```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://<your-app>.vercel.app/api/sla-check
```

本番環境で `CRON_SECRET` が未設定の場合、`/api/sla-check` は `401 Unauthorized` を返します。ローカル開発では `CRON_SECRET` なしでも実行できます。

## 8. DB の切り替え

| 環境 | DB |
|---|---|
| ローカル | SQLite。`DB_PATH` または `data/itsm.db` |
| Vercel | Turso。`TURSO_DATABASE_URL` 設定時に使用 |

Cloudflare D1 用の分岐は現在の実装にはありません。
