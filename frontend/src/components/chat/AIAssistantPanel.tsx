"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Sparkles, X } from "lucide-react";
import { ChatBubble } from "./ChatBubble";
import { useChatStore, ChatAction } from "@/store/chatStore";
import { useAIStore } from "@/store/aiStore";
import { cn } from "@/lib/utils";

export interface AIAssistantPanelProps {
  onApplySuggestion?: (content: string) => void;
  className?: string;
}

export function AIAssistantPanel({ onApplySuggestion, className }: AIAssistantPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { messages, isGenerating, addMessage, updateLastMessage, setIsGenerating, addActionToLastMessage } = useChatStore();
  const { selectedContext, clearSelectedContext } = useAIStore();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isGenerating) return;

    const userMessage = inputValue.trim();
    setInputValue("");

    addMessage({
      role: "user",
      content: userMessage,
    });

    setIsGenerating(true);

    addMessage({
      role: "assistant",
      content: "",
    });

    try {
      const response = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          context: selectedContext,
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                setIsGenerating(false);
                return;
              }
              
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  updateLastMessage(parsed.content);
                }
                if (parsed.action) {
                  addActionToLastMessage(parsed.action);
                }
              } catch {
                updateLastMessage(data);
              }
            }
          }
        }
      }
    } catch {
      updateLastMessage("抱歉，发生了错误，请稍后重试。");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleActionClick = (action: ChatAction) => {
    if (action.type === "apply" || action.type === "replace") {
      onApplySuggestion?.(action.payload);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-card border-l", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">AI 助手</h2>
        </div>
      </div>

      {selectedContext.content && (
        <div className="px-4 py-2 bg-primary/5 border-b">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">已选中上下文：</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4"
              onClick={clearSelectedContext}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-sm truncate mt-1">{selectedContext.content}</p>
        </div>
      )}

      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="py-4">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">开始与 AI 对话</p>
              <p className="text-xs mt-1">选中编辑器中的文字，让 AI 帮您扩写或修改</p>
            </div>
          ) : (
            messages.map((message) => (
              <ChatBubble
                key={message.id}
                role={message.role}
                content={message.content}
                actions={message.actions}
                onActionClick={handleActionClick}
              />
            ))
          )}
          {isGenerating && (
            <div className="px-4 py-2 text-sm text-muted-foreground">
              AI 正在思考...
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            disabled={isGenerating}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isGenerating}
            size="icon"
            className="bg-primary hover:bg-primary/90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
