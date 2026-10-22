"use client";

import { useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import AdminEmptyState from "./AdminEmptyState";
import AdminError from "./AdminError";
import AdminPageHeader from "./AdminPageHeader";
import { useConfirm } from "./ConfirmProvider";
import { adminRequest, describeAdminError } from "./admin-api";
import { useAdminData } from "./use-admin-data";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  CategoryItem,
  TagItem,
} from "@/server/modules/posts/contracts";

interface CategoryFormState {
  name: string;
  slug: string;
  description: string;
  sort: string;
}

interface TagFormState {
  name: string;
  slug: string;
}

const emptyCategory: CategoryFormState = {
  name: "",
  slug: "",
  description: "",
  sort: "0",
};

const emptyTag: TagFormState = { name: "", slug: "" };

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function TaxonomyManager() {
  const confirm = useConfirm();
  const [categoryForm, setCategoryForm] =
    useState<CategoryFormState>(emptyCategory);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(
    null,
  );
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const [tagForm, setTagForm] = useState<TagFormState>(emptyTag);
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [tagSaving, setTagSaving] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);

  const {
    data: categories,
    loading: categoriesLoading,
    error: categoriesLoadError,
    reload: reloadCategories,
  } = useAdminData<CategoryItem[]>("/api/admin/categories");
  const {
    data: tags,
    loading: tagsLoading,
    error: tagsLoadError,
    reload: reloadTags,
  } = useAdminData<TagItem[]>("/api/admin/tags");

  function resetCategoryForm() {
    setCategoryForm(emptyCategory);
    setEditingCategoryId(null);
    setCategoryError(null);
  }

  function editCategory(item: CategoryItem) {
    setEditingCategoryId(item.id);
    setCategoryForm({
      name: item.name,
      slug: item.slug,
      description: item.description,
      sort: String(item.sort),
    });
    setCategoryError(null);
  }

  async function submitCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryForm.name.trim() || !categoryForm.slug.trim()) {
      setCategoryError("分类名称和 slug 不能为空");
      return;
    }
    setCategorySaving(true);
    setCategoryError(null);
    try {
      await adminRequest(
        editingCategoryId
          ? `/api/admin/categories/${editingCategoryId}`
          : "/api/admin/categories",
        {
          method: editingCategoryId ? "PUT" : "POST",
          body: JSON.stringify({
            name: categoryForm.name.trim(),
            slug: categoryForm.slug.trim(),
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

  async function removeCategory(item: CategoryItem) {
    if (!await confirm(`确定删除分类「${item.name}」？文章会变为未分类。`)) {
      return;
    }
    setCategoryError(null);
    try {
      await adminRequest(`/api/admin/categories/${item.id}`, {
        method: "DELETE",
      });
      if (editingCategoryId === item.id) resetCategoryForm();
      reloadCategories();
    } catch (reason) {
      setCategoryError(describeAdminError(reason));
    }
  }

  function resetTagForm() {
    setTagForm(emptyTag);
    setEditingTagId(null);
    setTagError(null);
  }

  function editTag(item: TagItem) {
    setEditingTagId(item.id);
    setTagForm({ name: item.name, slug: item.slug });
    setTagError(null);
  }

  async function submitTag(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tagForm.name.trim() || !tagForm.slug.trim()) {
      setTagError("标签名称和 slug 不能为空");
      return;
    }
    setTagSaving(true);
    setTagError(null);
    try {
      await adminRequest(
        editingTagId ? `/api/admin/tags/${editingTagId}` : "/api/admin/tags",
        {
          method: editingTagId ? "PUT" : "POST",
          body: JSON.stringify({
            name: tagForm.name.trim(),
            slug: tagForm.slug.trim(),
          }),
        },
      );
      resetTagForm();
      reloadTags();
    } catch (reason) {
      setTagError(describeAdminError(reason));
    } finally {
      setTagSaving(false);
    }
  }

  async function removeTag(item: TagItem) {
    if (
      !await confirm(
        `确定删除标签「${item.name}」？文章与标签的关联会一并删除。`,
      )
    ) {
      return;
    }
    setTagError(null);
    try {
      await adminRequest(`/api/admin/tags/${item.id}`, { method: "DELETE" });
      if (editingTagId === item.id) resetTagForm();
      reloadTags();
    } catch (reason) {
      setTagError(describeAdminError(reason));
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <AdminPageHeader
        eyebrow="Taxonomy"
        title="分类 / 标签"
        description="维护文章分类和标签；删除分类会将文章置为未分类，删除标签会移除文章关联。"
        actions={
          <Button
            variant="outline"
            onClick={() => {
              reloadCategories();
              reloadTags();
            }}
          >
            <RefreshCw className="size-4" aria-hidden />
            刷新
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>分类</CardTitle>
              <p className="mt-0.5 text-xs text-slate-500">
                共 {categories?.length ?? 0} 个
              </p>
            </div>
          </CardHeader>

          <form
            onSubmit={submitCategory}
            className="space-y-3 border-b border-white/10 p-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-slate-300">
                {editingCategoryId
                  ? `编辑分类 #${editingCategoryId}`
                  : "新建分类"}
              </h3>
              {editingCategoryId ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetCategoryForm}
                >
                  <X className="size-3.5" aria-hidden />
                  取消
                </Button>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="category-name">名称</Label>
                <Input
                  id="category-name"
                  value={categoryForm.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    setCategoryForm((current) => {
                      const autoSlug =
                        !editingCategoryId &&
                        (!current.slug || current.slug === slugify(current.name));
                      return {
                        ...current,
                        name,
                        slug: autoSlug ? slugify(name) : current.slug,
                      };
                    });
                  }}
                  placeholder="技术"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category-slug">Slug</Label>
                <Input
                  id="category-slug"
                  value={categoryForm.slug}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      slug: event.target.value,
                    }))
                  }
                  placeholder="tech"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category-description">描述</Label>
              <Textarea
                id="category-description"
                value={categoryForm.description}
                onChange={(event) =>
                  setCategoryForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="min-h-16"
              />
            </div>
            <div className="flex items-end gap-3">
              <div className="w-24 space-y-1.5">
                <Label htmlFor="category-sort">排序</Label>
                <Input
                  id="category-sort"
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
              <Button type="submit" disabled={categorySaving}>
                {editingCategoryId ? (
                  <Pencil className="size-4" aria-hidden />
                ) : (
                  <Plus className="size-4" aria-hidden />
                )}
                {categorySaving ? "保存中…" : "保存分类"}
              </Button>
            </div>
            {categoryError ? <AdminError message={categoryError} /> : null}
          </form>

          {categoriesLoadError ? (
            <div className="px-5 pt-4">
              <AdminError message={categoriesLoadError} />
            </div>
          ) : null}
          {categoriesLoading && !categories ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              正在加载分类…
            </div>
          ) : categories && categories.length > 0 ? (
            <ul className="divide-y divide-white/5">
              {categories.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-200">
                      {item.name}
                      <span className="ml-2 text-[10px] text-slate-600">
                        /{item.slug}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-600">
                      {item.description || "无描述"} · {item.post_count} 篇文章
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
                    onClick={() => removeCategory(item)}
                    aria-label={`删除 ${item.name}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <AdminEmptyState title="还没有分类" />
          )}
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>标签</CardTitle>
              <p className="mt-0.5 text-xs text-slate-500">
                共 {tags?.length ?? 0} 个
              </p>
            </div>
          </CardHeader>

          <form
            onSubmit={submitTag}
            className="space-y-3 border-b border-white/10 p-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-slate-300">
                {editingTagId ? `编辑标签 #${editingTagId}` : "新建标签"}
              </h3>
              {editingTagId ? (
                <Button variant="ghost" size="sm" onClick={resetTagForm}>
                  <X className="size-3.5" aria-hidden />
                  取消
                </Button>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tag-name">名称</Label>
                <Input
                  id="tag-name"
                  value={tagForm.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    setTagForm((current) => {
                      const autoSlug =
                        !editingTagId &&
                        (!current.slug || current.slug === slugify(current.name));
                      return {
                        ...current,
                        name,
                        slug: autoSlug ? slugify(name) : current.slug,
                      };
                    });
                  }}
                  placeholder="Next.js"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tag-slug">Slug</Label>
                <Input
                  id="tag-slug"
                  value={tagForm.slug}
                  onChange={(event) =>
                    setTagForm((current) => ({
                      ...current,
                      slug: event.target.value,
                    }))
                  }
                  placeholder="nextjs"
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={tagSaving}>
              {editingTagId ? (
                <Pencil className="size-4" aria-hidden />
              ) : (
                <Plus className="size-4" aria-hidden />
              )}
              {tagSaving ? "保存中…" : "保存标签"}
            </Button>
            {tagError ? <AdminError message={tagError} /> : null}
          </form>

          {tagsLoadError ? (
            <div className="px-5 pt-4">
              <AdminError message={tagsLoadError} />
            </div>
          ) : null}
          {tagsLoading && !tags ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              正在加载标签…
            </div>
          ) : tags && tags.length > 0 ? (
            <ul className="divide-y divide-white/5">
              {tags.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-200">
                      {item.name}
                      <span className="ml-2 text-[10px] text-slate-600">
                        /{item.slug}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      {item.post_count} 篇文章
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => editTag(item)}
                    aria-label={`编辑 ${item.name}`}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-slate-500 hover:text-rose-300"
                    onClick={() => removeTag(item)}
                    aria-label={`删除 ${item.name}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <AdminEmptyState title="还没有标签" />
          )}
        </Card>
      </div>
    </div>
  );
}
