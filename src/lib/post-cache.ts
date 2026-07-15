// Shared helpers for patching PostRow-shaped data sitting in the
// TanStack Query cache, no matter which shape a given query holds it in:
// a plain array (team/player/user post lists, replies), a single object
// (post detail), or an infinite-query `{ pages: PostRow[][] }` (home feed).
// Used both by realtime sync (useRealtimePosts) and by optimistic
// like/repost mutations (PostCard) so both paths patch consistently.

// Every query key that can hold PostRow objects.
export const POST_QUERY_KEYS = [
  "home-posts",
  "replies",
  "replies-page",
  "post",
  "team-posts",
  "player-posts",
  "user-posts",
];

type WithId = { id: string };

export function mapPostsIn<T extends WithId>(
  data: unknown,
  id: string,
  update: (post: T) => T,
): unknown {
  if (Array.isArray(data)) {
    let changed = false;
    const next = data.map((item) => {
      const patched = mapPostsIn(item, id, update);
      if (patched !== item) {
        changed = true;
      }
      return patched;
    });
    return changed ? next : data;
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;

    if (typeof obj.id === "string" && obj.id === id) {
      return update(obj as T);
    }

    if (Array.isArray(obj.pages)) {
      let changed = false;
      const nextPages = obj.pages.map((page) => {
        const patched = mapPostsIn(page, id, update);
        if (patched !== page) {
          changed = true;
        }
        return patched;
      });
      return changed ? { ...obj, pages: nextPages } : data;
    }
  }

  return data;
}

export function removePostFrom(data: unknown, id: string): unknown {
  if (Array.isArray(data)) {
    const hasMatch = data.some(
      (item) => item && typeof item === "object" && (item as Partial<WithId>).id === id,
    );

    if (!hasMatch) {
      return data;
    }

    return data.filter(
      (item) => !(item && typeof item === "object" && (item as Partial<WithId>).id === id),
    );
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;

    if (typeof obj.id === "string" && obj.id === id) {
      return null;
    }

    if (Array.isArray(obj.pages)) {
      let changed = false;
      const nextPages = obj.pages.map((page) => {
        const patched = removePostFrom(page, id);
        if (patched !== page) {
          changed = true;
        }
        return patched;
      });
      return changed ? { ...obj, pages: nextPages } : data;
    }
  }

  return data;
}
