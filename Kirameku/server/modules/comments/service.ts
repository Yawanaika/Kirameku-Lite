import { and, desc, eq } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import {
  chatter,
  chatterComment,
  comment,
  githubUser,
  post,
} from "@/server/db/schema";
import type {
  ChatterCommentItem,
  CommentGitHubUser,
  PostCommentItem,
} from "./contracts";

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
  return {
    async listPostComments(postId: number): Promise<PostCommentItem[]> {
      const rows = await db
        .select({
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
        })
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
        .select({
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
        })
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
  };
}

export type CommentsService = ReturnType<typeof createCommentsService>;
