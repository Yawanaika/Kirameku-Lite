import { and, desc, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import {
  chatter,
  chatterComment,
  comment,
  githubUser,
  post,
} from "@/server/db/schema";
import { errors } from "@/server/http/errors";
import type {
  ChatterCommentItem,
  CommentGitHubUser,
  PostCommentItem,
} from "./contracts";

const postCommentSelection = {
  id: comment.id,
  postId: comment.postId,
  parentId: comment.parentId,
  content: comment.content,
  likes: comment.likes,
  status: comment.status,
  createdAt: comment.createdAt,
  ghId: githubUser.id,
  ghLogin: githubUser.login,
  ghAvatar: githubUser.avatar,
  ghBio: githubUser.bio,
};

const chatterCommentSelection = {
  id: chatterComment.id,
  chatterId: chatterComment.chatterId,
  parentId: chatterComment.parentId,
  content: chatterComment.content,
  likes: chatterComment.likes,
  status: chatterComment.status,
  createdAt: chatterComment.createdAt,
  ghId: githubUser.id,
  ghLogin: githubUser.login,
  ghAvatar: githubUser.avatar,
  ghBio: githubUser.bio,
};

interface CommentRowBase {
  id: number;
  parentId: number | null;
  content: string;
  likes: number | null;
  status: string | null;
  createdAt: Date | null;
  ghId: number | null;
  ghLogin: string | null;
  ghAvatar: string | null;
  ghBio: string | null;
}

interface PostCommentRow extends CommentRowBase {
  postId: number;
}

interface ChatterCommentRow extends CommentRowBase {
  chatterId: number;
}

function toGitHubUser(row: CommentRowBase): CommentGitHubUser | null {
  if (row.ghId === null) return null;
  return {
    id: row.ghId,
    login: row.ghLogin ?? "",
    avatar: row.ghAvatar ?? "",
    bio: row.ghBio ?? "",
  };
}

function baseFields(row: CommentRowBase) {
  return {
    id: row.id,
    parent_id: row.parentId,
    content: row.content,
    likes: row.likes ?? 0,
    status: row.status ?? "approved",
    created_at: row.createdAt?.toISOString() ?? new Date(0).toISOString(),
    github_user: toGitHubUser(row),
  };
}

function toPostComment(row: PostCommentRow): PostCommentItem {
  return {
    ...baseFields(row),
    post_id: row.postId,
    replies: [],
  };
}

function toChatterComment(row: ChatterCommentRow): ChatterCommentItem {
  return {
    ...baseFields(row),
    chatter_id: row.chatterId,
    replies: [],
  };
}

/**
 * Match the legacy tree builder: rows arrive newest-first, and a reply whose
 * parent is not in the approved result set becomes a root.
 */
function buildTree<
  T extends { id: number; parent_id: number | null; replies: T[] },
>(rows: T[]): T[] {
  const idMap = new Map<number, T>();
  for (const row of rows) idMap.set(row.id, row);

  const roots: T[] = [];
  for (const row of rows) {
    if (row.parent_id !== null && idMap.has(row.parent_id)) {
      idMap.get(row.parent_id)!.replies.push(row);
    } else {
      roots.push(row);
    }
  }
  return roots;
}

export function createCommentsService(db: AppDatabase) {
  async function getPostComment(id: number): Promise<PostCommentItem> {
    const [row] = await db
      .select(postCommentSelection)
      .from(comment)
      .innerJoin(post, eq(comment.postId, post.id))
      .leftJoin(githubUser, eq(comment.githubUserId, githubUser.id))
      .where(
        and(
          eq(comment.id, id),
          eq(comment.status, "approved"),
          eq(post.status, "published"),
        ),
      )
      .limit(1);

    if (!row) throw errors.notFound("评论不存在");
    return toPostComment(row);
  }

  async function getChatterComment(id: number): Promise<ChatterCommentItem> {
    const [row] = await db
      .select(chatterCommentSelection)
      .from(chatterComment)
      .innerJoin(chatter, eq(chatterComment.chatterId, chatter.id))
      .leftJoin(
        githubUser,
        eq(chatterComment.githubUserId, githubUser.id),
      )
      .where(
        and(
          eq(chatterComment.id, id),
          eq(chatterComment.status, "approved"),
          eq(chatter.status, "published"),
        ),
      )
      .limit(1);

    if (!row) throw errors.notFound("评论不存在");
    return toChatterComment(row);
  }

  return {
    async listPostComments(postId: number): Promise<PostCommentItem[]> {
      const rows = await db
        .select(postCommentSelection)
        .from(comment)
        .innerJoin(post, eq(comment.postId, post.id))
        .leftJoin(githubUser, eq(comment.githubUserId, githubUser.id))
        .where(
          and(
            eq(comment.postId, postId),
            eq(comment.status, "approved"),
            eq(post.status, "published"),
          ),
        )
        .orderBy(desc(comment.createdAt), desc(comment.id));

      return buildTree(rows.map(toPostComment));
    },

    async listChatterComments(
      chatterId: number,
    ): Promise<ChatterCommentItem[]> {
      const rows = await db
        .select(chatterCommentSelection)
        .from(chatterComment)
        .innerJoin(chatter, eq(chatterComment.chatterId, chatter.id))
        .leftJoin(
          githubUser,
          eq(chatterComment.githubUserId, githubUser.id),
        )
        .where(
          and(
            eq(chatterComment.chatterId, chatterId),
            eq(chatterComment.status, "approved"),
            eq(chatter.status, "published"),
          ),
        )
        .orderBy(desc(chatterComment.createdAt), desc(chatterComment.id));

      return buildTree(rows.map(toChatterComment));
    },

    async createPostComment(input: {
      postId: number;
      parentId?: number;
      content: string;
      ip: string;
      githubUserId: number;
    }): Promise<PostCommentItem> {
      const [target] = await db
        .select({ id: post.id })
        .from(post)
        .where(
          and(eq(post.id, input.postId), eq(post.status, "published")),
        )
        .limit(1);
      if (!target) throw errors.notFound("文章不存在");

      if (input.parentId !== undefined) {
        const [parent] = await db
          .select({
            id: comment.id,
            postId: comment.postId,
            status: comment.status,
          })
          .from(comment)
          .where(eq(comment.id, input.parentId))
          .limit(1);
        if (!parent || parent.status !== "approved") {
          throw errors.notFound("被回复的评论不存在");
        }
        if (parent.postId !== input.postId) {
          throw errors.badRequest("被回复的评论不属于当前文章");
        }
      }

      const [created] = await db
        .insert(comment)
        .values({
          postId: input.postId,
          parentId: input.parentId ?? null,
          githubUserId: input.githubUserId,
          content: input.content,
          ip: input.ip,
        })
        .returning({ id: comment.id });
      if (!created) throw errors.internal("保存评论失败");

      return getPostComment(created.id);
    },

    async togglePostCommentLike(
      id: number,
      unlike = false,
    ): Promise<PostCommentItem> {
      await getPostComment(id);
      const delta = unlike ? -1 : 1;
      await db
        .update(comment)
        .set({
          likes: sql<number>`max(0, coalesce(${comment.likes}, 0) + ${delta})`,
        })
        .where(eq(comment.id, id));
      return getPostComment(id);
    },

    async createChatterComment(input: {
      chatterId: number;
      parentId?: number;
      content: string;
      ip: string;
      githubUserId: number;
    }): Promise<ChatterCommentItem> {
      const [target] = await db
        .select({ id: chatter.id })
        .from(chatter)
        .where(
          and(
            eq(chatter.id, input.chatterId),
            eq(chatter.status, "published"),
          ),
        )
        .limit(1);
      if (!target) throw errors.notFound("说说不存在");

      if (input.parentId !== undefined) {
        const [parent] = await db
          .select({
            id: chatterComment.id,
            chatterId: chatterComment.chatterId,
            status: chatterComment.status,
          })
          .from(chatterComment)
          .where(eq(chatterComment.id, input.parentId))
          .limit(1);
        if (!parent || parent.status !== "approved") {
          throw errors.notFound("被回复的评论不存在");
        }
        if (parent.chatterId !== input.chatterId) {
          throw errors.badRequest("被回复的评论不属于当前说说");
        }
      }

      const [created] = await db
        .insert(chatterComment)
        .values({
          chatterId: input.chatterId,
          parentId: input.parentId ?? null,
          githubUserId: input.githubUserId,
          content: input.content,
          ip: input.ip,
        })
        .returning({ id: chatterComment.id });
      if (!created) throw errors.internal("保存评论失败");

      await db
        .update(chatter)
        .set({
          commentsCount: sql<number>`coalesce(${chatter.commentsCount}, 0) + 1`,
        })
        .where(eq(chatter.id, input.chatterId));

      return getChatterComment(created.id);
    },

    async toggleChatterCommentLike(
      id: number,
      unlike = false,
    ): Promise<ChatterCommentItem> {
      await getChatterComment(id);
      const delta = unlike ? -1 : 1;
      await db
        .update(chatterComment)
        .set({
          likes: sql<number>`max(0, coalesce(${chatterComment.likes}, 0) + ${delta})`,
        })
        .where(eq(chatterComment.id, id));
      return getChatterComment(id);
    },
  };
}

export type CommentsService = ReturnType<typeof createCommentsService>;
