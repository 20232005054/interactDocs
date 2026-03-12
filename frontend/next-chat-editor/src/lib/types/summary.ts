export interface Summary {
  document_id: string;
  title: string;
  content: string;
}

export interface BatchSummaryRequest {
  summaries: Summary[];
}
