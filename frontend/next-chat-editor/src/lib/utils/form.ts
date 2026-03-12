import { Field, FormData } from '../types/form';

/**
 * 初始化表单数据
 * @param fields 字段列表
 * @returns 初始化后的表单数据
 */
export const initializeFormData = (fields: Field[]): FormData => {
  const initialFormData: FormData = {};
  fields.forEach((field) => {
    initialFormData[field.field] = '';
  });
  return initialFormData;
};

/**
 * 提取必填字段
 * @param fields 字段列表
 * @param formData 表单数据
 * @returns 只包含必填字段的对象
 */
export const extractRequiredFields = (fields: Field[], formData: FormData): FormData => {
  const requiredFields: FormData = {};
  
  fields
    .filter((field) => field.required && field.field !== 'keywords' && field.field !== 'content')
    .forEach((field) => {
      requiredFields[field.field] = formData[field.field];
      // 如果选择了"其他"，添加自定义内容
      if (formData[field.field] === '其他' && formData[`${field.field}_other`]) {
        requiredFields[`${field.field}_other`] = formData[`${field.field}_other`];
      }
    });
  
  // 添加参考正文（可选）
  if (formData.content) {
    requiredFields.content = formData.content;
  }
  
  return requiredFields;
};
