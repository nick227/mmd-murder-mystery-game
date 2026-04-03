import { useMemo, useState, useRef } from 'react'
import type { CreateGameFormData, StoryListItem } from '../../../data/types'
import { BottomSheet } from '../../ui/BottomSheet'
import { LoadingOverlay } from '../../ui/LoadingOverlay'
import { LauncherCharacterRow } from './LauncherCharacterRow'
import { LauncherStoryCard } from './LauncherStoryCard'

type Mode = 'create' | 'edit'

export type CreateEditGameDraft = Omit<CreateGameFormData, 'apiBase'> & {
  characterId: string
}

type ExistingGame = {
  id: string
  state?: string
  storyId?: string | null
  name?: string
  scheduledTime?: string
  locationText?: string | null
  access?: { hostKey?: string }
}

type Props = {
  open: boolean
  mode: Mode
  apiBase: string
  stories: StoryListItem[]
  initial: {
    storyId: string
    name: string
    scheduledTime: string
    locationText: string
    characterId: string
  }
  existingGame?: ExistingGame
  onClose: () => void
  onSubmit: (draft: CreateEditGameDraft) => Promise<void>
  onSuccess?: () => void
}

function canSubmit(draft: CreateEditGameDraft) {
  return Boolean(
    draft.storyId.trim() &&
      draft.name.trim() &&
      draft.scheduledTime.trim() &&
      draft.locationText.trim() &&
      draft.characterId.trim(),
  )
}

export function CreateEditGameSheet({
  open,
  mode,
  apiBase,
  stories,
  initial,
  existingGame,
  onClose,
  onSubmit,
  onSuccess,
}: Props) {
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false)

  const selectedStory = useMemo(() => stories.find(s => s.id === draft.storyId) ?? null, [stories, draft.storyId])
  const characters = selectedStory?.characters ?? []
  const submitEnabled = canSubmit(draft)

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        eyebrow={mode === 'create' ? 'Create game' : 'Edit game'}
        title={mode === 'create' ? 'New game' : 'Update game'}
        meta={mode === 'create' ? 'Fill everything out to create the game.' : 'Only unstarted games can be edited.'}
      >
        {error ? <div className="empty-state">{error}</div> : null}

        <div className="story-picker">
          <div className="field__label">Story</div>
          {!stories.length ? <div className="empty-state">No stories loaded yet. Check API base.</div> : null}
          {stories.map(story => (
            <LauncherStoryCard
              key={story.id}
              story={story}
              active={draft.storyId === story.id}
              onClick={() => setDraft(current => ({ ...current, storyId: story.id, characterId: '' }))}
            />
          ))}
        </div>

        <div className="field-grid u-mt-12">
          <div className="field">
            <label className="field__label">Game title</label>
            <input className="field__input" value={draft.name} onChange={e => setDraft(c => ({ ...c, name: e.target.value }))} />
          </div>
          <div className="field">
            <label className="field__label">Location</label>
            <input className="field__input" value={draft.locationText} onChange={e => setDraft(c => ({ ...c, locationText: e.target.value }))} />
          </div>
          <div className="field">
            <label className="field__label">Scheduled time</label>
            <input
              className="field__input"
              type="datetime-local"
              value={draft.scheduledTime}
              onChange={e => setDraft(c => ({ ...c, scheduledTime: e.target.value }))}
            />
          </div>
        </div>

        <div className="story-picker u-mt-12 flex flex-col">
          <div className="field__label">Play as</div>
          {!draft.storyId ? <div className="empty-state">Pick a story first.</div> : null}
          {draft.storyId && !characters.length ? <div className="empty-state">No characters found for this story.</div> : null}
          {characters.map(char => (
            <LauncherCharacterRow
              key={char.characterId}
              label={char.name}
              portrait={char.portrait}
              active={draft.characterId === char.characterId}
              onClick={() => setDraft(c => ({ ...c, characterId: char.characterId }))}
            />
          ))}
        </div>

        <div className="launcher-actions u-mt-12">
          <button
            type="button"
            className="action-btn action-btn--primary"
            disabled={!submitEnabled || submitting}
            onClick={async () => {
              if (!submitEnabled) {
                setError('Fill out title, time, location, story, and character.')
                return
              }
              setSubmitting(true)
              setError('')
              
              try {
                await onSubmit({
                  storyId: draft.storyId.trim(),
                  name: draft.name.trim(),
                  scheduledTime: draft.scheduledTime,
                  locationText: draft.locationText.trim(),
                  characterId: draft.characterId,
                })
                
                // Show loading overlay for create mode
                if (mode === 'create') {
                  setShowLoadingOverlay(true)
                }
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to submit')
                setSubmitting(false)
                return
              }
              setSubmitting(false)
            }}
          >
            {submitting 
              ? (mode === 'create' ? 'Creating game...' : 'Saving changes...')
              : (mode === 'create' ? 'Create game' : 'Save changes')
            }
          </button>
          <button type="button" className="action-btn action-btn--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>

        {existingGame?.id && existingGame.access?.hostKey && apiBase ? (
          <div className="empty-state u-mt-12">
            Editing game: <strong>{existingGame.id}</strong>
          </div>
        ) : null}
      </BottomSheet>
      
      {/* Loading overlay for create mode */}
      <LoadingOverlay
        isVisible={showLoadingOverlay}
        message="Creating your mystery game..."
        minDuration={3000}
        onComplete={() => {
          setShowLoadingOverlay(false)
          if (onSuccess) {
            onSuccess()
          }
        }}
      />
    </>
  )
}

