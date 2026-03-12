export interface Snapshot {
  version_id: string;
  description: string;
  created_at: string;
}

export interface SnapshotDetail {
  snapshot_data: {
    chapters: any[];
  };
}
