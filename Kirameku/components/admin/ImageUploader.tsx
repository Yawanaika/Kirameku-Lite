/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";
import { ImageOff, Loader2, Upload } from "lucide-react";
import AdminError from "./AdminError";
import { adminRequest, describeAdminError } from "./admin-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface UploadedImage {
  url: string;
  key: string;
  storage: "oss" | "local";
  width: number;
  height: number;
  orientation: "landscape" | "portrait";
  format: "jpeg" | "png" | "webp" | "gif";
  size: number;
}

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  onUploaded?: (image: UploadedImage) => void;
  id?: string;
  label?: string;
  hint?: string;
  disabled?: boolean;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

export default function ImageUploader({
  value,
  onChange,
  onUploaded,
  id = "image-upload",
  label = "图片地址",
  hint = "支持 JPG/PNG/WebP/GIF，最大 10MB；也可以直接填写站内路径或完整 URL。",
  disabled = false,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    if (file.size > MAX_BYTES) {
      setError("图片不能超过 10MB");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const image = await adminRequest<UploadedImage>(
        "/api/admin/upload/image",
        { method: "POST", body },
      );
      onChange(image.url);
      onUploaded?.(image);
    } catch (reason) {
      setError(describeAdminError(reason));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://... 或 /uploads/..."
          disabled={disabled || uploading}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className="shrink-0"
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="size-4" aria-hidden />
          )}
          {uploading ? "上传中…" : "上传"}
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        aria-label={label}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      <p className="text-[11px] leading-5 text-slate-600">{hint}</p>

      {error ? <AdminError message={error} /> : null}

      {value ? (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
          <img
            key={value}
            src={value}
            alt="图片预览"
            className="h-36 w-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        </div>
      ) : (
        <div className="flex h-24 items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 text-xs text-slate-600">
          <ImageOff className="size-4" aria-hidden />
          还没有图片
        </div>
      )}
    </div>
  );
}
