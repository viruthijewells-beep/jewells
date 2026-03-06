import { useState, useRef, useCallback, useEffect } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

// ─── Types ───────────────────────────────────────────────────────
export type CameraDevice = {
    deviceId: string
    label: string
    isRear: boolean
    isFront: boolean
}

type ScannerStatus = 'idle' | 'starting' | 'active' | 'error'

const SUPPORTED_FORMATS = [
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.QR_CODE,
]

// ─── Auto-select best camera (rear > any > front) ────────────────
function pickBestCamera(cameras: CameraDevice[]): CameraDevice | null {
    if (cameras.length === 0) return null
    // Prefer rear camera
    const rear = cameras.find(c => c.isRear)
    if (rear) return rear
    // Then any non-front
    const other = cameras.find(c => !c.isFront)
    if (other) return other
    // Fallback to first
    return cameras[0]
}

function classifyCamera(device: MediaDeviceInfo, idx: number): CameraDevice {
    const label = device.label.toLowerCase()
    const isRear = label.includes('back') || label.includes('rear') || label.includes('environment')
    const isFront = label.includes('front') || label.includes('user') || label.includes('facetime')

    let displayLabel = device.label || `Camera ${idx + 1}`
    if (!device.label) {
        displayLabel = idx === 0 ? 'Camera (Default)' : `Camera ${idx + 1}`
    }

    return {
        deviceId: device.deviceId,
        label: displayLabel,
        isRear,
        isFront,
    }
}

// ─── Hook ────────────────────────────────────────────────────────
export function useBarcodeScanner(
    elementId: string,
    onScan: (barcode: string) => void,
    options?: {
        fps?: number
        qrboxWidth?: number
        qrboxHeight?: number
        autoStart?: boolean
    },
) {
    const {
        fps = 15,
        qrboxWidth = 280,
        qrboxHeight = 150,
        autoStart = false,
    } = options ?? {}

    const [status, setStatus] = useState<ScannerStatus>('idle')
    const [error, setError] = useState('')
    const [cameras, setCameras] = useState<CameraDevice[]>([])
    const [activeCameraId, setActiveCameraId] = useState<string | null>(null)
    const scannerRef = useRef<Html5Qrcode | null>(null)
    const onScanRef = useRef(onScan)
    onScanRef.current = onScan

    // ── Enumerate cameras ─────────────────────────────────────────
    const detectCameras = useCallback(async (): Promise<CameraDevice[]> => {
        try {
            // Request permission first (needed to get labels)
            await navigator.mediaDevices.getUserMedia({ video: true })
            const devices = await navigator.mediaDevices.enumerateDevices()
            const videoDevices = devices
                .filter(d => d.kind === 'videoinput')
                .map((d, i) => classifyCamera(d, i))
            setCameras(videoDevices)
            return videoDevices
        } catch (err: any) {
            if (err.name === 'NotAllowedError') {
                setError('Camera permission denied. Please allow camera access in your browser settings.')
            } else if (err.name === 'NotFoundError') {
                setError('No camera found on this device. Use manual barcode entry.')
            } else {
                setError(`Camera error: ${err.message}`)
            }
            return []
        }
    }, [])

    // ── Start scanner with specific camera ─────────────────────────
    const startWithCamera = useCallback(async (deviceId: string) => {
        setStatus('starting')
        setError('')

        try {
            // Stop any existing instance
            if (scannerRef.current) {
                try { await scannerRef.current.stop() } catch { }
                scannerRef.current = null
            }

            const scanner = new Html5Qrcode(elementId, {
                formatsToSupport: SUPPORTED_FORMATS,
                verbose: false,
            })
            scannerRef.current = scanner

            await scanner.start(
                { deviceId: { exact: deviceId } },
                {
                    fps,
                    qrbox: { width: qrboxWidth, height: qrboxHeight },
                    aspectRatio: 1.5,
                },
                (decodedText) => {
                    // Stop scanner after successful scan
                    try { scanner.stop() } catch { }
                    scannerRef.current = null
                    setStatus('idle')
                    setActiveCameraId(null)
                    onScanRef.current(decodedText)
                },
                () => { /* ignore failures */ },
            )

            setActiveCameraId(deviceId)
            setStatus('active')
        } catch (err: any) {
            setError(`Scanner failed: ${err.message}`)
            setStatus('error')
        }
    }, [elementId, fps, qrboxWidth, qrboxHeight])

    // ── Start scanner (auto-detect + auto-select) ──────────────────
    const start = useCallback(async () => {
        setError('')
        setStatus('starting')

        const detectedCameras = await detectCameras()
        if (detectedCameras.length === 0) {
            if (!error) setError('No cameras detected. Use manual barcode entry.')
            setStatus('error')
            return
        }

        const best = pickBestCamera(detectedCameras)
        if (!best) {
            setError('Could not select a camera.')
            setStatus('error')
            return
        }

        await startWithCamera(best.deviceId)
    }, [detectCameras, startWithCamera, error])

    // ── Switch camera ──────────────────────────────────────────────
    const switchCamera = useCallback(async (deviceId: string) => {
        await startWithCamera(deviceId)
    }, [startWithCamera])

    // ── Stop scanner ───────────────────────────────────────────────
    const stop = useCallback(async () => {
        if (scannerRef.current) {
            try { await scannerRef.current.stop() } catch { }
            scannerRef.current = null
        }
        setActiveCameraId(null)
        setStatus('idle')
    }, [])

    // ── Auto-start if requested ────────────────────────────────────
    useEffect(() => {
        if (autoStart) start()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Cleanup on unmount ─────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                try { scannerRef.current.stop() } catch { }
                scannerRef.current = null
            }
        }
    }, [])

    return {
        status,
        error,
        cameras,
        activeCameraId,
        isActive: status === 'active',
        isStarting: status === 'starting',
        start,
        stop,
        switchCamera,
        detectCameras,
    }
}
