import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SettingsDialog } from './SettingsDialog.jsx'

function renderSettings(overrides = {}) {
  const props = {
    settings: { default_system_prompt: 'Be concise.', show_starter_prompts: true },
    sessionCount: 3,
    saving: false,
    clearing: false,
    blocked: false,
    onClose: vi.fn(),
    onSavePrompt: vi.fn(),
    onToggleStarters: vi.fn(),
    onClearAll: vi.fn(),
    ...overrides,
  }
  render(<SettingsDialog {...props} />)
  return props
}

describe('SettingsDialog', () => {
  it('saves the global prompt', () => {
    const props = renderSettings()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New global prompt' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save prompt' }))
    expect(props.onSavePrompt).toHaveBeenCalledWith('New global prompt')
  })

  it('toggles starter prompts and confirms clearing history', () => {
    const props = renderSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Features' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Show starter prompts' }))
    expect(props.onToggleStarters).toHaveBeenCalledWith(false)

    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear all chats' }))
    expect(props.onClearAll).toHaveBeenCalledOnce()
  })
})
