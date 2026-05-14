import type { RefObject } from 'react'

interface ReelsStageProps {
  mountRef: RefObject<HTMLDivElement | null>
}

export function ReelsStage({ mountRef }: ReelsStageProps) {
  return (
    <section className="reels-stage-shell">
      <div className="reels-stage-header">
        <h1>insta-graphics</h1>
        <p>Instagram Reels viewport (9:16)</p>
      </div>
      <div className="reels-stage" ref={mountRef} aria-label="Graphic scene viewport" />
    </section>
  )
}
