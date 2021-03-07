import * as THREE from 'three'
import * as React from 'react'
import { useRef, useCallback, useMemo, useEffect, useState } from 'react'
import { SharedCanvasContext } from 'react-three-fiber'

// @ts-ignore
import CCapture from './ccapture.js/src/CCapture.js'

type RecorderContext = [
  (context: SharedCanvasContext) => void,
  () => void,
  {
    playhead: number
    duration: number
    isRecording: boolean
    stopRecording: () => void
    getProgress: () => number
    getBlob: () => Blob
    getPlayhead: () => number
  }
]

type RecorderProps = {
  format: 'webm' | 'gif' | 'jpeg'
  duration: number
  framerate: number
  fps: number
  verbose: boolean
  motionBlurFrames: number
  children: React.ReactNode
  showWidget: boolean
  filename: string
}

const state = {
  shouldRecord: false,
  prevPlayhead: 0,
  isRecording: false,
  playhead: 0,
  duration: 0,
  blob: new Blob(),
}

const startRecording = () => {
  state.shouldRecord = true
  state.playhead = 0
}

const stopRecording = () => {
  console.log('TBI')
  state.shouldRecord = false
}

const getProgress = () => {
  return state.playhead / state.duration
}

const getBlob = () => {
  return state.blob
}

const getPlayhead = () => {
  return state.playhead
}

export function useCapture({
  format = 'webm',
  duration = 2,
  framerate = 24,
  fps = 24,
  verbose = false,
  motionBlurFrames = 0,
  showWidget = false,
  filename = 'recording',
}: RecorderProps): [
  (context: SharedCanvasContext) => void,
  () => void,
  {
    playhead: number
    duration: number
    isRecording: boolean
    blob: Blob
    getPlayhead: () => number
    prevPlayhead: number
    shouldRecord: boolean
    getProgress: () => number
    getBlob: () => Blob
    stopRecording: () => void
  }
] {
  const [isRecording, setRecording] = useState(false)

  const capturer = useMemo(() => {
    return new CCapture({
      format,
      framerate: fps || framerate,
      verbose,
      motionBlurFrames,
      display: showWidget,
    })
  }, [format, fps, framerate, motionBlurFrames, showWidget, verbose])

  const [clock] = useState(new THREE.Clock())
  const gl = useRef<THREE.WebGLRenderer>()

  const bind = useCallback(
    (context: SharedCanvasContext) => {
      context.clock.getElapsedTime = () => state.playhead % duration
      gl.current = context.gl
    },
    [duration]
  )

  const loop = useCallback(() => {
    let currentPlayhead = clock.getElapsedTime() % duration

    if (state.isRecording && ((state.duration !== 0 && currentPlayhead < state.playhead) || !state.shouldRecord)) {
      state.shouldRecord = false
      state.isRecording = false
      setRecording(false)
      capturer.stop()
      capturer.save((blob: Blob) => {
        state.blob = blob
        const fileURL = window.URL.createObjectURL(blob)
        const tempLink = document.createElement('a')
        tempLink.href = fileURL
        tempLink.setAttribute('download', `${filename}.${getExtension(format)}`)
        tempLink.click()
      })
    }

    if (!state.isRecording && state.shouldRecord && currentPlayhead < state.playhead) {
      state.isRecording = true
      capturer.start()
      setRecording(true)
    }

    if (state.isRecording) {
      if (gl.current) {
        capturer.capture(gl.current.domElement)
      } else {
        throw new Error('Missing gl')
      }
    }

    if (state.duration !== 0) state.playhead = currentPlayhead

    requestAnimationFrame(loop)
  }, [])

  useEffect(() => {
    requestAnimationFrame(loop)
  }, [loop])

  return [bind, startRecording, { stopRecording, getProgress, getBlob, getPlayhead, ...state, isRecording }]
}

function getExtension(format: string): string {
  if (format === 'webm' || format === 'gif') return format

  return 'tar'
}
