"use client";

import { useState, useMemo } from "react";
import { Folder, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from "next/navigation";

interface FolderTreeViewProps {
  folders: any[];
  selectedFolderId?: string;
  onFolderSelect?: (folderId: string) => void;
  className?: string;
}

interface TreeNode {
  id: string;
  name: string;
  children: TreeNode[];
}

export function FolderTreeView({
  folders,
  selectedFolderId,
  onFolderSelect,
  className,
}: FolderTreeViewProps) {
  const router = useRouter();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Build tree structure from flat folder list
  const folderTree = useMemo(() => {
    const folderMap = new Map<string, TreeNode>();
    const rootNodes: TreeNode[] = [];

    // Create map of all folders
    folders.forEach((folder: any) => {
      folderMap.set(folder.id, {
        id: folder.id,
        name: folder.name,
        children: [],
      });
    });

    // Build tree structure
    folders.forEach((folder: any) => {
      const node = folderMap.get(folder.id)!;
      if (!folder.parentFolderId) {
        rootNodes.push(node);
      } else {
        const parent = folderMap.get(folder.parentFolderId);
        if (parent) {
          parent.children.push(node);
        } else {
          // Orphan folder, add to root
          rootNodes.push(node);
        }
      }
    });

    return rootNodes;
  }, [folders]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleFolderClick = (folderId: string) => {
    onFolderSelect?.(folderId);
    router.push(`/documents/folder/${folderId}`);
  };

  const renderNode = (node: TreeNode, level: number = 0) => {
    const isExpanded = expandedFolders.has(node.id);
    const hasChildren = node.children.length > 0;
    const isSelected = selectedFolderId === node.id;

    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent transition-colors",
            isSelected && "bg-accent font-medium",
            level > 0 && "ml-4"
          )}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => handleFolderClick(node.id)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(node.id);
              }}
              className="p-0.5 hover:bg-accent rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <div className="w-5" /> // Spacer
          )}
          <Folder className="h-4 w-4 text-yellow-500" />
          <span className="text-sm flex-1 truncate">{node.name}</span>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("border rounded-lg bg-background", className)}>
      <div className="p-3 border-b">
        <h3 className="font-semibold text-sm">Folders</h3>
      </div>
      <ScrollArea className="h-[calc(100vh-20rem)]">
        <div className="p-2">
          {folderTree.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">
              No folders available
            </p>
          ) : (
            folderTree.map((node) => renderNode(node))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
