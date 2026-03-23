"use client";

import { Button } from "@/components/ui/button";
import { Save, Sparkles } from "lucide-react";

export interface ContentHeaderProps {
  title: string;
  onSave?: () => void;
  onAIAssist?: () => void;
  isSaving?: boolean;
  showAIAssist?: boolean;
}

export function ContentHeader({
  title,
  onSave,
  onAIAssist,
  isSaving = false,
  showAIAssist = true,
}: ContentHeaderProps) {
  return (
    <div className="flex items-center justify-between py-4 px-6 border-b bg-card">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="flex items-center gap-2">
        {showAIAssist && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAIAssist}
            className="border-primary text-primary hover:bg-primary/10"
          >
            <Sparkles className="h-4 w-4 mr-1" />
            AI 帮填
          </Button>
        )}
        <Button
          size="sm"
          onClick={onSave}
          disabled={isSaving}
          className="bg-primary hover:bg-primary/90"
        >
          <Save className="h-4 w-4 mr-1" />
          {isSaving ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}
