"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

interface Purpose {
  id: string;
  name: string;
}

interface Template {
  id: string;
  name: string;
}

export default function CreateDocumentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [purposes, setPurposes] = useState<Purpose[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingPurposes, setLoadingPurposes] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    purpose: "",
    template_id: "",
  });

  // 任务 1: 获取用途列表
  useEffect(() => {
    const fetchPurposes = async () => {
      setLoadingPurposes(true);
      try {
        const response = await fetch("/api/v1/templates/purposes/list?is_system=true");
        if (response.ok) {
          const result = await response.json();
          // 后端返回格式: {code: 200, message: "成功", data: {purposes: [...]}}
          const purposesData = result.data?.purposes || [];
          const mappedPurposes = purposesData.map((name: string, index: number) => ({
            id: name,
            name: name,
          }));
          setPurposes(mappedPurposes);
          // 默认选择第一个用途
          if (mappedPurposes.length > 0) {
            setFormData(prev => ({ ...prev, purpose: mappedPurposes[0].id }));
          }
        } else {
          setError("获取用途列表失败");
        }
      } catch (err) {
        console.error("获取用途列表失败:", err);
        setError("获取用途列表失败，请检查网络连接");
      } finally {
        setLoadingPurposes(false);
      }
    };

    fetchPurposes();
  }, []);

  // 任务 2: 获取模板列表
  useEffect(() => {
    if (!formData.purpose) {
      setTemplates([]);
      setFormData(prev => ({ ...prev, template_id: "" }));
      return;
    }

    const fetchTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const response = await fetch(
          `/api/v1/templates?purpose=${formData.purpose}&is_system=true&is_active=true`
        );
        if (response.ok) {
          const result = await response.json();
          // 后端返回格式: {code: 200, message: "成功", data: {items: [...]}}
          const templatesData = result.data?.items || [];
          // 映射模板数据，适配前端结构
          const mappedTemplates = templatesData.map((template: any) => ({
            id: template.template_id,
            name: template.display_name,
          }));
          setTemplates(mappedTemplates);
          // 默认选择第一个模板
          if (mappedTemplates.length > 0) {
            setFormData(prev => ({ ...prev, template_id: mappedTemplates[0].id }));
          } else {
            setFormData(prev => ({ ...prev, template_id: "" }));
          }
        } else {
          setTemplates([]);
          setFormData(prev => ({ ...prev, template_id: "" }));
        }
      } catch (err) {
        console.error("获取模板列表失败:", err);
        setTemplates([]);
        setFormData(prev => ({ ...prev, template_id: "" }));
      } finally {
        setLoadingTemplates(false);
      }
    };

    fetchTemplates();
  }, [formData.purpose]);

  // 任务 3: 创建文档
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        // 创建成功后跳转到文档编辑页面
        router.push(`/document/${data.id}`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || "创建文档失败，请重试");
      }
    } catch (err) {
      console.error("创建文档失败:", err);
      setError("创建文档失败，请检查网络连接");
    } finally {
      setLoading(false);
    }
  };

  // 任务 4: 加载状态
  const isFormLoading = loadingPurposes;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/documents">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回文档列表
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>创建新文档</CardTitle>
              <CardDescription>
                填写基本信息开始创建您的文档
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 错误提示 */}
          {error && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {isFormLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">加载中...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 文档标题 */}
              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium">
                  文档标题 <span className="text-destructive">*</span>
                </label>
                <Input
                  id="title"
                  placeholder="请输入文档标题"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  required
                />
              </div>

              {/* 用途选择 */}
              <div className="space-y-2">
                <label htmlFor="purpose" className="text-sm font-medium">
                  文档用途 <span className="text-destructive">*</span>
                </label>
                <select
                  id="purpose"
                  value={formData.purpose}
                  onChange={(e) =>
                    setFormData({ ...formData, purpose: e.target.value, template_id: "" })
                  }
                  required
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">请选择用途</option>
                  {purposes.map((purpose) => (
                    <option key={purpose.id} value={purpose.id}>
                      {purpose.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 模板选择 */}
              <div className="space-y-2">
                <label htmlFor="template" className="text-sm font-medium">
                  模板选择 <span className="text-destructive">*</span>
                </label>
                <select
                  id="template"
                  value={formData.template_id}
                  onChange={(e) =>
                    setFormData({ ...formData, template_id: e.target.value })
                  }
                  required
                  disabled={!formData.purpose || loadingTemplates}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {loadingTemplates ? "加载中..." : "请选择模板"}
                  </option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                {formData.purpose && !loadingTemplates && templates.length === 0 && (
                  <p className="text-sm text-muted-foreground">该用途下暂无模板</p>
                )}
              </div>

              {/* 提交按钮 */}
              <div className="flex justify-end gap-3 pt-4">
                <Link href="/documents">
                  <Button variant="outline" type="button">
                    取消
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={loading || !formData.title.trim() || !formData.purpose || !formData.template_id}
                  className="bg-primary hover:bg-primary/90"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    "创建文档"
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
