"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentHeader } from "@/components/document/ContentHeader";
import { Loader2, Plus, Trash2, Lock, Unlock, FileText, RotateCcw, Save } from "lucide-react";

interface GlobalVariable {
  key: string;
  type: "string" | "number" | "boolean";
  value: string;
  is_locked: boolean;
  description: string;
  order_index: number;
}

interface Purpose {
  id: string;
  name: string;
}

interface TemplateContentBody {
  schema?: {
    schema_json?: Array<{
      type: string;
      title: string;
    }>;
  };
  summary?: {
    title_templates?: string[];
  };
}

interface TemplateDetail {
  template_id: string;
  display_name: string;
  purpose: string;
  content: TemplateContentBody & {
    content?: TemplateContentBody;
  };
  version: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

interface DocumentDetail {
  document_id: string;
  title: string;
  content: {
    global_variables?: GlobalVariable[];
  };
  purpose: string;
  template_id: string | null;
  created_at: string;
  updated_at: string;
}

export default function DocumentOverviewPage() {
  const params = useParams();
  const documentId = params.document_id as string;
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [purposes, setPurposes] = useState<Purpose[]>([]);
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    purpose: "",
  });
  const [globalVars, setGlobalVars] = useState<GlobalVariable[]>([]);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    display_name: "",
    schema_json: [] as Array<{ type: string; title: string }>,
    title_templates: [] as string[],
  });

  // 获取文档详情
  useEffect(() => {
    const fetchDocument = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/v1/documents/${documentId}`);
        if (response.ok) {
          const result = await response.json();
          const docData: DocumentDetail = result.data;
          setDocument(docData);
          setFormData({
            title: docData.title || "",
            purpose: docData.purpose || "",
          });
          setGlobalVars(docData.content?.global_variables || []);
          
          // 如果有模板ID，获取模板详情
          if (docData.template_id) {
            fetchTemplate(docData.template_id);
          }
        }
      } catch (error) {
        console.error("获取文档详情失败:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [documentId]);

  // 获取用途列表
  useEffect(() => {
    const fetchPurposes = async () => {
      try {
        const response = await fetch("/api/v1/templates/purposes/list?is_system=true");
        if (response.ok) {
          const result = await response.json();
          const purposesData = result.data?.purposes || [];
          const mapped = purposesData.map((name: string) => ({
            id: name,
            name: name,
          }));
          setPurposes(mapped);
        }
      } catch (error) {
        console.error("获取用途列表失败:", error);
      }
    };

    fetchPurposes();
  }, []);

  // 获取模板详情
  const fetchTemplate = async (templateId: string) => {
    setLoadingTemplate(true);
    try {
      const response = await fetch(`/api/v1/templates/${templateId}`);
      if (response.ok) {
        const result = await response.json();
        const templateData: TemplateDetail = result.data;
        setTemplate(templateData);
        // 初始化编辑表单
        // 后端数据结构: content.content.schema 和 content.content.summary
        const innerContent = templateData.content?.content || templateData.content;
        setTemplateForm({
          display_name: templateData.display_name,
          schema_json: innerContent?.schema?.schema_json || [],
          title_templates: innerContent?.summary?.title_templates || [],
        });
      }
    } catch (error) {
      console.error("获取模板详情失败:", error);
    } finally {
      setLoadingTemplate(false);
    }
  };

  // 保存模板内容
  const handleSaveTemplate = async () => {
    if (!template) return;
    
    setIsSavingTemplate(true);
    try {
      const response = await fetch(`/api/v1/templates/${template.template_id}/content`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schema: {
            schema_json: templateForm.schema_json,
          },
          summary: {
            title_templates: templateForm.title_templates,
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const updatedTemplate: TemplateDetail = result.data;
        setTemplate(updatedTemplate);
        // 重新初始化编辑表单
        const innerContent = updatedTemplate.content?.content || updatedTemplate.content;
        setTemplateForm({
          display_name: updatedTemplate.display_name,
          schema_json: innerContent?.schema?.schema_json || [],
          title_templates: innerContent?.summary?.title_templates || [],
        });
        setIsEditingTemplate(false);
      }
    } catch (error) {
      console.error("保存模板失败:", error);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // 添加章节
  const handleAddChapter = () => {
    setTemplateForm({
      ...templateForm,
      schema_json: [
        ...templateForm.schema_json,
        { type: "heading-1", title: "新章节" },
      ],
    });
  };

  // 更新章节
  const handleUpdateChapter = (index: number, title: string) => {
    const newSchema = [...templateForm.schema_json];
    newSchema[index] = { ...newSchema[index], title };
    setTemplateForm({ ...templateForm, schema_json: newSchema });
  };

  // 删除章节
  const handleDeleteChapter = (index: number) => {
    setTemplateForm({
      ...templateForm,
      schema_json: templateForm.schema_json.filter((_, i) => i !== index),
    });
  };

  // 添加摘要模板
  const handleAddTitleTemplate = () => {
    setTemplateForm({
      ...templateForm,
      title_templates: [...templateForm.title_templates, "新标题"],
    });
  };

  // 更新摘要模板
  const handleUpdateTitleTemplate = (index: number, value: string) => {
    const newTemplates = [...templateForm.title_templates];
    newTemplates[index] = value;
    setTemplateForm({ ...templateForm, title_templates: newTemplates });
  };

  // 删除摘要模板
  const handleDeleteTitleTemplate = (index: number) => {
    setTemplateForm({
      ...templateForm,
      title_templates: templateForm.title_templates.filter((_, i) => i !== index),
    });
  };

  // 保存文档基本信息
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/documents/${documentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const result = await response.json();
        const updatedDoc: DocumentDetail = result.data;
        setDocument(updatedDoc);
        setFormData({
          title: updatedDoc.title,
          purpose: updatedDoc.purpose,
        });
      }
    } catch (error) {
      console.error("保存失败:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // 回退模板
  const handleRollbackTemplate = async () => {
    if (!template || !confirm("确定要回退到官方模板吗？")) return;

    try {
      const response = await fetch(`/api/v1/templates/rollback/${template.template_id}`, {
        method: "POST",
      });

      if (response.ok) {
        const result = await response.json();
        setTemplate(result.data);
      }
    } catch (error) {
      console.error("回退模板失败:", error);
    }
  };

  // 添加全局变量
  const handleAddGlobalVar = async () => {
    const newVar: GlobalVariable = {
      key: "新变量",
      type: "string",
      value: "",
      is_locked: false,
      description: "",
      order_index: globalVars.length,
    };

    try {
      const response = await fetch(`/api/v1/documents/${documentId}/global-variables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newVar),
      });

      if (response.ok) {
        const result = await response.json();
        setGlobalVars(result.data?.content?.global_variables || [...globalVars, newVar]);
      }
    } catch (error) {
      console.error("添加全局变量失败:", error);
    }
  };

  // 更新全局变量
  const handleUpdateGlobalVar = async (index: number, updates: Partial<GlobalVariable>) => {
    const updatedVars = globalVars.map((v, i) => 
      i === index ? { ...v, ...updates } : v
    );
    setGlobalVars(updatedVars);

    try {
      const response = await fetch(
        `/api/v1/documents/${documentId}/global-variables/${index}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...globalVars[index], ...updates }),
        }
      );

      if (!response.ok) {
        setGlobalVars(globalVars);
      }
    } catch (error) {
      console.error("更新全局变量失败:", error);
      setGlobalVars(globalVars);
    }
  };

  // 删除全局变量
  const handleDeleteGlobalVar = async (index: number) => {
    if (!confirm("确定要删除这个全局变量吗？")) return;

    try {
      const response = await fetch(
        `/api/v1/documents/${documentId}/global-variables/${index}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        setGlobalVars(globalVars.filter((_, i) => i !== index));
      }
    } catch (error) {
      console.error("删除全局变量失败:", error);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <ContentHeader
        title="文档基本信息"
        onSave={handleSave}
        isSaving={isSaving}
        showAIAssist={false}
      />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* 文档基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle>文档设置</CardTitle>
              <CardDescription>
                管理文档的基本信息和配置
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">文档标题</label>
                <Input
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="请输入文档标题"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">用途</label>
                <select
                  value={formData.purpose}
                  onChange={(e) =>
                    setFormData({ ...formData, purpose: e.target.value })
                  }
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">请选择用途</option>
                  {purposes.map((purpose) => (
                    <option key={purpose.id} value={purpose.id}>
                      {purpose.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">创建时间</label>
                  <div className="p-3 bg-muted rounded-md text-sm">
                    {document?.created_at
                      ? new Date(document.created_at).toLocaleString("zh-CN")
                      : "-"}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">最后更新</label>
                  <div className="p-3 bg-muted rounded-md text-sm">
                    {document?.updated_at
                      ? new Date(document.updated_at).toLocaleString("zh-CN")
                      : "-"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 模板信息 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <CardTitle>模板信息</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {template && !template.is_system && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRollbackTemplate}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      回退官方模板
                    </Button>
                  )}
                  {template && !template.is_system && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingTemplate(!isEditingTemplate)}
                    >
                      {isEditingTemplate ? "取消编辑" : "编辑模板"}
                    </Button>
                  )}
                </div>
              </div>
              <CardDescription>
                当前文档使用的模板配置
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTemplate ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : template ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">模板名称</label>
                      {isEditingTemplate ? (
                        <Input
                          value={templateForm.display_name}
                          onChange={(e) =>
                            setTemplateForm({ ...templateForm, display_name: e.target.value })
                          }
                          className="h-9"
                        />
                      ) : (
                        <div className="p-2 bg-muted rounded text-sm">{template.display_name}</div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">用途</label>
                      <div className="p-2 bg-muted rounded text-sm">{template.purpose}</div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">版本</label>
                      <div className="p-2 bg-muted rounded text-sm">v{template.version}</div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">类型</label>
                      <div className="p-2 bg-muted rounded text-sm">
                        {template.is_system ? "系统模板" : "用户模板"}
                      </div>
                    </div>
                  </div>

                  {/* 章节结构 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground">章节结构</label>
                      {isEditingTemplate && (
                        <Button variant="ghost" size="sm" onClick={handleAddChapter}>
                          <Plus className="h-3 w-3 mr-1" />
                          添加章节
                        </Button>
                      )}
                    </div>
                    {isEditingTemplate ? (
                      <div className="space-y-2">
                        {templateForm.schema_json.map((chapter, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-6">{index + 1}.</span>
                            <Input
                              value={chapter.title}
                              onChange={(e) => handleUpdateChapter(index, e.target.value)}
                              className="flex-1 h-8"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDeleteChapter(index)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : template.content?.schema?.schema_json ? (
                      <div className="p-3 bg-muted rounded">
                        <div className="flex flex-wrap gap-2">
                          {template.content.schema.schema_json.map((chapter, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-background rounded text-xs"
                            >
                              {index + 1}. {chapter.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* 摘要模板 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground">摘要模板</label>
                      {isEditingTemplate && (
                        <Button variant="ghost" size="sm" onClick={handleAddTitleTemplate}>
                          <Plus className="h-3 w-3 mr-1" />
                          添加标题
                        </Button>
                      )}
                    </div>
                    {isEditingTemplate ? (
                      <div className="space-y-2">
                        {templateForm.title_templates.map((title, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Input
                              value={title}
                              onChange={(e) => handleUpdateTitleTemplate(index, e.target.value)}
                              className="flex-1 h-8"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDeleteTitleTemplate(index)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : template.content?.summary?.title_templates ? (
                      <div className="p-3 bg-muted rounded">
                        <div className="flex flex-wrap gap-2">
                          {template.content.summary.title_templates.map((title, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-background rounded text-xs"
                            >
                              {title}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* 保存按钮 */}
                  {isEditingTemplate && (
                    <div className="flex justify-end pt-4 border-t">
                      <Button
                        onClick={handleSaveTemplate}
                        disabled={isSavingTemplate}
                        className="bg-primary hover:bg-primary/90"
                      >
                        {isSavingTemplate ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            保存中...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            保存模板
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  未使用模板
                </div>
              )}
            </CardContent>
          </Card>

          {/* 全局变量 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>全局变量</CardTitle>
                <CardDescription>
                  设置文档中可复用的全局变量
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddGlobalVar}
              >
                <Plus className="h-4 w-4 mr-1" />
                添加变量
              </Button>
            </CardHeader>
            <CardContent>
              {globalVars.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无全局变量，点击上方按钮添加
                </div>
              ) : (
                <div className="space-y-4">
                  {globalVars.map((variable, index) => (
                    <div
                      key={index}
                      className="p-4 border rounded-lg space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={variable.key}
                            onChange={(e) =>
                              handleUpdateGlobalVar(index, { key: e.target.value })
                            }
                            placeholder="变量名"
                            className="w-32"
                          />
                          <select
                            value={variable.type}
                            onChange={(e) =>
                              handleUpdateGlobalVar(index, { 
                                type: e.target.value as GlobalVariable["type"] 
                              })
                            }
                            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="string">字符串</option>
                            <option value="number">数字</option>
                            <option value="boolean">布尔</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleUpdateGlobalVar(index, { 
                                is_locked: !variable.is_locked 
                              })
                            }
                          >
                            {variable.is_locked ? (
                              <Lock className="h-4 w-4" />
                            ) : (
                              <Unlock className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteGlobalVar(index)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <Input
                        value={variable.value}
                        onChange={(e) =>
                          handleUpdateGlobalVar(index, { value: e.target.value })
                        }
                        placeholder="变量值"
                      />
                      
                      <Input
                        value={variable.description}
                        onChange={(e) =>
                          handleUpdateGlobalVar(index, { description: e.target.value })
                        }
                        placeholder="变量描述"
                        className="text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
