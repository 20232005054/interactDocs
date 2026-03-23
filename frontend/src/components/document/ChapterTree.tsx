"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface ChapterItem {
  id: string;
  title: string;
  order: number;
}

export interface ChapterTreeProps {
  documentId: string;
  chapters: ChapterItem[];
  activeChapterId?: string;
  onAddChapter?: () => void | Promise<void>;
  onRenameChapter?: (chapterId: string, title: string) => void | Promise<void>;
  onDeleteChapter?: (chapterId: string) => void | Promise<void>;
}

export function ChapterTree({
  documentId,
  chapters,
  activeChapterId,
  onAddChapter,
  onRenameChapter,
  onDeleteChapter,
}: ChapterTreeProps) {
  const [expanded, setExpanded] = useState(true);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const sortedChapters = [...chapters].sort((a, b) => a.order - b.order);

  const startEdit = (chapterId: string, title: string) => {
    setEditingChapterId(chapterId);
    setEditingTitle(title);
  };

  const cancelEdit = () => {
    setEditingChapterId(null);
    setEditingTitle("");
  };

  const submitEdit = async () => {
    if (!editingChapterId || !editingTitle.trim() || !onRenameChapter) {
      cancelEdit();
      return;
    }

    await onRenameChapter(editingChapterId, editingTitle.trim());
    cancelEdit();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          章节目录
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onAddChapter}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {expanded && (
        <ScrollArea className="flex-1">
          <div className="py-2">
            {sortedChapters.map((chapter, index) => {
              const isEditing = editingChapterId === chapter.id;

              return (
                <div
                  key={chapter.id}
                  className={cn(
                    "group mx-2 mb-1 rounded-md",
                    activeChapterId === chapter.id && "bg-primary/10 text-primary"
                  )}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-2 px-2 py-2">
                      <span className="w-6 text-xs text-muted-foreground">
                        {index + 1}.
                      </span>
                      <Input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            void submitEdit();
                          }
                          if (e.key === "Escape") {
                            cancelEdit();
                          }
                        }}
                        className="h-8 flex-1"
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => void submitEdit()}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={cancelEdit}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-2 py-2 text-sm transition-colors hover:bg-muted/80">
                      <Link
                        href={`/document/${documentId}/chapter/${chapter.id}`}
                        className="flex min-w-0 flex-1 items-center gap-2"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">
                          {index + 1}. {chapter.title}
                        </span>
                      </Link>
                      <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => startEdit(chapter.id, chapter.title)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => void onDeleteChapter?.(chapter.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {sortedChapters.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                暂无章节
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
