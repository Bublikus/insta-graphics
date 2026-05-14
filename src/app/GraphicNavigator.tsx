import { Link } from 'react-router-dom'
import type { GraphicDefinition } from '../graphics/registry'

interface GraphicNavigatorProps {
  graphics: GraphicDefinition[]
  activeId: string
  previousId: string
  nextId: string
}

export function GraphicNavigator({
  graphics,
  activeId,
  previousId,
  nextId,
}: GraphicNavigatorProps) {
  return (
    <nav className="graphic-nav" aria-label="Graphic navigation">
      <div className="graphic-nav-buttons">
        <Link className="nav-button" to={`/g/${previousId}`}>
          Previous
        </Link>
        <Link className="nav-button" to={`/g/${nextId}`}>
          Next
        </Link>
      </div>
      <ul className="graphic-link-list">
        {graphics.map((graphic) => (
          <li key={graphic.id}>
            <Link
              className={`graphic-link ${graphic.id === activeId ? 'is-active' : ''}`}
              to={`/g/${graphic.id}`}
            >
              <span>{graphic.title}</span>
              <small>/{graphic.id}</small>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
