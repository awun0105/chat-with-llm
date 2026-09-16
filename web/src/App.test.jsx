import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'

const mocks = vi.hoisted(() => ({
  models: vi.fn(),
  sessions: vi.fn(),
  settings: vi.fn(),
  session: vi.fn(),
}))

vi.mock('./lib/api.js', () => ({
  DEFAULT_PROMPT: 'Default prompt',
  api: {
    models: mocks.models,
    sessions: mocks.sessions,
    settings: mocks.settings,
    session: mocks.session,
  },
}))

describe('App feature settings', () => {
  beforeEach(() => {
    mocks.models.mockResolvedValue([])
    mocks.sessions.mockResolvedValue([
      { id: 'session-1', title: 'New conversation', preview: null },
    ])
    mocks.session.mockResolvedValue({
      id: 'session-1',
      title: 'New conversation',
      active_model: '',
      system_prompt: 'Default prompt',
      messages: [],
    })
  })

  it('hides starter prompts when the feature is disabled', async () => {
    mocks.settings.mockResolvedValue({
      default_system_prompt: 'Default prompt',
      show_starter_prompts: false,
    })

    render(<App />)

    await waitFor(() => expect(screen.getByText('What can we explore?')).toBeInTheDocument())
    expect(screen.queryByText('Explain a difficult concept')).not.toBeInTheDocument()
  })
})
