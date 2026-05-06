# Vercel デプロイ手順

## 前提

- Vercel アカウント
- Turso アカウント（[turso.tech](https://turso.tech)）
- GitHub OAuth App（Vercel 用）

---

## 1. Turso データベースを作成

```bash
# Turso CLI をインストール（未インストールの場合）
brew install tursodatabase/tap/turso  # macOS

# Turso にログイン
turso auth login

# データベースを作成
turso db create itsm-db

# 接続 URL を確認
turso db show itsm-db

# 認証トークンを生成
turso db tokens create itsm-db
```

取得した値を控えておく：
- `TURSO_DATABASE_URL` — `libsql://itsm-db-<account>.turso.io`
- `TURSO_AUTH_TOKEN` — 生成されたトークン

---

## 2. Turso にマイグレーションを適用

```bash
TURSO_DATABASE_URL=libsql://... \
TURSO_AUTH_TOKEN=... \
npm run migrate:turso
```

---

## 3. GitHub OAuth App を作成（Vercel 用）

[github.com/settings/developers](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**

| 項目 | 値 |
|---|---|
| Application name | ITSM Tracker (Vercel) |
| Homepage URL | `https://<your-app>.vercel.app` |
| Authorization callback URL | `https://<your-app>.vercel.app/api/auth/github/callback` |

登録後、**Client ID** と **Client Secret** を取得。

> **Note**: GitHub OAuth App はコールバック URL が1つのみのため、Cloudflare 用と Vercel 用で別々の App が必要。

---

## 4. Vercel にプロジェクトをインポート

1. [vercel.com](https://vercel.com) にログイン
2. **Add New → Project** からこのリポジトリをインポート
3. Framework Preset は **Next.js** を選択

ビルドコマンドは `vercel.json` で `npm run build:vercel` に設定済みのため変更不要。

---

## 5. 環境変数を設定

Vercel プロジェクト → **Settings** → **Environment Variables** に以下を追加：

| 変数名 | 値 | 説明 |
|---|---|---|
| `TURSO_DATABASE_URL` | `libsql://...` | Turso 接続 URL |
| `TURSO_AUTH_TOKEN` | `...` | Turso 認証トークン |
| `JWT_SECRET` | 32 バイト以上のランダム文字列 | セッション署名（Cloudflare と同じ値でも可） |
| `GITHUB_CLIENT_ID` | Vercel 用 OAuth App の Client ID | |
| `GITHUB_CLIENT_SECRET` | Vercel 用 OAuth App の Client Secret | Secret として登録 |

JWT_SECRET の生成例：
```bash
openssl rand -hex 32
```

---

## 6. デプロイ

環境変数を保存後、**Deployments** タブから **Redeploy** を実行。

---

## データベース構成

| 環境 | DB |
|---|---|
| ローカル開発 | SQLite (`data/itsm.db`) |
| Vercel | Turso (`TURSO_DATABASE_URL`) |
| Cloudflare | D1 (`CLOUDFLARE_DEPLOY=true` のビルド) |

優先度: D1 > Turso > SQLite
