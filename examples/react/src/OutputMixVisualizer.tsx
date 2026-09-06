import type { MutableRefObject } from 'react'
import type { OutputVisualizer } from '../../shared/output-visualizer'
import { useEffect, useRef } from 'react'
import { attachOutputVisualizer } from '../../shared/output-visualizer'

type OutputMixVisualizerProps = {
  stream: MediaStream
  audioContext: AudioContext
  visualizerRef: MutableRefObject<OutputVisualizer | null>
}

export const OutputMixVisualizer = ({
  stream,
  audioContext,
  visualizerRef,
}: OutputMixVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const visualizer = attachOutputVisualizer(stream, canvas, { audioContext })
    visualizerRef.current = visualizer

    return () => {
      visualizer.dispose()
      if (visualizerRef.current === visualizer) visualizerRef.current = null
    }
  }, [audioContext, stream, visualizerRef])

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={96}
      aria-label="Mixed output audio levels"
    />
  )
}
