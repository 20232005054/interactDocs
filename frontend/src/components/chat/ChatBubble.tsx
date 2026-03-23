"use client";

import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatAction } from "@/store/chatStore";

export interface ChatBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  actions?: ChatAction[];
  onActionClick?: (action: ChatAction) => void;
}

export function ChatBubble({ role, content, actions, onActionClick }: ChatBubbleProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 p-4",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      
      <div className={cn("flex-1 space-y-2", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "inline-block max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-muted text-foreground rounded-bl-sm"
          )}
        >
          {content}
        </div>
        
        {actions && actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => onActionClick?.(action)}
                className="text-xs border-primary text-primary hover:bg-primary/10"
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
