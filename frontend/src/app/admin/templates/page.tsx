'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Modal } from '@/components/ui/modal';
import TemplateForm from '@/components/template/TemplateForm';
import { templateService, Template } from '@/services/templateService';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const TemplateManagementPage: React.FC = () => {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    purpose: '',
    is_system: undefined as boolean | undefined,
    is_active: undefined as boolean | undefined,
  });
  const [purposes, setPurposes] = useState<string[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isRollbackModalOpen, setIsRollbackModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [rollingBackTemplateId, setRollingBackTemplateId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [rollbackLoading, setRollbackLoading] = useState(false);

  // 获取模板用途列表
  useEffect(() => {
    const fetchPurposes = async () => {
      const data = await templateService.getPurposes();
      setPurposes(data);
    };
    fetchPurposes();
  }, []);

  // 获取模板列表
  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      const data = await templateService.getTemplates(
        filters.purpose,
        filters.is_system,
        filters.is_active
      );
      setTemplates(data);
      setLoading(false);
    };
    fetchTemplates();
  }, [filters]);

  // 处理筛选条件变化
  const handleFilterChange = (key: keyof typeof filters, value: string | boolean | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === '' ? undefined : value,
    }));
  };

  // 处理重置筛选
  const handleResetFilters = () => {
    setFilters({
      purpose: '',
      is_system: undefined,
      is_active: undefined,
    });
  };

  // 打开创建模板模态框
  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  // 打开编辑模板模态框
  const handleOpenEditModal = (template: Template) => {
    setEditingTemplate(template);
    setIsEditModalOpen(true);
  };

  // 处理模板创建
  const handleCreateTemplate = async (data: {
    purpose: string;
    display_name: string;
    content: { description: string; default_prompt: string };
    is_system?: boolean;
    is_active?: boolean;
  }) => {
    setFormLoading(true);
    try {
      const newTemplate = await templateService.createTemplate(
        data.purpose,
        data.display_name,
        data.content,
        data.is_system,
        null // user_id
      );
      if (newTemplate) {
        // 重新获取模板列表
        const updatedTemplates = await templateService.getTemplates(
          filters.purpose,
          filters.is_system,
          filters.is_active
        );
        setTemplates(updatedTemplates);
        setIsCreateModalOpen(false);
      }
    } catch (error) {
      console.error('Error creating template:', error);
    } finally {
      setFormLoading(false);
    }
  };

  // 处理模板编辑
  const handleEditTemplate = async (data: {
    purpose: string;
    display_name: string;
    content: { description: string; default_prompt: string };
    is_system?: boolean;
    is_active?: boolean;
  }) => {
    if (!editingTemplate) return;
    
    setFormLoading(true);
    try {
      const updatedTemplate = await templateService.updateTemplate(
        editingTemplate.template_id,
        data
      );
      if (updatedTemplate) {
        // 重新获取模板列表
        const updatedTemplates = await templateService.getTemplates(
          filters.purpose,
          filters.is_system,
          filters.is_active
        );
        setTemplates(updatedTemplates);
        setIsEditModalOpen(false);
        setEditingTemplate(null);
      }
    } catch (error) {
      console.error('Error updating template:', error);
    } finally {
      setFormLoading(false);
    }
  };

  // 处理取消操作
  const handleCancel = () => {
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
    setIsDeleteModalOpen(false);
    setIsRollbackModalOpen(false);
    setEditingTemplate(null);
    setDeletingTemplateId(null);
    setRollingBackTemplateId(null);
  };

  // 打开删除确认模态框
  const handleOpenDeleteModal = (templateId: string) => {
    setDeletingTemplateId(templateId);
    setIsDeleteModalOpen(true);
  };

  // 处理模板删除
  const handleDeleteTemplate = async () => {
    if (!deletingTemplateId) return;
    
    setDeleteLoading(true);
    try {
      const success = await templateService.deleteTemplate(deletingTemplateId);
      if (success) {
        // 重新获取模板列表
        const updatedTemplates = await templateService.getTemplates(
          filters.purpose,
          filters.is_system,
          filters.is_active
        );
        setTemplates(updatedTemplates);
        setIsDeleteModalOpen(false);
        setDeletingTemplateId(null);
      }
    } catch (error) {
      console.error('Error deleting template:', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  // 打开回退确认模态框
  const handleOpenRollbackModal = (templateId: string) => {
    setRollingBackTemplateId(templateId);
    setIsRollbackModalOpen(true);
  };

  // 处理模板回退
  const handleRollbackTemplate = async () => {
    if (!rollingBackTemplateId) return;
    
    setRollbackLoading(true);
    try {
      const updatedTemplate = await templateService.rollbackTemplate(rollingBackTemplateId);
      if (updatedTemplate) {
        // 重新获取模板列表
        const updatedTemplates = await templateService.getTemplates(
          filters.purpose,
          filters.is_system,
          filters.is_active
        );
        setTemplates(updatedTemplates);
        setIsRollbackModalOpen(false);
        setRollingBackTemplateId(null);
      }
    } catch (error) {
      console.error('Error rolling back template:', error);
    } finally {
      setRollbackLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">模板管理</h1>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleOpenCreateModal}>
          创建模板
        </Button>
      </div>

      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">筛选条件</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">模板用途</label>
            <select 
              className="w-full p-2 border border-gray-300 rounded-md"
              value={filters.purpose}
              onChange={(e) => handleFilterChange('purpose', e.target.value)}
            >
              <option value="">全部</option>
              {purposes.map((purpose) => (
                <option key={purpose} value={purpose}>{purpose}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">是否系统模板</label>
            <select 
              className="w-full p-2 border border-gray-300 rounded-md"
              value={filters.is_system === undefined ? '' : filters.is_system.toString()}
              onChange={(e) => handleFilterChange('is_system', e.target.value === '' ? undefined : e.target.value === 'true')}
            >
              <option value="">全部</option>
              <option value="true">是</option>
              <option value="false">否</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">是否激活</label>
            <select 
              className="w-full p-2 border border-gray-300 rounded-md"
              value={filters.is_active === undefined ? '' : filters.is_active.toString()}
              onChange={(e) => handleFilterChange('is_active', e.target.value === '' ? undefined : e.target.value === 'true')}
            >
              <option value="">全部</option>
              <option value="true">是</option>
              <option value="false">否</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleResetFilters}>重置</Button>
          <Button className="ml-2 bg-blue-600 hover:bg-blue-700">筛选</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">模板列表</h2>
        <ScrollArea className="h-[500px]">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">模板名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">用途</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">是否系统模板</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">是否激活</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">创建时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
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
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-8 w-32" />
                    </td>
                  </tr>
                ))
              ) : templates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    暂无模板数据
                  </td>
                </tr>
              ) : (
                // 模板列表
                templates.map((template) => (
                  <tr key={template.template_id} className="border-b">
                    <td className="px-4 py-3">
                      <Link href={`/admin/templates/${template.template_id}`} className="text-blue-600 hover:underline">
                        {template.display_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{template.purpose}</td>
                    <td className="px-4 py-3">
                      {template.is_system ? '是' : '否'}
                    </td>
                    <td className="px-4 py-3">
                      {template.is_active ? '是' : '否'}
                    </td>
                    <td className="px-4 py-3">
                      {new Date(template.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEditModal(template)}>
                          编辑
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleOpenDeleteModal(template.template_id)}>
                          删除
                        </Button>
                        {template.is_system && (
                          <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700" onClick={() => handleOpenRollbackModal(template.template_id)}>
                            回退
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollArea>
        <div className="mt-4 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            显示 1-10 条，共 100 条
          </div>
          <div className="flex space-x-1">
            <Button variant="ghost" disabled>上一页</Button>
            <Button variant="ghost" className="bg-blue-100 text-blue-700">1</Button>
            <Button variant="ghost">2</Button>
            <Button variant="ghost">3</Button>
            <Button variant="ghost">下一页</Button>
          </div>
        </div>
      </Card>

      {/* 创建模板模态框 */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCancel}
        title="创建模板"
      >
        <TemplateForm
          onSubmit={handleCreateTemplate}
          onCancel={handleCancel}
          isLoading={formLoading}
        />
      </Modal>

      {/* 删除确认模态框 */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={handleCancel}
        title="删除模板"
      >
        <div className="space-y-4">
          <p>确定要删除此模板吗？此操作不可恢复。</p>
          <div className="flex justify-end space-x-2">
            <Button type="button" onClick={handleCancel} disabled={deleteLoading}>
              取消
            </Button>
            <Button 
              type="button" 
              className="bg-red-600 hover:bg-red-700" 
              onClick={handleDeleteTemplate}
              disabled={deleteLoading}
            >
              {deleteLoading ? '删除中...' : '删除'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 回退确认模态框 */}
      <Modal
        isOpen={isRollbackModalOpen}
        onClose={handleCancel}
        title="回退模板"
      >
        <div className="space-y-4">
          <p>确定要回退此官方模板到原始版本吗？此操作会覆盖当前的修改。</p>
          <div className="flex justify-end space-x-2">
            <Button type="button" onClick={handleCancel} disabled={rollbackLoading}>
              取消
            </Button>
            <Button 
              type="button" 
              className="bg-green-600 hover:bg-green-700" 
              onClick={handleRollbackTemplate}
              disabled={rollbackLoading}
            >
              {rollbackLoading ? '回退中...' : '回退'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TemplateManagementPage;
