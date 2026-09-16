import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SearchDialog } from './SearchDialog.jsx'
import { api } from '../lib/api.js'

vi.mock('../lib/api.js', () => ({
  api: { searchSessions: vi.fn() },
}))

describe('SearchDialog', () => {
  it('searches chat content and opens the active result with Enter', async () => {
    api.searchSessions.mockResolvedValue({
      items: [{ id: 'match', title: 'Dependency notes', preview: 'Explain dependency injection' }],
      total: 1,
      limit: 20,
      offset: 0,
    })
    const onSelect = vi.fn()
    render(<SearchDialog recentSessions={[]} onClose={vi.fn()} onSelect={onSelect} />)

    const input = screen.getByLabelText('Search titles and messages')
    fireEvent.change(input, { target: { value: 'dependency' } })
    await waitFor(() => expect(screen.getByRole('option', { name: /Dependency notes/i })).toBeInTheDocument())
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSelect).toHaveBeenCalledWith('match')
  })
})
