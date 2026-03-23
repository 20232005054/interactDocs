"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, ChevronRight, ChevronDown, GripVertical, Plus } from "lucide-react";
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
  onReorder?: (chapters: ChapterItem[]) => void;
  onAddChapter?: () => void;
}

export function ChapterTree({
  documentId,
  chapters,
  activeChapterId,
  onAddChapter,
}: ChapterTreeProps) {
  const [expanded, setExpanded] = useState(true);

  const sortedChapters = [...chapters].sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors"
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
            {sortedChapters.map((chapter, index) => (
              <Link
                key={chapter.id}
                href={`/document/${documentId}/chapter/${chapter.id}`}
              >
                <div
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted cursor-pointer transition-colors",
                    activeChapterId === chapter.id && "bg-primary/10 text-primary border-r-2 border-primary"
                  )}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    {index + 1}. {chapter.title}
                  </span>
                </div>
              </Link>
            ))}
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
