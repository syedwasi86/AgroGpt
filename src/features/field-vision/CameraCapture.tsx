import React, { useRef, useState, useEffect } from 'react'
import { Camera, Upload } from 'lucide-react'
import { validateImage } from './imagePreprocessor'

interface Props {
  onImageCaptured: (imageDataUrl: string, imageElement: HTMLImageElement) => void
}

export function CameraCapture({ onImageCaptured }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [errorMsg, setErrorMsg] = useState<string>('')
  
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      setErrorMsg('')
    } catch (err) {
      console.warn('Camera access failed, fallback to upload', err)
      setErrorMsg('Camera not available. Please use file upload.')
    }
  }

  useEffect(() => {
    startCamera()
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop())
    }
  }, [])

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        
        const img = new Image()
        img.onload = async () => {
          const val = await validateImage(img)
          if (!val.valid) {
            setErrorMsg(val.reason || 'Invalid image')
          } else {
            onImageCaptured(dataUrl, img)
            if (stream) stream.getTracks().forEach(t => t.stop())
          }
        }
        img.src = dataUrl
      }
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const validTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (!validTypes.includes(file.type)) {
        setErrorMsg('Invalid file type. Please upload JPG, PNG, or WEBP.')
        return
      }

      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        const img = new Image()
        img.onload = async () => {
          const val = await validateImage(img)
          if (!val.valid) {
            setErrorMsg(val.reason || 'Invalid image')
          } else {
            onImageCaptured(dataUrl, img)
            if (stream) stream.getTracks().forEach(t => t.stop())
          }
        }
        img.src = dataUrl
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="relative w-full flex flex-col items-center">
      {errorMsg && <div className="text-red-400 bg-red-400/10 p-2 rounded mb-4 text-sm w-full text-center">{errorMsg}</div>}
      
      {stream ? (
        <div className="relative w-full max-w-sm rounded-xl overflow-hidden bg-black/50">
          <video ref={videoRef} autoPlay playsInline className="w-full h-auto" />
          
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-48 h-64 border-2 border-primary-500/50 rounded-full opacity-60 flex flex-col items-center justify-center relative shadow-[0_0_20px_rgba(76,175,80,0.3)]">
               <div className="w-1 h-full bg-primary-500/30 absolute left-1/2 -translate-x-1/2"></div>
               <span className="text-primary-300 text-xs font-bold bg-black/40 px-2 py-1 rounded absolute bottom-4">Align leaf here</span>
            </div>
          </div>

          <div className="absolute bottom-4 left-0 w-full flex justify-center gap-4 px-4">
            <button
              onClick={handleCapture}
              className="bg-primary-600 hover:bg-primary-500 text-white p-4 rounded-full shadow-lg"
            >
              <Camera size={24} />
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-sm flex flex-col items-center justify-center p-8 border-2 border-dashed border-white/20 rounded-2xl bg-white/5">
          <Upload size={32} className="text-white/40 mb-4" />
          <p className="text-sm text-white/60 text-center mb-4">Camera not active. Upload a clear leaf photo.</p>
          <div className="relative overflow-hidden w-full">
            <input
              type="file"
              accept="image/jpeg, image/png, image/webp"
              onChange={handleFileUpload}
              className="absolute inset-0 z-50 h-full w-full cursor-pointer opacity-0"
            />
            <button className="w-full bg-primary-600/30 text-white font-medium py-2 rounded-xl">
              Choose File
            </button>
          </div>
        </div>
      )}
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}
