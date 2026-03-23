"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ContentHeader } from "@/components/document/ContentHeader";
import {
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
  Check,
  RefreshCcw,
} from "lucide-react";

interface ParagraphItem {
  paragraph_id: string;
  chapter_id: string;
  content: string;
  para_type: string;
  order_index: number;
  ai_eval?: string | null;
  ai_suggestion?: string | null;
  ai_generate?: string | null;
  ischange?: number;
}

interface ChapterDetail {
  chapter_id: string;
  document_id: string;
  title: string;
  status: number;
  order_index: number;
  updated_at: string;
  paragraphs: ParagraphItem[];
}

type BusyAction =
  | "save"
  | "delete"
  | "insert"
  | "assist"
  | "evaluate"
  | "apply"
  | null;

const paraTypeOptions = [
  { value: "paragraph", label: "正文" },
  { value: "heading-1", label: "一级标题" },
  { value: "heading-2", label: "二级标题" },
  { value: "heading-3", label: "三级标题" },
];

async function consumeSSE(response: Response) {
  if (!response.body) {
    return [];
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const line = chunk
        .split("\n")
        .find((item) => item.trim().startsWith("data:"));

      if (!line) {
        continue;
      }

      const raw = line.replace(/^data:\s*/, "").trim();
      if (!raw || raw === "[DONE]") {
        continue;
      }

      events.push(raw);
    }
  }

  return events;
}

export default function ChapterPage() {
  const params = useParams();
  const chapterId = params.chapter_id as string;

  const [chapter, setChapter] = useState<ChapterDetail | null>(null);
  const [paragraphs, setParagraphs] = useState<ParagraphItem[]>([]);
  const [selectedParagraphId, setSelectedParagraphId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emptyParagraphContent, setEmptyParagraphContent] = useState("");
  const [busyParagraphId, setBusyParagraphId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [isGeneratingChapter, setIsGeneratingChapter] = useState(false);
  const [isCreatingParagraph, setIsCreatingParagraph] = useState(false);

  const sortedParagraphs = useMemo(
    () => [...paragraphs].sort((a, b) => a.order_index - b.order_index),
    [paragraphs]
  );

  const selectedParagraph = useMemo(
    () =>
      sortedParagraphs.find(
        (item) => item.paragraph_id === selectedParagraphId
      ) || null,
    [selectedParagraphId, sortedParagraphs]
  );

  const loadChapter = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/chapters/${chapterId}`);
      if (!response.ok) {
        throw new Error("加载章节详情失败");
      }

      const result = await response.json();
      const chapterData: ChapterDetail = result.data;
      setChapter(chapterData);
      setParagraphs(chapterData.paragraphs || []);
      setSelectedParagraphId((current) => {
        if (
          current &&
          chapterData.paragraphs?.some(
            (item) => item.paragraph_id === current
          )
        ) {
          return current;
        }

        return chapterData.paragraphs?.[0]?.paragraph_id || null;
      });
      setError(null);
    } catch (loadError) {
      console.error("加载章节详情失败:", loadError);
      setError("加载章节详情失败");
      setChapter(null);
      setParagraphs([]);
      setSelectedParagraphId(null);
    } finally {
      setLoading(false);
    }
  }, [chapterId]);

  useEffect(() => {
    void loadChapter();
  }, [loadChapter]);

  const updateLocalParagraph = (
    paragraphId: string,
    updates: Partial<ParagraphItem>
  ) => {
    setParagraphs((current) =>
      current.map((item) =>
        item.paragraph_id === paragraphId ? { ...item, ...updates } : item
      )
    );
  };

  const handleSelectParagraphType = (paraType: string) => {
    if (!selectedParagraphId) {
      return;
    }

    updateLocalParagraph(selectedParagraphId, {
      para_type: paraType,
    });
  };

  const withParagraphBusy = async (
    paragraphId: string,
    action: Exclude<BusyAction, null>,
    task: () => Promise<void>
  ) => {
    setBusyParagraphId(paragraphId);
    setBusyAction(action);
    setMessage(null);
    setError(null);

    try {
      await task();
    } finally {
      setBusyParagraphId(null);
      setBusyAction(null);
    }
  };

  const handleSaveParagraph = async (paragraph: ParagraphItem) => {
    await withParagraphBusy(paragraph.paragraph_id, "save", async () => {
      const response = await fetch(`/api/v1/paragraphs/${paragraph.paragraph_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: paragraph.content,
          para_type: paragraph.para_type,
          order_index: paragraph.order_index,
          ai_eval: paragraph.ai_eval,
          ai_suggestion: paragraph.ai_suggestion,
          ai_generate: paragraph.ai_generate,
          ischange: paragraph.ischange,
        }),
      });

      if (!response.ok) {
        throw new Error("保存段落失败");
      }

      const result = await response.json();
      updateLocalParagraph(paragraph.paragraph_id, result.data);
      setMessage("段落已保存");
    }).catch((saveError) => {
      console.error("保存段落失败:", saveError);
      setError("保存段落失败");
    });
  };

  const handleDeleteParagraph = async (paragraphId: string) => {
    const confirmed = window.confirm("确定要删除这个段落吗？");
    if (!confirmed) {
      return;
    }

    await withParagraphBusy(paragraphId, "delete", async () => {
      const response = await fetch(`/api/v1/paragraphs/${paragraphId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("删除段落失败");
      }

      await loadChapter();
      setMessage("段落已删除");
    }).catch((deleteError) => {
      console.error("删除段落失败:", deleteError);
      setError("删除段落失败");
    });
  };

  const handleInsertParagraphAfter = async (paragraphId: string) => {
    await withParagraphBusy(paragraphId, "insert", async () => {
      const response = await fetch(
        `/api/v1/paragraphs/${paragraphId}/insert-after`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "" }),
        }
      );

      if (!response.ok) {
        throw new Error("新增段落失败");
      }

      await loadChapter();
      setMessage("已在当前段落后新增段落");
    }).catch((insertError) => {
      console.error("新增段落失败:", insertError);
      setError("新增段落失败");
    });
  };

  const handleAIAssist = async (paragraphId: string) => {
    await withParagraphBusy(paragraphId, "assist", async () => {
      const response = await fetch(`/api/v1/paragraphs/${paragraphId}/ai/assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error("AI 帮填失败");
      }

      await consumeSSE(response);
      await loadChapter();
      setMessage("AI 帮填已完成");
    }).catch((assistError) => {
      console.error("AI 帮填失败:", assistError);
      setError("AI 帮填失败");
    });
  };

  const handleAIEvaluate = async (paragraphId: string) => {
    await withParagraphBusy(paragraphId, "evaluate", async () => {
      const response = await fetch(
        `/api/v1/paragraphs/${paragraphId}/ai/evaluate`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("AI 评估失败");
      }

      await consumeSSE(response);
      await loadChapter();
      setMessage("AI 评估已完成");
    }).catch((evaluateError) => {
      console.error("AI 评估失败:", evaluateError);
      setError("AI 评估失败");
    });
  };

  const handleApplyAI = async (paragraphId: string) => {
    await withParagraphBusy(paragraphId, "apply", async () => {
      const response = await fetch(`/api/v1/paragraphs/${paragraphId}/ai/apply`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("应用 AI 结果失败");
      }

      await loadChapter();
      setMessage("AI 帮填结果已应用");
    }).catch((applyError) => {
      console.error("应用 AI 结果失败:", applyError);
      setError("应用 AI 结果失败");
    });
  };

  const handleGenerateChapterContent = async () => {
    setIsGeneratingChapter(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/v1/chapters/${chapterId}/generate-content`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("生成章节内容失败");
      }

      await consumeSSE(response);
      await loadChapter();
      setMessage("章节内容已生成");
    } catch (generateError) {
      console.error("生成章节内容失败:", generateError);
      setError("生成章节内容失败");
    } finally {
      setIsGeneratingChapter(false);
    }
  };

  const handleCreateParagraph = async () => {
    setIsCreatingParagraph(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/v1/chapters/${chapterId}/paragraphs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: emptyParagraphContent }),
      });

      if (!response.ok) {
        throw new Error("创建段落失败");
      }

      setEmptyParagraphContent("");
      await loadChapter();
      setMessage("段落已创建");
    } catch (createError) {
      console.error("创建段落失败:", createError);
      setError("创建段落失败");
    } finally {
      setIsCreatingParagraph(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
        <span className="text-muted-foreground">加载章节中...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ContentHeader title={chapter?.title || "章节内容"} showAIAssist={false} />

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {sortedParagraphs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>段落类型</CardTitle>
                <CardDescription>
                  先点击下方某个段落，再在这里切换当前段落的类型。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  {selectedParagraph
                    ? `当前已选中段落，类型为 ${selectedParagraph.para_type}`
                    : "请先点击一个段落"}
                </div>
                <div className="flex flex-wrap gap-2">
                  {paraTypeOptions.map((item) => (
                    <Button
                      key={item.value}
                      type="button"
                      variant={
                        selectedParagraph?.para_type === item.value
                          ? "default"
                          : "outline"
                      }
                      onClick={() => handleSelectParagraphType(item.value)}
                      disabled={!selectedParagraph}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {(message || error) && (
            <div
              className={
                error
                  ? "rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                  : "rounded-md border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary"
              }
            >
              {error || message}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{chapter?.title || "章节"}</CardTitle>
              <CardDescription>
                按段落编辑章节内容，并支持 AI 帮填、评估和结果应用。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sortedParagraphs.length === 0 ? (
                <div className="space-y-4">
                  <div className="rounded-md bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
                    当前章节还没有段落内容。
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={handleGenerateChapterContent}
                      disabled={isGeneratingChapter}
                    >
                      {isGeneratingChapter ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          生成中
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          从摘要生成章节内容
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="space-y-3 rounded-lg border p-4">
                    <label className="text-sm font-medium">新建首个段落</label>
                    <Textarea
                      value={emptyParagraphContent}
                      onChange={(e) => setEmptyParagraphContent(e.target.value)}
                      rows={4}
                      placeholder="输入段落内容，可留空创建空段落"
                    />
                    <Button
                      variant="outline"
                      onClick={handleCreateParagraph}
                      disabled={isCreatingParagraph}
                    >
                      {isCreatingParagraph ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          创建中
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          创建段落
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                sortedParagraphs.map((paragraph, index) => {
                  const isBusy = busyParagraphId === paragraph.paragraph_id;
                  const isSelected =
                    selectedParagraphId === paragraph.paragraph_id;

                  return (
                    <Card
                      key={paragraph.paragraph_id}
                      className={
                        isSelected
                          ? "border-2 border-primary"
                          : "border-dashed"
                      }
                      onClick={() =>
                        setSelectedParagraphId(paragraph.paragraph_id)
                      }
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <CardTitle className="text-base">
                              段落 {index + 1}
                            </CardTitle>
                            <CardDescription>
                              排序 {paragraph.order_index + 1} | 类型 {paragraph.para_type}
                            </CardDescription>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleInsertParagraphAfter(paragraph.paragraph_id);
                              }}
                              disabled={isBusy}
                            >
                              <Plus className="mr-1 h-3.5 w-3.5" />
                              后插入
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleDeleteParagraph(paragraph.paragraph_id);
                              }}
                              disabled={isBusy}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              删除
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">段落内容</label>
                          <Textarea
                            value={paragraph.content}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(e) =>
                              updateLocalParagraph(paragraph.paragraph_id, {
                                content: e.target.value,
                              })
                            }
                            rows={6}
                            disabled={isBusy}
                            placeholder="请输入段落内容"
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleSaveParagraph(paragraph);
                            }}
                            disabled={isBusy}
                          >
                            {isBusy && busyAction === "save" ? (
                              <>
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                保存中
                              </>
                            ) : (
                              "保存段落"
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleAIAssist(paragraph.paragraph_id);
                            }}
                            disabled={isBusy || paragraph.para_type !== "paragraph"}
                          >
                            {isBusy && busyAction === "assist" ? (
                              <>
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                帮填中
                              </>
                            ) : (
                              <>
                                <Wand2 className="mr-1 h-3.5 w-3.5" />
                                AI 帮填
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleAIEvaluate(paragraph.paragraph_id);
                            }}
                            disabled={isBusy}
                          >
                            {isBusy && busyAction === "evaluate" ? (
                              <>
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                评估中
                              </>
                            ) : (
                              <>
                                <RefreshCcw className="mr-1 h-3.5 w-3.5" />
                                AI 评估
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleApplyAI(paragraph.paragraph_id);
                            }}
                            disabled={isBusy || !paragraph.ai_generate}
                          >
                            {isBusy && busyAction === "apply" ? (
                              <>
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                应用中
                              </>
                            ) : (
                              <>
                                <Check className="mr-1 h-3.5 w-3.5" />
                                应用 AI 结果
                              </>
                            )}
                          </Button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">AI 帮填结果</label>
                            <Textarea
                              value={paragraph.ai_generate || ""}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(e) =>
                                updateLocalParagraph(paragraph.paragraph_id, {
                                  ai_generate: e.target.value,
                                })
                              }
                              rows={5}
                              disabled={isBusy}
                              placeholder="AI 帮填结果会显示在这里"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">AI 评估结果</label>
                            <Textarea
                              value={paragraph.ai_eval || ""}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(e) =>
                                updateLocalParagraph(paragraph.paragraph_id, {
                                  ai_eval: e.target.value,
                                })
                              }
                              rows={5}
                              disabled={isBusy}
                              placeholder="AI 评估结果会显示在这里"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">AI 修改建议</label>
                          <Textarea
                            value={paragraph.ai_suggestion || ""}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(e) =>
                              updateLocalParagraph(paragraph.paragraph_id, {
                                ai_suggestion: e.target.value,
                              })
                            }
                            rows={4}
                            disabled={isBusy}
                            placeholder="AI 建议会显示在这里"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
