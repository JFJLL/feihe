export type ActionWorkbenchItem = {
  id: string;
  source: 'key-comment' | 'review-batch';
  itemType: 'comment' | 'note';
  action: 'reply' | 'delete' | 'supplement' | 'observe';
  status: 'pending' | 'handled';
  noteId?: string;
  link?: string;
  title?: string;
  author?: string;
  content?: string;
  reason?: string;
  sentiment?: string;
  category?: string;
  batchDate?: string;
  rawId: string | number;
};

export type SupplierCommentItem = {
  id: number;
  noteId: string;
  noteUrl: string;
  creator: string;
  plannedContent: string;
  commentFormat: string;
  visibility: string;
  matchedContent?: string;
  verifiedAt?: string;
};
