'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Modal } from '@/components/ui/modal';
import { useParams, useRouter } from 'next/navigation';
import { templateService, Template } from '@/services/templateService';
import { coreInfoTemplateService, CoreInfoTemplate, CoreInfoTemplateCreate, CoreInfoTemplateUpdate } from '@/services/coreInfoTemplateService';
import { structureTemplateService, StructureTemplate, StructureTemplateCreate, StructureTemplateUpdate } from '@/services/structureTemplateService';
import { summaryTemplateService, SummaryTemplate, SummaryTemplateCreate, SummaryTemplateUpdate } from '@/services/summaryTemplateService';
import CoreInfoTemplateForm from '@/components/template/CoreInfoTemplateForm';
import StructureTemplateForm from '@/components/template/StructureTemplateForm';
import StructureTree from '@/components/template/StructureTree';
import SummaryTemplateForm from '@/components/template/SummaryTemplateForm';

const TemplateDetailPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const templateId = params.template_id as string;
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'core' | 'structure' | 'summary'>('core');
  
  // 核心信息模板相关状态
  const [coreInfoTemplates, setCoreInfoTemplates] = useState<CoreInfoTemplate[]>([]);
  const [coreInfoLoading, setCoreInfoLoading] = useState(false);
  const [isCoreInfoCreateModalOpen, setIsCoreInfoCreateModalOpen] = useState(false);
  const [isCoreInfoEditModalOpen, setIsCoreInfoEditModalOpen] = useState(false);
  const [isCoreInfoDeleteModalOpen, setIsCoreInfoDeleteModalOpen] = useState(false);
  const [editingCoreInfoTemplate, setEditingCoreInfoTemplate] = useState<CoreInfoTemplate | null>(null);
  const [deletingCoreInfoTemplateId, setDeletingCoreInfoTemplateId] = useState<string | null>(null);
  const [coreInfoFormLoading, setCoreInfoFormLoading] = useState(false);
  const [coreInfoDeleteLoading, setCoreInfoDeleteLoading] = useState(false);
  
  // 结构模板相关状态
  const [structureTemplates, setStructureTemplates] = useState<StructureTemplate[]>([]);
  const [structureTree, setStructureTree] = useState<StructureTemplate[]>([]);
  const [structureLoading, setStructureLoading] = useState(false);
  const [isStructureCreateModalOpen, setIsStructureCreateModalOpen] = useState(false);
  const [isStructureEditModalOpen, setIsStructureEditModalOpen] = useState(false);
  const [isStructureDeleteModalOpen, setIsStructureDeleteModalOpen] = useState(false);
  const [editingStructureTemplate, setEditingStructureTemplate] = useState<StructureTemplate | null>(null);
  const [deletingStructureTemplateId, setDeletingStructureTemplateId] = useState<string | null>(null);
  const [structureFormLoading, setStructureFormLoading] = useState(false);
  const [structureDeleteLoading, setStructureDeleteLoading] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  
  // 摘要模板相关状态
  const [summaryTemplates, setSummaryTemplates] = useState<SummaryTemplate[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [isSummaryCreateModalOpen, setIsSummaryCreateModalOpen] = useState(false);
  const [isSummaryEditModalOpen, setIsSummaryEditModalOpen] = useState(false);
  const [isSummaryDeleteModalOpen, setIsSummaryDeleteModalOpen] = useState(false);
  const [editingSummaryTemplate, setEditingSummaryTemplate] = useState<SummaryTemplate | null>(null);
  const [deletingSummaryTemplateId, setDeletingSummaryTemplateId] = useState<string | null>(null);
  const [summaryFormLoading, setSummaryFormLoading] = useState(false);
  const [summaryDeleteLoading, setSummaryDeleteLoading] = useState(false);

  // 获取模板详情
  useEffect(() => {
    const fetchTemplate = async () => {
      setLoading(true);
      const data = await templateService.getTemplate(templateId);
      setTemplate(data);
      setLoading(false);
    };
    fetchTemplate();
  }, [templateId]);

  // 获取核心信息模板列表
  useEffect(() => {
    const fetchCoreInfoTemplates = async () => {
      setCoreInfoLoading(true);
      const data = await coreInfoTemplateService.getByTemplateId(templateId);
      setCoreInfoTemplates(data);
      setCoreInfoLoading(false);
    };
    fetchCoreInfoTemplates();
  }, [templateId]);

  // 获取结构模板列表和结构树
  useEffect(() => {
    const fetchStructureTemplates = async () => {
      setStructureLoading(true);
      try {
        // 获取结构模板列表
        const templates = await structureTemplateService.getByTemplateId(templateId);
        setStructureTemplates(templates);
        
        // 获取结构树
        const tree = await structureTemplateService.getStructureTree(templateId);
        setStructureTree(tree);
      } catch (error) {
        console.error('Error fetching structure templates:', error);
      } finally {
        setStructureLoading(false);
      }
    };
    fetchStructureTemplates();
  }, [templateId]);

  // 获取摘要模板列表
  useEffect(() => {
    const fetchSummaryTemplates = async () => {
      setSummaryLoading(true);
      try {
        const templates = await summaryTemplateService.getByTemplateId(templateId);
        setSummaryTemplates(templates);
      } catch (error) {
        console.error('Error fetching summary templates:', error);
      } finally {
        setSummaryLoading(false);
      }
    };
    fetchSummaryTemplates();
  }, [templateId]);

  // 打开创建核心信息模板模态框
  const handleOpenCoreInfoCreateModal = () => {
    setIsCoreInfoCreateModalOpen(true);
  };

  // 打开编辑核心信息模板模态框
  const handleOpenCoreInfoEditModal = (coreInfoTemplate: CoreInfoTemplate) => {
    setEditingCoreInfoTemplate(coreInfoTemplate);
    setIsCoreInfoEditModalOpen(true);
  };

  // 打开删除核心信息模板模态框
  const handleOpenCoreInfoDeleteModal = (coreTemplateId: string) => {
    setDeletingCoreInfoTemplateId(coreTemplateId);
    setIsCoreInfoDeleteModalOpen(true);
  };

  // 处理核心信息模板创建
  const handleCreateCoreInfoTemplate = async (data: CoreInfoTemplateCreate | CoreInfoTemplateUpdate) => {
    setCoreInfoFormLoading(true);
    try {
      const newCoreInfoTemplate = await coreInfoTemplateService.create(data as CoreInfoTemplateCreate);
      if (newCoreInfoTemplate) {
        // 重新获取核心信息模板列表
        const updatedCoreInfoTemplates = await coreInfoTemplateService.getByTemplateId(templateId);
        setCoreInfoTemplates(updatedCoreInfoTemplates);
        setIsCoreInfoCreateModalOpen(false);
      }
    } catch (error) {
      console.error('Error creating core info template:', error);
    } finally {
      setCoreInfoFormLoading(false);
    }
  };

  // 处理核心信息模板编辑
  const handleEditCoreInfoTemplate = async (data: CoreInfoTemplateCreate | CoreInfoTemplateUpdate) => {
    if (!editingCoreInfoTemplate) return;
    
    setCoreInfoFormLoading(true);
    try {
      const updatedCoreInfoTemplate = await coreInfoTemplateService.update(
        editingCoreInfoTemplate.core_template_id,
        data as CoreInfoTemplateUpdate
      );
      if (updatedCoreInfoTemplate) {
        // 重新获取核心信息模板列表
        const updatedCoreInfoTemplates = await coreInfoTemplateService.getByTemplateId(templateId);
        setCoreInfoTemplates(updatedCoreInfoTemplates);
        setIsCoreInfoEditModalOpen(false);
        setEditingCoreInfoTemplate(null);
      }
    } catch (error) {
      console.error('Error updating core info template:', error);
    } finally {
      setCoreInfoFormLoading(false);
    }
  };

  // 处理核心信息模板删除
  const handleDeleteCoreInfoTemplate = async () => {
    if (!deletingCoreInfoTemplateId) return;
    
    setCoreInfoDeleteLoading(true);
    try {
      const success = await coreInfoTemplateService.delete(deletingCoreInfoTemplateId);
      if (success) {
        // 重新获取核心信息模板列表
        const updatedCoreInfoTemplates = await coreInfoTemplateService.getByTemplateId(templateId);
        setCoreInfoTemplates(updatedCoreInfoTemplates);
        setIsCoreInfoDeleteModalOpen(false);
        setDeletingCoreInfoTemplateId(null);
      }
    } catch (error) {
      console.error('Error deleting core info template:', error);
    } finally {
      setCoreInfoDeleteLoading(false);
    }
  };

  // 处理取消操作
  const handleCoreInfoCancel = () => {
    setIsCoreInfoCreateModalOpen(false);
    setIsCoreInfoEditModalOpen(false);
    setIsCoreInfoDeleteModalOpen(false);
    setEditingCoreInfoTemplate(null);
    setDeletingCoreInfoTemplateId(null);
  };

  // 打开创建结构模板模态框
  const handleOpenStructureCreateModal = (parentId: string | null = null) => {
    setSelectedParentId(parentId);
    setIsStructureCreateModalOpen(true);
  };

  // 打开编辑结构模板模态框
  const handleOpenStructureEditModal = (structureTemplate: StructureTemplate) => {
    setEditingStructureTemplate(structureTemplate);
    setIsStructureEditModalOpen(true);
  };

  // 打开删除结构模板模态框
  const handleOpenStructureDeleteModal = (structureTemplateId: string) => {
    setDeletingStructureTemplateId(structureTemplateId);
    setIsStructureDeleteModalOpen(true);
  };

  // 处理结构模板创建
  const handleCreateStructureTemplate = async (data: StructureTemplateCreate | StructureTemplateUpdate) => {
    setStructureFormLoading(true);
    try {
      const newStructureTemplate = await structureTemplateService.create(data as StructureTemplateCreate);
      if (newStructureTemplate) {
        // 重新获取结构模板列表和结构树
        const templates = await structureTemplateService.getByTemplateId(templateId);
        setStructureTemplates(templates);
        
        const tree = await structureTemplateService.getStructureTree(templateId);
        setStructureTree(tree);
        
        setIsStructureCreateModalOpen(false);
        setSelectedParentId(null);
      }
    } catch (error) {
      console.error('Error creating structure template:', error);
    } finally {
      setStructureFormLoading(false);
    }
  };

  // 处理结构模板编辑
  const handleEditStructureTemplate = async (data: StructureTemplateCreate | StructureTemplateUpdate) => {
    if (!editingStructureTemplate) return;
    
    setStructureFormLoading(true);
    try {
      const updatedStructureTemplate = await structureTemplateService.update(
        editingStructureTemplate.structure_template_id,
        data as StructureTemplateUpdate
      );
      if (updatedStructureTemplate) {
        // 重新获取结构模板列表和结构树
        const templates = await structureTemplateService.getByTemplateId(templateId);
        setStructureTemplates(templates);
        
        const tree = await structureTemplateService.getStructureTree(templateId);
        setStructureTree(tree);
        
        setIsStructureEditModalOpen(false);
        setEditingStructureTemplate(null);
      }
    } catch (error) {
      console.error('Error updating structure template:', error);
    } finally {
      setStructureFormLoading(false);
    }
  };

  // 处理结构模板删除
  const handleDeleteStructureTemplate = async () => {
    if (!deletingStructureTemplateId) return;
    
    setStructureDeleteLoading(true);
    try {
      const success = await structureTemplateService.delete(deletingStructureTemplateId);
      if (success) {
        // 重新获取结构模板列表和结构树
        const templates = await structureTemplateService.getByTemplateId(templateId);
        setStructureTemplates(templates);
        
        const tree = await structureTemplateService.getStructureTree(templateId);
        setStructureTree(tree);
        
        setIsStructureDeleteModalOpen(false);
        setDeletingStructureTemplateId(null);
      }
    } catch (error) {
      console.error('Error deleting structure template:', error);
    } finally {
      setStructureDeleteLoading(false);
    }
  };

  // 处理结构模板取消操作
  const handleStructureCancel = () => {
    setIsStructureCreateModalOpen(false);
    setIsStructureEditModalOpen(false);
    setIsStructureDeleteModalOpen(false);
    setEditingStructureTemplate(null);
    setDeletingStructureTemplateId(null);
    setSelectedParentId(null);
  };

  // 打开创建摘要模板模态框
  const handleOpenSummaryCreateModal = () => {
    setIsSummaryCreateModalOpen(true);
  };

  // 打开编辑摘要模板模态框
  const handleOpenSummaryEditModal = (summaryTemplate: SummaryTemplate) => {
    setEditingSummaryTemplate(summaryTemplate);
    setIsSummaryEditModalOpen(true);
  };

  // 打开删除摘要模板模态框
  const handleOpenSummaryDeleteModal = (summaryTemplateId: string) => {
    setDeletingSummaryTemplateId(summaryTemplateId);
    setIsSummaryDeleteModalOpen(true);
  };

  // 处理摘要模板创建
  const handleCreateSummaryTemplate = async (data: SummaryTemplateCreate | SummaryTemplateUpdate) => {
    setSummaryFormLoading(true);
    try {
      const newSummaryTemplate = await summaryTemplateService.create(data as SummaryTemplateCreate);
      if (newSummaryTemplate) {
        // 重新获取摘要模板列表
        const updatedSummaryTemplates = await summaryTemplateService.getByTemplateId(templateId);
        setSummaryTemplates(updatedSummaryTemplates);
        setIsSummaryCreateModalOpen(false);
      }
    } catch (error) {
      console.error('Error creating summary template:', error);
    } finally {
      setSummaryFormLoading(false);
    }
  };

  // 处理摘要模板编辑
  const handleEditSummaryTemplate = async (data: SummaryTemplateCreate | SummaryTemplateUpdate) => {
    if (!editingSummaryTemplate) return;
    
    setSummaryFormLoading(true);
    try {
      const updatedSummaryTemplate = await summaryTemplateService.update(
        editingSummaryTemplate.summary_template_id,
        data as SummaryTemplateUpdate
      );
      if (updatedSummaryTemplate) {
        // 重新获取摘要模板列表
        const updatedSummaryTemplates = await summaryTemplateService.getByTemplateId(templateId);
        setSummaryTemplates(updatedSummaryTemplates);
        setIsSummaryEditModalOpen(false);
        setEditingSummaryTemplate(null);
      }
    } catch (error) {
      console.error('Error updating summary template:', error);
    } finally {
      setSummaryFormLoading(false);
    }
  };

  // 处理摘要模板删除
  const handleDeleteSummaryTemplate = async () => {
    if (!deletingSummaryTemplateId) return;
    
    setSummaryDeleteLoading(true);
    try {
      const success = await summaryTemplateService.delete(deletingSummaryTemplateId);
      if (success) {
        // 重新获取摘要模板列表
        const updatedSummaryTemplates = await summaryTemplateService.getByTemplateId(templateId);
        setSummaryTemplates(updatedSummaryTemplates);
        setIsSummaryDeleteModalOpen(false);
        setDeletingSummaryTemplateId(null);
      }
    } catch (error) {
      console.error('Error deleting summary template:', error);
    } finally {
      setSummaryDeleteLoading(false);
    }
  };

  // 处理摘要模板取消操作
  const handleSummaryCancel = () => {
    setIsSummaryCreateModalOpen(false);
    setIsSummaryEditModalOpen(false);
    setIsSummaryDeleteModalOpen(false);
    setEditingSummaryTemplate(null);
    setDeletingSummaryTemplateId(null);
  };

  // 获取父结构选项
  const getParentOptions = () => {
    const options: { value: string | null; label: string }[] = [
      { value: null, label: '无（顶级结构）' }
    ];
    
    const addOptions = (structures: StructureTemplate[], prefix: string = '') => {
      structures.forEach(structure => {
        options.push({
          value: structure.structure_template_id,
          label: `${prefix}${structure.title}`
        });
        if (structure.children && structure.children.length > 0) {
          addOptions(structure.children, `${prefix}  └ `);
        }
      });
    };
    
    addOptions(structureTree);
    return options;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          onClick={() => router.back()}
          className="mr-4"
        >
          ← 返回列表
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">模板详情</h1>
      </div>

      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">模板基本信息</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">模板名称</label>
            {loading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="p-2 border border-gray-200 rounded-md bg-gray-50">
                {template?.display_name || 'N/A'}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">模板用途</label>
            {loading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="p-2 border border-gray-200 rounded-md bg-gray-50">
                {template?.purpose || 'N/A'}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">是否系统模板</label>
            {loading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="p-2 border border-gray-200 rounded-md bg-gray-50">
                {template?.is_system ? '是' : '否'}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">是否激活</label>
            {loading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="p-2 border border-gray-200 rounded-md bg-gray-50">
                {template?.is_active ? '是' : '否'}
              </div>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">模板描述</label>
            {loading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="p-2 border border-gray-200 rounded-md bg-gray-50 min-h-[80px]">
                {template?.content?.description || 'N/A'}
              </div>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">默认提示词</label>
            {loading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="p-2 border border-gray-200 rounded-md bg-gray-50 min-h-[80px]">
                {template?.content?.default_prompt || 'N/A'}
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button>编辑基本信息</Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex border-b mb-4">
          <Button 
            variant="ghost" 
            className={activeTab === 'core' ? 'border-b-2 border-blue-600 text-blue-600' : ''}
            onClick={() => setActiveTab('core')}
          >
            核心信息模板
          </Button>
          <Button 
            variant="ghost" 
            className={`ml-4 ${activeTab === 'structure' ? 'border-b-2 border-blue-600 text-blue-600' : ''}`}
            onClick={() => setActiveTab('structure')}
          >
            结构模板
          </Button>
          <Button 
            variant="ghost" 
            className={`ml-4 ${activeTab === 'summary' ? 'border-b-2 border-blue-600 text-blue-600' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            摘要模板
          </Button>
        </div>

        {/* 核心信息模板 */}
        {activeTab === 'core' && (
          <>
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold">核心信息字段</h2>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleOpenCoreInfoCreateModal}>
                添加字段
              </Button>
            </div>

            <ScrollArea className="h-[400px]">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">字段名称</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">字段标识</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">字段类型</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">是否必填</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">排序</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {coreInfoLoading ? (
                    // 骨架屏
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr key={index} className="border-b">
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-24" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-20" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-16" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-12" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-8" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-8 w-24" />
                        </td>
                      </tr>
                    ))
                  ) : coreInfoTemplates.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        暂无核心信息字段
                      </td>
                    </tr>
                  ) : (
                    // 核心信息模板列表
                    coreInfoTemplates.map((coreInfoTemplate) => (
                      <tr key={coreInfoTemplate.core_template_id} className="border-b">
                        <td className="px-4 py-3">{coreInfoTemplate.field_name}</td>
                        <td className="px-4 py-3">{coreInfoTemplate.field_key}</td>
                        <td className="px-4 py-3">
                          {coreInfoTemplate.field_type === 'text' && '文本'}
                          {coreInfoTemplate.field_type === 'number' && '数字'}
                          {coreInfoTemplate.field_type === 'date' && '日期'}
                          {coreInfoTemplate.field_type === 'select' && '选择'}
                        </td>
                        <td className="px-4 py-3">{coreInfoTemplate.is_required ? '是' : '否'}</td>
                        <td className="px-4 py-3">{coreInfoTemplate.order_index}</td>
                        <td className="px-4 py-3">
                          <div className="flex space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleOpenCoreInfoEditModal(coreInfoTemplate)}
                            >
                              编辑
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleOpenCoreInfoDeleteModal(coreInfoTemplate.core_template_id)}
                            >
                              删除
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </>
        )}

        {/* 结构模板 */}
        {activeTab === 'structure' && (
          <>
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold">结构模板</h2>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => handleOpenStructureCreateModal()}> 
                添加顶级结构
              </Button>
            </div>

            <ScrollArea className="h-[400px]">
              {structureLoading ? (
                <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
                  <Skeleton className="h-8 w-1/2 mb-4" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <div className="ml-8 border-l-2 border-gray-300 pl-4">
                    <Skeleton className="h-6 w-1/3 mb-3" />
                    <Skeleton className="h-4 w-2/3 mb-2" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </div>
              ) : structureTree.length === 0 ? (
                <div className="p-8 text-center text-gray-500 border border-gray-200 rounded-md bg-gray-50">
                  暂无结构模板
                </div>
              ) : (
                <StructureTree
                  structures={structureTree}
                  onEdit={handleOpenStructureEditModal}
                  onDelete={handleOpenStructureDeleteModal}
                  onAddChild={handleOpenStructureCreateModal}
                />
              )}
            </ScrollArea>
          </>
        )}

        {/* 摘要模板 */}
        {activeTab === 'summary' && (
          <>
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold">摘要模板</h2>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleOpenSummaryCreateModal}>
                添加摘要
              </Button>
            </div>

            <ScrollArea className="h-[400px]">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">标题</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">生成方式</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">排序</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryLoading ? (
                    // 骨架屏
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr key={index} className="border-b">
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-32" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-24" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-8" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-8 w-24" />
                        </td>
                      </tr>
                    ))
                  ) : summaryTemplates.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                        暂无摘要模板
                      </td>
                    </tr>
                  ) : (
                    // 摘要模板列表
                    summaryTemplates.map((summaryTemplate) => (
                      <tr key={summaryTemplate.summary_template_id} className="border-b">
                        <td className="px-4 py-3">{summaryTemplate.title}</td>
                        <td className="px-4 py-3">
                          {summaryTemplate.generation_mode === 1 && '复制'}
                          {summaryTemplate.generation_mode === 2 && 'AI总结'}
                        </td>
                        <td className="px-4 py-3">{summaryTemplate.order_index}</td>
                        <td className="px-4 py-3">
                          <div className="flex space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleOpenSummaryEditModal(summaryTemplate)}
                            >
                              编辑
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleOpenSummaryDeleteModal(summaryTemplate.summary_template_id)}
                            >
                              删除
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </>
        )}
      </Card>

      {/* 创建核心信息模板模态框 */}
      <Modal
        isOpen={isCoreInfoCreateModalOpen}
        onClose={handleCoreInfoCancel}
        title="创建核心信息字段"
      >
        <CoreInfoTemplateForm
          templateId={templateId}
          onSubmit={handleCreateCoreInfoTemplate}
          onCancel={handleCoreInfoCancel}
          isLoading={coreInfoFormLoading}
        />
      </Modal>

      {/* 编辑核心信息模板模态框 */}
      <Modal
        isOpen={isCoreInfoEditModalOpen}
        onClose={handleCoreInfoCancel}
        title="编辑核心信息字段"
      >
        <CoreInfoTemplateForm
          templateId={templateId}
          coreInfoTemplate={editingCoreInfoTemplate}
          onSubmit={handleEditCoreInfoTemplate}
          onCancel={handleCoreInfoCancel}
          isLoading={coreInfoFormLoading}
        />
      </Modal>

      {/* 删除核心信息模板模态框 */}
      <Modal
        isOpen={isCoreInfoDeleteModalOpen}
        onClose={handleCoreInfoCancel}
        title="删除核心信息字段"
      >
        <div className="space-y-4">
          <p>确定要删除此核心信息字段吗？此操作不可恢复。</p>
          <div className="flex justify-end space-x-2">
            <Button type="button" onClick={handleCoreInfoCancel} disabled={coreInfoDeleteLoading}>
              取消
            </Button>
            <Button 
              type="button" 
              className="bg-red-600 hover:bg-red-700" 
              onClick={handleDeleteCoreInfoTemplate}
              disabled={coreInfoDeleteLoading}
            >
              {coreInfoDeleteLoading ? '删除中...' : '删除'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 创建结构模板模态框 */}
      <Modal
        isOpen={isStructureCreateModalOpen}
        onClose={handleStructureCancel}
        title="创建结构模板"
      >
        <StructureTemplateForm
          templateId={templateId}
          parentOptions={getParentOptions()}
          onSubmit={(data) => handleCreateStructureTemplate({ ...data, parent_id: selectedParentId })}
          onCancel={handleStructureCancel}
          isLoading={structureFormLoading}
        />
      </Modal>

      {/* 编辑结构模板模态框 */}
      <Modal
        isOpen={isStructureEditModalOpen}
        onClose={handleStructureCancel}
        title="编辑结构模板"
      >
        <StructureTemplateForm
          templateId={templateId}
          structureTemplate={editingStructureTemplate}
          parentOptions={getParentOptions()}
          onSubmit={handleEditStructureTemplate}
          onCancel={handleStructureCancel}
          isLoading={structureFormLoading}
        />
      </Modal>

      {/* 删除结构模板模态框 */}
      <Modal
        isOpen={isStructureDeleteModalOpen}
        onClose={handleStructureCancel}
        title="删除结构模板"
      >
        <div className="space-y-4">
          <p>确定要删除此结构模板吗？此操作不可恢复，且会删除所有子结构。</p>
          <div className="flex justify-end space-x-2">
            <Button type="button" onClick={handleStructureCancel} disabled={structureDeleteLoading}>
              取消
            </Button>
            <Button 
              type="button" 
              className="bg-red-600 hover:bg-red-700" 
              onClick={handleDeleteStructureTemplate}
              disabled={structureDeleteLoading}
            >
              {structureDeleteLoading ? '删除中...' : '删除'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 创建摘要模板模态框 */}
      <Modal
        isOpen={isSummaryCreateModalOpen}
        onClose={handleSummaryCancel}
        title="创建摘要模板"
      >
        <SummaryTemplateForm
          templateId={templateId}
          onSubmit={handleCreateSummaryTemplate}
          onCancel={handleSummaryCancel}
          isLoading={summaryFormLoading}
        />
      </Modal>

      {/* 编辑摘要模板模态框 */}
      <Modal
        isOpen={isSummaryEditModalOpen}
        onClose={handleSummaryCancel}
        title="编辑摘要模板"
      >
        <SummaryTemplateForm
          templateId={templateId}
          summaryTemplate={editingSummaryTemplate}
          onSubmit={handleEditSummaryTemplate}
          onCancel={handleSummaryCancel}
          isLoading={summaryFormLoading}
        />
      </Modal>

      {/* 删除摘要模板模态框 */}
      <Modal
        isOpen={isSummaryDeleteModalOpen}
        onClose={handleSummaryCancel}
        title="删除摘要模板"
      >
        <div className="space-y-4">
          <p>确定要删除此摘要模板吗？此操作不可恢复。</p>
          <div className="flex justify-end space-x-2">
            <Button type="button" onClick={handleSummaryCancel} disabled={summaryDeleteLoading}>
              取消
            </Button>
            <Button 
              type="button" 
              className="bg-red-600 hover:bg-red-700" 
              onClick={handleDeleteSummaryTemplate}
              disabled={summaryDeleteLoading}
            >
              {summaryDeleteLoading ? '删除中...' : '删除'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TemplateDetailPage;
