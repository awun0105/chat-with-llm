import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConversationDialog } from './ConversationDialog.jsx'

describe('ConversationDialog', () => {
  it('renames and confirms deletion explicitly', () => {
    const onRename = vi.fn()
    const onDelete = vi.fn()
    render(
      <ConversationDialog mode="rename"
        session={{ id: 'one', title: 'Original title' }}
        busy={false}
        onClose={vi.fn()}
        onRename={onRename}
        onDelete={onDelete}
      />,
    )

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Renamed chat' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    expect(onRename).toHaveBeenCalledWith('Renamed chat')

    fireEvent.click(screen.getByRole('button', { name: /Delete conversation/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledOnce()
  })
})
