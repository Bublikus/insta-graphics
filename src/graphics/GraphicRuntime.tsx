import { useEffect, useRef } from 'react'
import { ReelsStage } from '../layout/ReelsStage'
import type { BaseGraphicScene } from './base/BaseGraphicScene'
import type { GraphicDefinition } from './registry'

interface GraphicRuntimeProps {
  graphic: GraphicDefinition
  restartNonce?: number
  onCanvasChange?: (canvas: HTMLCanvasElement | null) => void
  onSceneChange?: (scene: BaseGraphicScene | null) => void
}

const INSTAGRAM_WIDTH = 1080
const INSTAGRAM_HEIGHT = 1920
const INSTAGRAM_DPR = 1

function resolveStageCanvas(mountElement: HTMLDivElement): HTMLCanvasElement | null {
  const maybeCanvas = mountElement.querySelector('canvas')
  if (maybeCanvas instanceof HTMLCanvasElement) {
    return maybeCanvas
  }

  return null
}

export function GraphicRuntime({
  graphic,
  restartNonce = 0,
  onCanvasChange,
  onSceneChange,
}: GraphicRuntimeProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const mountElement = mountRef.current
    if (mountElement === null) {
      return
    }

    const scene = graphic.createScene()

    scene.setup(mountElement)
    scene.resize({
      width: INSTAGRAM_WIDTH,
      height: INSTAGRAM_HEIGHT,
      dpr: INSTAGRAM_DPR,
    })
    scene.start()
    onCanvasChange?.(resolveStageCanvas(mountElement))
    onSceneChange?.(scene)

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry === undefined) {
        return
      }

      scene.resize({
        width: INSTAGRAM_WIDTH,
        height: INSTAGRAM_HEIGHT,
        dpr: INSTAGRAM_DPR,
      })
    })
    resizeObserver.observe(mountElement)

    return () => {
      resizeObserver.disconnect()
      scene.destroy()
      onCanvasChange?.(null)
      onSceneChange?.(null)
    }
  }, [graphic, onCanvasChange, onSceneChange, restartNonce])

  return <ReelsStage mountRef={mountRef} />
}
