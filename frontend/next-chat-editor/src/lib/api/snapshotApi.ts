import { Snapshot, SnapshotDetail } from '../types/snapshot';

export const snapshotApi = {
  // 获取快照列表
  getSnapshots: async (documentId: string): Promise<Snapshot[]> => {
    const response = await fetch(`/api/documents/${documentId}/snapshots`);
    if (!response.ok) {
      throw new Error('Failed to fetch snapshots');
    }
    const data = await response.json();
    return data.data.snapshots || [];
  },

  // 获取快照详情
  getSnapshotDetail: async (documentId: string, snapshotId: string): Promise<SnapshotDetail> => {
    const response = await fetch(`/api/documents/${documentId}/snapshots/detail/${snapshotId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch snapshot detail');
    }
    const data = await response.json();
    return data.data;
  },

  // 创建快照
  createSnapshot: async (documentId: string, description: string): Promise<void> => {
    const response = await fetch(`/api/documents/${documentId}/snapshots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ description: description.trim() }),
    });
    if (!response.ok) {
      throw new Error('Failed to create snapshot');
    }
  },

  // 获取默认快照描述
  getDefaultSnapshotDescription: async (documentId: string): Promise<string> => {
    const response = await fetch(`/api/documents/${documentId}/snapshots-meta/default-description`);
    if (!response.ok) {
      throw new Error('Failed to fetch default snapshot description');
    }
    const data = await response.json();
    return data.data.default_description;
  },
};
