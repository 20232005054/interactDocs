export interface Keyword {
  document_id: string;
  keyword: string;
}

export interface BatchKeywordRequest {
  keywords: Keyword[];
}
