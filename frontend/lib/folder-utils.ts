/**
 * Folder tree helpers for document counts.
 *
 * Registry-style parent folders often hold no files themselves — only nested
 * folders do. The UI should show how many documents live under a folder,
 * including descendants, not just direct FileFolderLink rows.
 */

/** Every folder id in the subtree rooted at `folderId` (including itself). */
export function collectFolderSubtreeIds(
  folderId: string,
  folders: Array<{ id: string; parentFolderId?: string | null }>,
): Set<string> {
  const ids = new Set<string>();
  const childrenByParent = new Map<string, string[]>();

  for (const folder of folders) {
    const parentId = folder.parentFolderId;
    if (!parentId) continue;
    const list = childrenByParent.get(parentId);
    if (list) list.push(folder.id);
    else childrenByParent.set(parentId, [folder.id]);
  }

  const stack = [folderId];
  while (stack.length) {
    const id = stack.pop()!;
    if (ids.has(id)) continue;
    ids.add(id);
    const children = childrenByParent.get(id);
    if (children) stack.push(...children);
  }

  return ids;
}

export function documentBelongsToFolder(
  document: {
    folderId?: string | null;
    folderIds?: string[] | null;
  },
  folderIds: Set<string>,
): boolean {
  if (document.folderId && folderIds.has(document.folderId)) return true;
  if (Array.isArray(document.folderIds)) {
    return document.folderIds.some((id) => folderIds.has(id));
  }
  return false;
}

/** Count of documents linked to `folderId` or any nested folder beneath it. */
export function countDocumentsInFolderTree(
  folderId: string,
  folders: Array<{ id: string; parentFolderId?: string | null }>,
  documents: Array<{
    folderId?: string | null;
    folderIds?: string[] | null;
  }>,
): number {
  const subtree = collectFolderSubtreeIds(folderId, folders);
  return documents.filter((doc) => documentBelongsToFolder(doc, subtree)).length;
}
