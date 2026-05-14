import type { CSSProperties, ReactElement } from 'react'
import { Link } from 'react-router-dom'
import type { GraphicNode } from '../graphics/registry'

interface GraphicNavigatorProps {
  graphicTree: GraphicNode[]
  activeId: string
  previousId: string
  nextId: string
}

function isGroupNode(node: GraphicNode): node is Extract<GraphicNode, { children: GraphicNode[] }> {
  return 'children' in node
}

function buildIndentStyle(depth: number): CSSProperties {
  return {
    marginLeft: `${depth * 14}px`,
  }
}

function renderTreeNodes(nodes: GraphicNode[], activeId: string, depth = 0): ReactElement[] {
  return nodes.map((node) => {
    if (isGroupNode(node)) {
      return (
        <li key={node.id} className="graphic-group-item">
          <div className="graphic-group-label" style={buildIndentStyle(depth)}>
            {node.title}
          </div>
          <ul className="graphic-sub-list">{renderTreeNodes(node.children, activeId, depth + 1)}</ul>
        </li>
      )
    }

    return (
      <li key={node.id}>
        <Link
          className={`graphic-link ${node.id === activeId ? 'is-active' : ''}`}
          to={`/g/${node.id}`}
          style={buildIndentStyle(depth)}
        >
          {node.title}
        </Link>
      </li>
    )
  })
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
      <ul className="graphic-link-list">{renderTreeNodes(graphicTree, activeId)}</ul>
    </nav>
  )
}
