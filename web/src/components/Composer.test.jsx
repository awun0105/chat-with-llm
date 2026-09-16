import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Composer } from './Composer.jsx'

const baseProps = {
  draft: '',
  setDraft: vi.fn(),
  models: [],
  activeModel: null,
  menuOpen: false,
  setMenuOpen: vi.fn(),
  onSend: vi.fn(),
  onSwitchModel: vi.fn(),
  onOpenInstructions: vi.fn(),
}

describe('Composer', () => {
  it('turns the send control into a stop control while streaming', () => {
    const onStop = vi.fn()
    render(<Composer {...baseProps} sending onStop={onStop} />)

    fireEvent.click(screen.getByRole('button', { name: 'Stop generating' }))

    expect(onStop).toHaveBeenCalledOnce()
  })
})
