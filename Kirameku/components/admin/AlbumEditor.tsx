/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, Save, Trash2 } from "lucide-react";
import AdminError from "./AdminError";
import ImageUploader from "./ImageUploader";
import { adminRequest, describeAdminError } from "./admin-api";
import { formatDateTime } from "./format";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AlbumItem, PhotoItem } from "@/server/modules/albums/contracts";

interface AlbumDetailResponse {
  album: AlbumItem;
  photos: PhotoItem[];
}

interface AlbumFormState {
  title: string;
  description: string;
  cover: string;
  sort: string;
}

interface PhotoFormState {
  url: string;
  caption: string;
  orientation: string;
  sort: string;
}

const emptyPhoto: PhotoFormState = {
  url: "",
  caption: "",
  orientation: "landscape",
  sort: "0",
};

export default function AlbumEditor({ albumId }: { albumId: number }) {
  const router = useRouter();
  const [album, setAlbum] = useState<AlbumItem | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [form, setForm] = useState<AlbumFormState>({
    title: "",
    description: "",
    cover: "",
    sort: "0",
  });
  const [photoForm, setPhotoForm] = useState<PhotoFormState>(emptyPhoto);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoDeletingId, setPhotoDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const formInitializedFor = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    adminRequest<AlbumDetailResponse>(`/api/admin/albums/${albumId}`)
      .then((data) => {
        if (!active) return;
        setAlbum(data.album);
        setPhotos(data.photos);
        if (formInitializedFor.current !== albumId) {
          setForm({
            title: data.album.title,
            description: data.album.description,
            cover: data.album.cover,
            sort: String(data.album.sort),
          });
          formInitializedFor.current = albumId;
        }
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(describeAdminError(reason));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [albumId, version]);

  function reload() {
    setVersion((current) => current + 1);
  }

  async function saveAlbum(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) {
      setError("相册标题不能为空");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await adminRequest(`/api/admin/albums/${albumId}`, {
        method: "PUT",
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description,
          cover: form.cover.trim(),
          sort: Number(form.sort) || 0,
        }),
      });
      reload();
    } catch (reason) {
      setError(describeAdminError(reason));
    } finally {
      setSaving(false);
    }
  }

  async function removeAlbum() {
    if (!window.confirm("确定删除这个相册？照片记录也会一并删除。")) return;
    setDeleting(true);
    setError(null);
    try {
      await adminRequest(`/api/admin/albums/${albumId}`, { method: "DELETE" });
      router.push("/admin/albums");
      router.refresh();
    } catch (reason) {
      setError(describeAdminError(reason));
      setDeleting(false);
    }
  }

  async function addPhoto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photoForm.url.trim()) {
      setPhotoError("图片 URL 不能为空");
      return;
    }
    setPhotoSaving(true);
    setPhotoError(null);
    try {
      await adminRequest("/api/admin/albums/photos", {
        method: "POST",
        body: JSON.stringify({
          album_id: albumId,
          url: photoForm.url.trim(),
          caption: photoForm.caption.trim(),
          orientation: photoForm.orientation,
          sort: Number(photoForm.sort) || 0,
        }),
      });
      setPhotoForm(emptyPhoto);
      reload();
    } catch (reason) {
      setPhotoError(describeAdminError(reason));
    } finally {
      setPhotoSaving(false);
    }
  }

  async function removePhoto(photo: PhotoItem) {
    if (!window.confirm("确定删除这张照片记录？")) return;
    setPhotoDeletingId(photo.id);
    setPhotoError(null);
    try {
      await adminRequest(`/api/admin/albums/photos/${photo.id}`, {
        method: "DELETE",
      });
      reload();
    } catch (reason) {
      setPhotoError(describeAdminError(reason));
    } finally {
      setPhotoDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl py-16 text-center text-sm text-slate-500">
        正在加载相册…
      </div>
    );
  }

  if (!album) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-16 text-center">
        <p className="text-sm text-slate-400">相册不存在或加载失败</p>
        {error ? <AdminError message={error} /> : null}
        <Link href="/admin/albums" className={buttonVariants({ variant: "outline" })}>
          返回相册列表
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/admin/albums"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            返回相册列表
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            {album.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            相册 ID #{album.id} · {photos.length} 张照片 · 创建于{" "}
            {formatDateTime(album.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            onClick={removeAlbum}
            disabled={deleting || saving}
          >
            <Trash2 className="size-4" aria-hidden />
            {deleting ? "删除中…" : "删除相册"}
          </Button>
        </div>
      </header>

      {error ? <AdminError message={error} /> : null}

      <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>相册信息</CardTitle>
          </CardHeader>
          <form onSubmit={saveAlbum} className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="album-edit-title">标题</Label>
              <Input
                id="album-edit-title"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="album-edit-description">描述</Label>
              <Textarea
                id="album-edit-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="min-h-28"
              />
            </div>
            <div className="space-y-1.5">
              <ImageUploader
                id="album-edit-cover"
                label="封面图片"
                value={form.cover}
                onChange={(url) =>
                  setForm((current) => ({ ...current, cover: url }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="album-edit-sort">排序</Label>
              <Input
                id="album-edit-sort"
                type="number"
                value={form.sort}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sort: event.target.value,
                  }))
                }
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              <Save className="size-4" aria-hidden />
              {saving ? "保存中…" : "保存相册信息"}
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>照片</CardTitle>
              <p className="mt-0.5 text-xs text-slate-500">
                上传图片或填写 URL 后添加；上传会自动识别方向。
              </p>
            </div>
          </CardHeader>

          <form
            onSubmit={addPhoto}
            className="grid gap-3 border-b border-white/10 p-5 sm:grid-cols-2"
          >
            <div className="space-y-1.5 sm:col-span-2">
              <ImageUploader
                id="photo-url"
                label="图片"
                value={photoForm.url}
                onChange={(url) =>
                  setPhotoForm((current) => ({ ...current, url }))
                }
                onUploaded={(image) =>
                  setPhotoForm((current) => ({
                    ...current,
                    orientation: image.orientation,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="photo-caption">说明</Label>
              <Input
                id="photo-caption"
                value={photoForm.caption}
                onChange={(event) =>
                  setPhotoForm((current) => ({
                    ...current,
                    caption: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="photo-orientation">方向</Label>
                <Select
                  id="photo-orientation"
                  value={photoForm.orientation}
                  onChange={(event) =>
                    setPhotoForm((current) => ({
                      ...current,
                      orientation: event.target.value,
                    }))
                  }
                >
                  <option value="landscape">横向</option>
                  <option value="portrait">纵向</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="photo-sort">排序</Label>
                <Input
                  id="photo-sort"
                  type="number"
                  value={photoForm.sort}
                  onChange={(event) =>
                    setPhotoForm((current) => ({
                      ...current,
                      sort: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              {photoError ? <AdminError message={photoError} /> : null}
              <Button
                type="submit"
                variant="secondary"
                className="mt-3"
                disabled={photoSaving}
              >
                <ImagePlus className="size-4" aria-hidden />
                {photoSaving ? "添加中…" : "添加照片"}
              </Button>
            </div>
          </form>

          {photos.length > 0 ? (
            <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
              {photos.map((photo) => (
                <article
                  key={photo.id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/40"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || "相册照片"}
                    className="h-32 w-full object-cover"
                  />
                  <div className="p-3">
                    <p className="line-clamp-2 min-h-8 text-xs leading-4 text-slate-300">
                      {photo.caption || "无说明"}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-600">
                      {photo.orientation === "portrait" ? "纵向" : "横向"} · 排序{" "}
                      {photo.sort}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-slate-500 hover:text-rose-300"
                      disabled={photoDeletingId === photo.id}
                      onClick={() => removePhoto(photo)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      删除
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="px-5 py-16 text-center text-sm text-slate-500">
              还没有照片，填写图片 URL 添加第一张。
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
