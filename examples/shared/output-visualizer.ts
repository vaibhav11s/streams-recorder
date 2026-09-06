export type AttachOutputVisualizerOptions = {
  audioContext?: AudioContext
}

export type OutputVisualizer = {
  resume: () => Promise<void>
  dispose: () => Promise<void>
}

export const attachOutputVisualizer = (
  stream: MediaStream,
  canvas: HTMLCanvasElement,
  { audioContext: sharedAudioContext }: AttachOutputVisualizerOptions = {},
): OutputVisualizer => {
  const ownsAudioContext = !sharedAudioContext
  const audioContext = sharedAudioContext ?? new AudioContext()
  const source = audioContext.createMediaStreamSource(stream)
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 256
  analyser.smoothingTimeConstant = 0.7
  source.connect(analyser)

  const bins = new Uint8Array(analyser.frequencyBinCount)
  const canvasContext = canvas.getContext('2d')
  let frame = 0
  let disposed = false

  const draw = () => {
    if (disposed || !canvasContext) return
    frame = requestAnimationFrame(draw)

    const { width, height } = canvas
    analyser.getByteFrequencyData(bins)
    canvasContext.clearRect(0, 0, width, height)
    canvasContext.fillStyle = getComputedStyle(canvas).getPropertyValue('--viz-bg') || '#111'
    canvasContext.fillRect(0, 0, width, height)

    const barCount = bins.length / 2
    const gap = 1
    const barWidth = Math.max(1, (width - gap * barCount) / barCount)
    canvasContext.fillStyle = getComputedStyle(canvas).getPropertyValue('--viz-bar') || '#5eead4'

    for (let i = 0; i < barCount; i += 1) {
      const magnitude = bins[i] ?? 0
      const barHeight = (magnitude / 255) * height
      const x = i * (barWidth + gap)
      canvasContext.fillRect(x, height - barHeight, barWidth, barHeight)
    }
  }

  const syncCanvasSize = () => {
    const ratio = window.devicePixelRatio || 1
    const cssWidth = canvas.clientWidth || canvas.width
    const cssHeight = canvas.clientHeight || canvas.height
    canvas.width = Math.max(1, Math.floor(cssWidth * ratio))
    canvas.height = Math.max(1, Math.floor(cssHeight * ratio))
  }

  syncCanvasSize()
  const resizeObserver = new ResizeObserver(syncCanvasSize)
  resizeObserver.observe(canvas)
  draw()

  return {
    // Best-effort: a suspended context before the first gesture, or an already
    // closed one, is not something the demo should report as a recorder error.
    async resume() {
      if (disposed || audioContext.state === 'running' || audioContext.state === 'closed') return
      try {
        await audioContext.resume()
      }
      catch {}
    },
    async dispose() {
      if (disposed) return
      disposed = true
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      source.disconnect()
      if (ownsAudioContext && audioContext.state !== 'closed') await audioContext.close()
    },
  }
}
