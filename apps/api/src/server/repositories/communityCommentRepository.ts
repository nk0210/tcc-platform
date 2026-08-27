/**
 * Community Comment Repository
 * Handles top-level comments and nested replies.
 */
import db from "../../lib/prisma";

const AUTHOR_SELECT = {
  id:          true,
  handle:      true,
  displayName: true,
  avatarUrl:   true,
  roles:       true,
  isVerified:  true,
} as const;

function buildCommentInclude(viewerId?: string) {
  return {
    author: { select: AUTHOR_SELECT },
    _count: { select: { likes: true, replies: true } },
    ...(viewerId
      ? { likes: { where: { userId: viewerId }, select: { userId: true } } }
      : {}),
  } as const;
}

export const communityCommentRepository = {
  // ── Create top-level comment or reply ─────────────────────────────────────

  create(data: {
    postId:    string;
    authorId:  string;
    content:   string;
    parentId?: string | null;
  }) {
    return db.communityComment.create({
      data: {
        postId:   data.postId,
        authorId: data.authorId,
        content:  data.content,
        parentId: data.parentId ?? null,
      },
      include: buildCommentInclude(),
    });
  },

  // ── Find top-level comments for a post (paginated) ────────────────────────

  async findByPost(
    postId:   string,
    page:     number,
    pageSize: number,
    viewerId?: string
  ) {
    const where = { postId, parentId: null, isHiddenByAdmin: false };

    const [items, total] = await Promise.all([
      db.communityComment.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: buildCommentInclude(viewerId),
      }),
      db.communityComment.count({ where }),
    ]);

    return { items, total };
  },

  // ── Find replies for a comment (paginated) ────────────────────────────────

  async findReplies(
    parentId:  string,
    page:      number,
    pageSize:  number,
    viewerId?: string
  ) {
    const where = { parentId, isHiddenByAdmin: false };

    const [items, total] = await Promise.all([
      db.communityComment.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: buildCommentInclude(viewerId),
      }),
      db.communityComment.count({ where }),
    ]);

    return { items, total };
  },

  // ── Find by ID ────────────────────────────────────────────────────────────

  findById(commentId: string, viewerId?: string) {
    return db.communityComment.findUnique({
      where:   { id: commentId },
      include: buildCommentInclude(viewerId),
    });
  },

  // ── Update content ────────────────────────────────────────────────────────

  update(commentId: string, content: string) {
    return db.communityComment.update({
      where:   { id: commentId },
      data:    { content },
      include: buildCommentInclude(),
    });
  },

  // ── Orphan replies before deleting parent ─────────────────────────────────
  // Sets parentId = null so replies become top-level comments.

  async orphanReplies(parentId: string) {
    return db.communityComment.updateMany({
      where: { parentId },
      data:  { parentId: null },
    });
  },

  // ── Delete ────────────────────────────────────────────────────────────────

  delete(commentId: string) {
    return db.communityComment.delete({ where: { id: commentId } });
  },

  // ── Admin: hide ───────────────────────────────────────────────────────────

  setHidden(commentId: string, hidden: boolean) {
    return db.communityComment.update({
      where: { id: commentId },
      data:  { isHiddenByAdmin: hidden },
    });
  },

  // ── Count comments for a post ─────────────────────────────────────────────

  countByPost(postId: string) {
    return db.communityComment.count({ where: { postId, isHiddenByAdmin: false } });
  },
};