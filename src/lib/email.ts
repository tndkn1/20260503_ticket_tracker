import { Resend } from "resend";

const from = process.env.RESEND_FROM_EMAIL ?? "ITSM Tracker <onboarding@resend.dev>";

export async function sendWelcomeEmail(opts: {
  to: string;
  username: string;
  password: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY が未設定のため送信をスキップ");
    return;
  }
  const resend = new Resend(apiKey);

  await resend.emails.send({
    from,
    to: opts.to,
    subject: "【ITSM Tracker】アカウントが作成されました",
    html: `
      <p>${opts.username} 様</p>
      <p>ITSM Tracker のアカウントが作成されました。</p>
      <p>以下の情報でログインしてください。</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#666">ユーザー名</td><td><strong>${opts.username}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">初期パスワード</td><td><strong>${opts.password}</strong></td></tr>
      </table>
      <p style="color:#d97706;font-size:0.9em">⚠️ セキュリティのため、初回ログイン後にパスワードを変更してください。</p>
    `,
  });
}
