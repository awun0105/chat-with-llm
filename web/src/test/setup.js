import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())

if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0)
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
}
