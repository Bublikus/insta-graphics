import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { GraphicNode } from '../graphics/registry'
import { GraphicTree } from './GraphicTree'

interface MobileGraphicMenuProps {
  graphicTree: GraphicNode[]
  activeId: string
  activeTitle: string
  previousId: string
  nextId: string
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" fill="currentColor" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" fill="currentColor" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" fill="currentColor" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" fill="currentColor" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function MobileGraphicMenu({
  graphicTree,
  activeId,
  activeTitle,
  previousId,
  nextId,
}: MobileGraphicMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  const close = () => setIsOpen(false)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  return (
    <div className="mobile-menu">
      <button
        type="button"
        className="mobile-menu-fab"
        aria-label={isOpen ? 'Close animation menu' : 'Open animation menu'}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((value) => !value)}
      >
        {isOpen ? <CloseIcon /> : <MenuIcon />}
      </button>

      {isOpen ? (
        <>
          <div className="mobile-menu-backdrop" onClick={close} aria-hidden="true" />
          <div className="mobile-menu-panel" role="menu" aria-label="Choose animation">
            <div className="mobile-menu-header">
              <span className="mobile-menu-eyebrow">Now playing</span>
              <strong className="mobile-menu-title">{activeTitle}</strong>
            </div>
            <div className="mobile-menu-nav-buttons">
              <Link className="nav-button" to={`/g/${previousId}`} onClick={close}>
                Previous
              </Link>
              <Link className="nav-button" to={`/g/${nextId}`} onClick={close}>
                Next
              </Link>
            </div>
            <GraphicTree graphicTree={graphicTree} activeId={activeId} onNavigate={close} />
          </div>
        </>
      ) : null}
    </div>
  )
}
