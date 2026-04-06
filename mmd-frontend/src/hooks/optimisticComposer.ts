import { FeedItem, PostMovePayload } from '../data/types'

export type OptimisticComposerPost = {
  clientRequestId: string
  item: FeedItem
}

export function optimisticComposerItem(input: {
  payload: PostMovePayload
}): FeedItem {
  return {
    id: input.payload.clientRequestId,
    type: 'chat',
    variant: 'social',
    text: input.payload.text,
    author: input.payload.characterName,
    authorPortrait: input.payload.characterPortrait,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }
}

export function readClientRequestId(event: { payload?: Record<string, unknown> } | null | undefined): string | null {
  const raw = event?.payload?.clientRequestId
  return typeof raw === 'string' && raw.trim().length ? raw : null
}

export function filterPendingComposerPosts(
  optimisticPosts: OptimisticComposerPost[],
  acknowledgedRequestIds: Set<string>,
): OptimisticComposerPost[] {
  return optimisticPosts.filter(post => !acknowledgedRequestIds.has(post.clientRequestId))
}

export function mergeFeedWithOptimistic(
  baseFeed: FeedItem[],
  pendingPosts: OptimisticComposerPost[],
): FeedItem[] {
  return [...baseFeed, ...pendingPosts.map(post => post.item)]
}
