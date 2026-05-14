import { useMemo, useState } from 'react'
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

function collectExpandedGroupIds(nodes: GraphicNode[], activeId: string, expandedGroupIds: Set<string>): boolean {
  let containsActive = false

  for (const node of nodes) {
    if (isGroupNode(node)) {
      const groupContainsActive = collectExpandedGroupIds(node.children, activeId, expandedGroupIds)
      if (groupContainsActive || node.id === activeId) {
        expandedGroupIds.add(node.id)
        containsActive = true
      }
      continue
    }

    if (node.id === activeId) {
      containsActive = true
    }
  }

  return containsActive
}

function renderTreeNodes(
  nodes: GraphicNode[],
  activeId: string,
  expandedGroupIds: Set<string>,
  onToggleGroup: (groupId: string) => void,
  depth = 0,
): ReactElement[] {
  return nodes.map((node) => {
    if (isGroupNode(node)) {
      const isExpanded = expandedGroupIds.has(node.id)
      const panelId = `${node.id}-panel`

      return (
        <li key={node.id} className={`graphic-group-item ${isExpanded ? 'is-open' : 'is-closed'}`}>
          <button
            type="button"
            className="graphic-group-label"
            style={buildIndentStyle(depth)}
            onClick={() => onToggleGroup(node.id)}
            aria-expanded={isExpanded}
            aria-controls={panelId}
          >
            {node.title}
          </button>
          {isExpanded ? (
            <ul id={panelId} className="graphic-sub-list">
              {renderTreeNodes(node.children, activeId, expandedGroupIds, onToggleGroup, depth + 1)}
            </ul>
          ) : null}
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
  const [manualExpandedGroupId, setManualExpandedGroupId] = useState<string | null>(null)

  const activeExpandedGroupIds = useMemo(() => {
    const groupIds = new Set<string>()
    collectExpandedGroupIds(graphicTree, activeId, groupIds)
    return groupIds
  }, [activeId, graphicTree])

  const expandedGroupIds = useMemo(() => {
    if (activeExpandedGroupIds.size > 0) {
      return activeExpandedGroupIds
    }

    if (manualExpandedGroupId === null) {
      return new Set<string>()
    }

    return new Set<string>([manualExpandedGroupId])
  }, [activeExpandedGroupIds, manualExpandedGroupId])

  const onToggleGroup = (groupId: string) => {
    setManualExpandedGroupId((current) => (current === groupId ? null : groupId))
  }

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
        {renderTreeNodes(graphicTree, activeId, expandedGroupIds, onToggleGroup)}
      </ul>
    </nav>
  )
}
