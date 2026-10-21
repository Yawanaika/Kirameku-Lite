"use client";

import { useMemo, useState } from "react";
import {
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import AdminEmptyState from "./AdminEmptyState";
import AdminError from "./AdminError";
import AdminPageHeader from "./AdminPageHeader";
import { adminRequest, describeAdminError } from "./admin-api";
import { useAdminData } from "./use-admin-data";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  BookmarkCategoryItem,
  BookmarkSiteItem,
} from "@/server/modules/bookmarks/contracts";

type Tab = "categories" | "sites";

interface CategoryFormState {
  name: string;
  icon: string;
  description: string;
  sort: string;
}

interface SiteFormState {
  categoryId: string;
  name: string;
  url: string;
  icon: string;
  description: string;
  platforms: string;
  sort: string;
}

const emptyCategory: CategoryFormState = {
  name: "",
  icon: "",
  description: "",
  sort: "0",
};

const emptySite: SiteFormState = {
  categoryId: "",
  name: "",
  url: "",
  icon: "",
  description: "",
  platforms: "",
  sort: "0",
};

function splitPlatforms(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,，\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export default function BookmarksManager() {
  const [tab, setTab] = useState<Tab>("categories");

  const [categoryForm, setCategoryForm] =
    useState<CategoryFormState>(emptyCategory);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(
    null,
  );
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const [siteForm, setSiteForm] = useState<SiteFormState>(emptySite);
  const [editingSiteId, setEditingSiteId] = useState<number | null>(null);
  const [siteSaving, setSiteSaving] = useState(false);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [siteFilter, setSiteFilter] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: categories,
    loading: categoriesLoading,
    error: categoriesError,
    reload: reloadCategories,
  } = useAdminData<BookmarkCategoryItem[]>(
    "/api/admin/bookmarks/categories",
  );
  const {
    data: sites,
    loading: sitesLoading,
    error: sitesError,
    reload: reloadSites,
  } = useAdminData<BookmarkSiteItem[]>("/api/admin/bookmarks/sites");

  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const category of categories ?? []) map.set(category.id, category.name);
    return map;
  }, [categories]);

  const sitesByCategory = useMemo(() => {
    const map = new Map<number, BookmarkSiteItem[]>();
    for (const site of sites ?? []) {
      const group = map.get(site.category_id) ?? [];
      group.push(site);
      map.set(site.category_id, group);
    }
    return map;
  }, [sites]);

  const filteredSites = useMemo(() => {
    if (!siteFilter) return sites ?? [];
    return (sites ?? []).filter(
      (site) => String(site.category_id) === siteFilter,
    );
  }, [siteFilter, sites]);

  function resetCategoryForm() {
    setCategoryForm(emptyCategory);
    setEditingCategoryId(null);
    setCategoryError(null);
  }

  function editCategory(item: BookmarkCategoryItem) {
    setEditingCategoryId(item.id);
    setCategoryForm({
      name: item.name,
      icon: item.icon,
      description: item.description,
      sort: String(item.sort),
    });
    setCategoryError(null);
  }

  async function submitCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryForm.name.trim()) {
      setCategoryError("分类名称不能为空");
      return;
    }
    setCategorySaving(true);
    setCategoryError(null);
    try {
      await adminRequest(
        editingCategoryId
          ? `/api/admin/bookmarks/categories/${editingCategoryId}`
          : "/api/admin/bookmarks/categories",
        {
          method: editingCategoryId ? "PUT" : "POST",
          body: JSON.stringify({
            name: categoryForm.name.trim(),
            icon: categoryForm.icon.trim(),
            description: categoryForm.description,
            sort: Number(categoryForm.sort) || 0,
          }),
        },
      );
      resetCategoryForm();
      reloadCategories();
    } catch (reason) {
      setCategoryError(describeAdminError(reason));
    } finally {
      setCategorySaving(false);
    }
  }

  async function removeCategory(item: BookmarkCategoryItem) {
    if (
      !window.confirm(
        `确定删除收藏分类「${item.name}」？分类下的站点也会一并删除。`,
      )
    ) {
      return;
    }
    setBusyId(item.id);
    setActionError(null);
    try {
      await adminRequest(`/api/admin/bookmarks/categories/${item.id}`, {
        method: "DELETE",
      });
      if (editingCategoryId === item.id) resetCategoryForm();
      reloadCategories();
      reloadSites();
    } catch (reason) {
      setActionError(describeAdminError(reason));
    } finally {
      setBusyId(null);
    }
  }

  function resetSiteForm() {
    setSiteForm(emptySite);
    setEditingSiteId(null);
    setSiteError(null);
  }

  function editSite(item: BookmarkSiteItem) {
    setEditingSiteId(item.id);
    setSiteForm({
      categoryId: String(item.category_id),
      name: item.name,
      url: item.url,
      icon: item.icon,
      description: item.description,
      platforms: item.platforms.join(", "),
      sort: String(item.sort),
    });
    setSiteError(null);
  }

  async function submitSite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!siteForm.categoryId) {
      setSiteError("请选择收藏分类");
      return;
    }
    if (!siteForm.name.trim() || !siteForm.url.trim()) {
      setSiteError("站点名称和 URL 不能为空");
      return;
    }
    setSiteSaving(true);
    setSiteError(null);
    try {
      await adminRequest(
        editingSiteId
          ? `/api/admin/bookmarks/sites/${editingSiteId}`
          : "/api/admin/bookmarks/sites",
        {
          method: editingSiteId ? "PUT" : "POST",
          body: JSON.stringify({
            category_id: Number(siteForm.categoryId),
            name: siteForm.name.trim(),
            url: siteForm.url.trim(),
            icon: siteForm.icon.trim(),
            description: siteForm.description,
            platforms: splitPlatforms(siteForm.platforms),
            sort: Number(siteForm.sort) || 0,
          }),
        },
      );
      resetSiteForm();
      reloadSites();
    } catch (reason) {
      setSiteError(describeAdminError(reason));
    } finally {
      setSiteSaving(false);
    }
  }

  async function removeSite(item: BookmarkSiteItem) {
    if (!window.confirm(`确定删除收藏站点「${item.name}」？`)) return;
    setBusyId(item.id);
    setActionError(null);
    try {
      await adminRequest(`/api/admin/bookmarks/sites/${item.id}`, {
        method: "DELETE",
      });
      if (editingSiteId === item.id) resetSiteForm();
      reloadSites();
    } catch (reason) {
      setActionError(describeAdminError(reason));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <AdminPageHeader
        eyebrow="Community"
        title="收藏夹"
        description="维护前台收藏夹的分类和站点；站点支持平台标签和排序。"
        actions={
          <Button
            variant="outline"
            onClick={() => {
              reloadCategories();
              reloadSites();
            }}
          >
            <RefreshCw className="size-4" aria-hidden />
            刷新
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={tab === "categories" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setTab("categories")}
        >
          分类
        </Button>
        <Button
          variant={tab === "sites" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setTab("sites")}
        >
          站点
        </Button>
      </div>

      {actionError ? <AdminError message={actionError} /> : null}

      {tab === "categories" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>收藏分类</CardTitle>
                <p className="mt-0.5 text-xs text-slate-500">
                  共 {categories?.length ?? 0} 个
                </p>
              </div>
            </CardHeader>

            {categoriesError ? (
              <div className="px-5 pt-4">
                <AdminError message={categoriesError} />
              </div>
            ) : null}
            {categoriesLoading && !categories ? (
              <div className="px-5 py-16 text-center text-sm text-slate-500">
                正在加载分类…
              </div>
            ) : categories && categories.length > 0 ? (
              <ul className="divide-y divide-white/5">
                {categories.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-3 px-5 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-200">
                        {item.name}
                        <span className="ml-2 text-[10px] text-slate-600">
                          {sitesByCategory.get(item.id)?.length ?? 0} 个站点
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-600">
                        {item.description || "无描述"} · 排序 {item.sort}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => editCategory(item)}
                      aria-label={`编辑 ${item.name}`}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-500 hover:text-rose-300"
                      disabled={busyId === item.id}
                      onClick={() => removeCategory(item)}
                      aria-label={`删除 ${item.name}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <AdminEmptyState title="还没有收藏分类" />
            )}
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <div className="flex w-full items-center justify-between">
                <CardTitle>
                  {editingCategoryId ? "编辑分类" : "新建分类"}
                </CardTitle>
                {editingCategoryId ? (
                  <Button variant="ghost" size="sm" onClick={resetCategoryForm}>
                    <X className="size-3.5" aria-hidden />
                    取消
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <form onSubmit={submitCategory} className="space-y-4 p-5">
              <div className="space-y-1.5">
                <Label htmlFor="bookmark-category-name">名称</Label>
                <Input
                  id="bookmark-category-name"
                  value={categoryForm.name}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bookmark-category-icon">图标</Label>
                <Input
                  id="bookmark-category-icon"
                  value={categoryForm.icon}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      icon: event.target.value,
                    }))
                  }
                  placeholder="图标名或 URL"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bookmark-category-description">描述</Label>
                <Textarea
                  id="bookmark-category-description"
                  value={categoryForm.description}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="min-h-20"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bookmark-category-sort">排序</Label>
                <Input
                  id="bookmark-category-sort"
                  type="number"
                  value={categoryForm.sort}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      sort: event.target.value,
                    }))
                  }
                />
              </div>
              {categoryError ? <AdminError message={categoryError} /> : null}
              <Button type="submit" className="w-full" disabled={categorySaving}>
                {editingCategoryId ? (
                  <Pencil className="size-4" aria-hidden />
                ) : (
                  <Plus className="size-4" aria-hidden />
                )}
                {categorySaving
                  ? "保存中…"
                  : editingCategoryId
                    ? "保存修改"
                    : "新增分类"}
              </Button>
            </form>
          </Card>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader className="gap-3">
              <div>
                <CardTitle>收藏站点</CardTitle>
                <p className="mt-0.5 text-xs text-slate-500">
                  共 {sites?.length ?? 0} 个
                </p>
              </div>
              <Select
                aria-label="按分类筛选"
                value={siteFilter}
                onChange={(event) => setSiteFilter(event.target.value)}
                className="w-40"
              >
                <option value="">全部分类</option>
                {(categories ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </CardHeader>

            {sitesError ? (
              <div className="px-5 pt-4">
                <AdminError message={sitesError} />
              </div>
            ) : null}
            {sitesLoading && !sites ? (
              <div className="px-5 py-16 text-center text-sm text-slate-500">
                正在加载站点…
              </div>
            ) : filteredSites.length > 0 ? (
              <ul className="divide-y divide-white/5">
                {filteredSites.map((item) => (
                  <li key={item.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-slate-200">
                            {item.name}
                          </p>
                          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500">
                            {categoryNameById.get(item.category_id) ??
                              `分类 #${item.category_id}`}
                          </span>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-sky-300"
                          >
                            {item.url}
                            <ExternalLink className="size-3" aria-hidden />
                          </a>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                          {item.description || "无描述"}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {item.platforms.map((platform) => (
                            <span
                              key={platform}
                              className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500"
                            >
                              {platform}
                            </span>
                          ))}
                          <span className="text-[10px] text-slate-600">
                            排序 {item.sort}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => editSite(item)}
                          aria-label={`编辑 ${item.name}`}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-500 hover:text-rose-300"
                          disabled={busyId === item.id}
                          onClick={() => removeSite(item)}
                          aria-label={`删除 ${item.name}`}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <AdminEmptyState
                title={siteFilter ? "该分类下没有站点" : "还没有收藏站点"}
              />
            )}
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <div className="flex w-full items-center justify-between">
                <CardTitle>{editingSiteId ? "编辑站点" : "新建站点"}</CardTitle>
                {editingSiteId ? (
                  <Button variant="ghost" size="sm" onClick={resetSiteForm}>
                    <X className="size-3.5" aria-hidden />
                    取消
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <form onSubmit={submitSite} className="space-y-4 p-5">
              <div className="space-y-1.5">
                <Label htmlFor="bookmark-site-category">分类</Label>
                <Select
                  id="bookmark-site-category"
                  value={siteForm.categoryId}
                  onChange={(event) =>
                    setSiteForm((current) => ({
                      ...current,
                      categoryId: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="">选择分类</option>
                  {(categories ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bookmark-site-name">名称</Label>
                <Input
                  id="bookmark-site-name"
                  value={siteForm.name}
                  onChange={(event) =>
                    setSiteForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bookmark-site-url">URL</Label>
                <Input
                  id="bookmark-site-url"
                  value={siteForm.url}
                  onChange={(event) =>
                    setSiteForm((current) => ({
                      ...current,
                      url: event.target.value,
                    }))
                  }
                  placeholder="https://example.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bookmark-site-icon">图标</Label>
                <Input
                  id="bookmark-site-icon"
                  value={siteForm.icon}
                  onChange={(event) =>
                    setSiteForm((current) => ({
                      ...current,
                      icon: event.target.value,
                    }))
                  }
                  placeholder="图标名或 URL"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bookmark-site-description">描述</Label>
                <Textarea
                  id="bookmark-site-description"
                  value={siteForm.description}
                  onChange={(event) =>
                    setSiteForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="min-h-20"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bookmark-site-platforms">平台标签</Label>
                <Input
                  id="bookmark-site-platforms"
                  value={siteForm.platforms}
                  onChange={(event) =>
                    setSiteForm((current) => ({
                      ...current,
                      platforms: event.target.value,
                    }))
                  }
                  placeholder="Web, iOS, Android"
                />
                <p className="text-[11px] text-slate-600">用逗号分隔。</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bookmark-site-sort">排序</Label>
                <Input
                  id="bookmark-site-sort"
                  type="number"
                  value={siteForm.sort}
                  onChange={(event) =>
                    setSiteForm((current) => ({
                      ...current,
                      sort: event.target.value,
                    }))
                  }
                />
              </div>
              {siteError ? <AdminError message={siteError} /> : null}
              <Button type="submit" className="w-full" disabled={siteSaving}>
                {editingSiteId ? (
                  <Pencil className="size-4" aria-hidden />
                ) : (
                  <Plus className="size-4" aria-hidden />
                )}
                {siteSaving
                  ? "保存中…"
                  : editingSiteId
                    ? "保存修改"
                    : "新增站点"}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
