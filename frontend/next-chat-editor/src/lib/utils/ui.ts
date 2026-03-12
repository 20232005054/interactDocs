/**
 * 调整文本域高度
 * @param element 文本域元素
 */
export const adjustTextareaHeight = (element: HTMLTextAreaElement): void => {
  if (element) {
    element.style.height = 'auto';
    element.style.height = element.scrollHeight + 'px';
  }
};

/**
 * 处理文本域的输入事件，自动调整高度
 * @param e 输入事件
 */
export const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>): void => {
  adjustTextareaHeight(e.currentTarget);
};

/**
 * 处理文本域的聚焦事件，自动调整高度
 * @param e 聚焦事件
 */
export const handleTextareaFocus = (e: React.FocusEvent<HTMLTextAreaElement>): void => {
  adjustTextareaHeight(e.currentTarget);
};
