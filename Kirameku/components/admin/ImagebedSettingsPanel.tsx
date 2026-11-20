"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Save, Trash2 } from "lucide-react";
import AdminError from "./AdminError";
import { adminRequest, describeAdminError } from "./admin-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ImagebedSettings {
  enabled: boolean;
  baseUrl: string;
  uploadChannel: "telegram";
  uploadFolder: string;
  tokenConfigured: boolean;
}

const EMPTY_SETTINGS: ImagebedSettings = {
  enabled: false,
  baseUrl: "",
  uploadChannel: "telegram",
  uploadFolder: "",
  tokenConfigured: false,
};

export default function ImagebedSettingsPanel() {
  const [settings, setSettings] = useState<ImagebedSettings>(EMPTY_SETTINGS);
  const [apiToken, setApiToken] = useState("");
  const [clearApiToken, setClearApiToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void adminRequest<ImagebedSettings>("/api/admin/imagebed-settings")
      .then((result) => {
        if (active) setSettings(result);
      })
      .catch((reason) => {
        if (active) setError(describeAdminError(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage("");
    try {
      const result = await adminRequest<ImagebedSettings>("/api/admin/imagebed-settings", {
        method: "PUT",
        body: JSON.stringify({ ...settings, apiToken, clearApiToken }),
      });
      setSettings(result);
      setApiToken("");
      setClearApiToken(false);
      setMessage("图床设置已保存。新上传将使用当前选定的存储方式；既有图片地址不会迁移。 ");
    } catch (reason) {
      setError(describeAdminError(reason));
    } finally {
      setSaving(false);
    }
  }

  const busy = loading || saving;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 dark:border-white/10 dark:bg-slate-900/60">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Telegram 图床</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              新上传通过服务端调用 ImgBed API。Token 仅保存在服务端加密配置中，不会返回到浏览器；关闭后新图片继续使用现有 OSS / 本地存储规则。
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={settings.enabled}
              disabled={busy || clearApiToken}
              onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))}
              className="size-4 accent-sky-600"
            />
            启用图床
          </label>
        </div>

        {loading ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" aria-hidden />正在读取图床设置…</p>
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="imagebed-base-url">图床服务地址</Label>
              <Input
                id="imagebed-base-url"
                value={settings.baseUrl}
                disabled={busy}
                onChange={(event) => setSettings((current) => ({ ...current, baseUrl: event.target.value }))}
                placeholder="https://img.example.com"
                autoComplete="url"
                spellCheck={false}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">填写服务根地址，不要附加 /upload。生产环境要求 HTTPS，且不允许指向本机或内网。</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="imagebed-token">API Token</Label>
              <Input
                id="imagebed-token"
                type="password"
                value={apiToken}
                disabled={busy || clearApiToken}
                onChange={(event) => setApiToken(event.target.value)}
                placeholder={settings.tokenConfigured ? "已配置；留空则保留当前 Token" : "粘贴 ImgBed API Token"}
                autoComplete="new-password"
                spellCheck={false}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">{settings.tokenConfigured ? "Token 已配置，不会显示或回传。" : "尚未配置 Token。"}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="imagebed-channel">上传渠道</Label>
              <Input id="imagebed-channel" value="Telegram（固定）" disabled readOnly />
              <p className="text-xs text-slate-500 dark:text-slate-400">请求由服务器发往图床，不会把 API Token 暴露给浏览器。</p>
            </div>

            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="imagebed-folder">上传目录（可选）</Label>
              <Input
                id="imagebed-folder"
                value={settings.uploadFolder}
                disabled={busy}
                onChange={(event) => setSettings((current) => ({ ...current, uploadFolder: event.target.value }))}
                placeholder="blog/images"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">每个路径段仅支持字母、数字、下划线和连字符；留空使用图床默认目录。</p>
            </div>

            {settings.tokenConfigured ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 lg:col-span-2">
                <div>
                  <p className="text-sm font-medium">清除已保存的 Token</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">清除后图床会自动停用。再次启用前需要设置新的 Token。</p>
                </div>
                <Button
                  type="button"
                  variant={clearApiToken ? "destructive" : "outline"}
                  disabled={busy}
                  onClick={() => {
                    setClearApiToken((current) => !current);
                    setMessage("");
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                  {clearApiToken ? "取消清除" : "清除 Token"}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {error ? <AdminError message={error} /> : null}
      {message ? <p role="status" className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-4" aria-hidden />{message}</p> : null}
      <div className="flex justify-end">
        <Button onClick={save} disabled={busy || loading}>
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          {saving ? "保存中…" : "保存图床设置"}
        </Button>
      </div>
    </div>
  );
}
