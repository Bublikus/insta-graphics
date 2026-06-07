import { Link } from 'react-router-dom'
import type { GraphicNode } from '../graphics/registry'
import { GraphicTree } from './GraphicTree'

interface GraphicNavigatorProps {
  graphicTree: GraphicNode[]
  activeId: string
  previousId: string
  nextId: string
}

export function GraphicNavigator({
  graphicTree,
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
      <GraphicTree graphicTree={graphicTree} activeId={activeId} />
    </nav>
  )
}
