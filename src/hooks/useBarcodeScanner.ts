/**
 * useBarcodeScanner — Production-grade barcode scanner hook
 *
 * Uses @zxing/browser for reliable scanning across:
 *  - Android Chrome (rear camera via facingMode: environment)
 *  - iPhone Safari (playsinline required — handled by ZXing)
 *  - Laptop webcam
 *  - External USB cameras
 *
 * Supports: CODE_128, EAN-13, EAN-8, UPC-A, QR Code, CODE_39
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import {
    BrowserMultiFormatReader,
    IScannerControls,
} from '@zxing/browser'
import {
    BarcodeFormat,
    DecodeHintType,
} from '@zxing/library'

// ─── Types ───────────────────────────────────────────────────────────────────
export type CameraDevice = {
    deviceId: string
    label: string
    isRear: boolean
    isFront: boolean
}

type ScannerStatus = 'idle' | 'starting' | 'active' | 'error'

// ─── Build ZXing reader with all common barcode formats ──────────────────────
function createReader() {
    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.ITF,
    ])
    hints.set(DecodeHintType.TRY_HARDER, true)
    return new BrowserMultiFormatReader(hints)
}

// ─── Classify camera as rear / front ─────────────────────────────────────────
function classifyCamera(device: MediaDeviceInfo, idx: number): CameraDevice {
    const label = (device.label || '').toLowerCase()
    const isRear =
        label.includes('back') ||
        label.includes('rear') ||
        label.includes('environment') ||
        label.includes('0,') // Android rear camera pattern
    const isFront =
        label.includes('front') ||
        label.includes('user') ||
        label.includes('facetime') ||
        label.includes('selfie')

    return {
        deviceId: device.deviceId,
        label: device.label || (idx === 0 ? 'Camera (Default)' : `Camera ${idx + 1}`),
        isRear,
        isFront,
    }
}

// ─── Pick best camera: rear > non-front > first ───────────────────────────────
function pickBestCamera(cameras: CameraDevice[]): CameraDevice | null {
    if (!cameras.length) return null
    return (
        cameras.find(c => c.isRear) ??
        cameras.find(c => !c.isFront) ??
        cameras[0]
    )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useBarcodeScanner(
    videoRef: React.RefObject<HTMLVideoElement | null>,
    onScan: (barcode: string) => void,
) {
    const [status, setStatus] = useState<ScannerStatus>('idle')
    const [error, setError] = useState('')
    const [cameras, setCameras] = useState<CameraDevice[]>([])
    const [activeCameraId, setActiveCameraId] = useState<string | null>(null)

    const readerRef = useRef<BrowserMultiFormatReader | null>(null)
    const controlsRef = useRef<IScannerControls | null>(null)
    const onScanRef = useRef(onScan)
    onScanRef.current = onScan

    // ── Enumerate cameras (needs permission first) ────────────────────────────
    const detectCameras = useCallback(async (): Promise<CameraDevice[]> => {
        try {
            // Ask permission first so browser reveals real device labels
            await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
            })

            const devices = await navigator.mediaDevices.enumerateDevices()
            const videoInputs = devices
                .filter(d => d.kind === 'videoinput')
                .map((d, i) => classifyCamera(d, i))

            setCameras(videoInputs)
            return videoInputs
        } catch (err: any) {
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setError('Camera permission denied. Please allow camera access in your browser settings.')
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                setError('No camera found on this device. Use manual barcode entry below.')
            } else if (err.name === 'NotReadableError') {
                setError('Camera is in use by another app. Close it and try again.')
            } else {
                setError(`Camera error: ${err.message || 'Unknown error'}`)
            }
            return []
        }
    }, [])

    // ── Start scanning with a specific deviceId ───────────────────────────────
    const startWithCamera = useCallback(async (deviceId: string) => {
        setStatus('starting')
        setError('')

        // Stop previous controls if any
        if (controlsRef.current) {
            try { controlsRef.current.stop() } catch { /* ignore */ }
            controlsRef.current = null
        }

        // Ensure video element is available
        if (!videoRef.current) {
            setError('Video element not ready. Please try again.')
            setStatus('error')
            return
        }

        try {
            if (!readerRef.current) {
                readerRef.current = createReader()
            }

            const controls = await readerRef.current.decodeFromVideoDevice(
                deviceId,
                videoRef.current,
                (result, err) => {
                    if (result) {
                        // Successful scan — don't auto-stop, let user stop manually
                        onScanRef.current(result.getText())
                    } else if (err) {
                        // NotFoundException fires on every empty frame — ignore it
                        // Only catch real errors
                        if (
                            err.name !== 'NotFoundException' &&
                            err.message !== 'No MultiFormat Readers were able to detect the code.'
                        ) {
                            console.debug('[ZXing]', err.message)
                        }
                    }
                },
            )

            controlsRef.current = controls
            setActiveCameraId(deviceId)
            setStatus('active')
        } catch (err: any) {
            console.error('[ZXing] start error:', err)
            if (err.name === 'NotAllowedError') {
                setError('Camera permission denied. Please allow camera access.')
            } else if (err.name === 'NotFoundError') {
                setError('Selected camera not available. Try another camera.')
            } else {
                setError(`Failed to start camera: ${err.message}`)
            }
            setStatus('error')
        }
    }, [videoRef])

    // ── Main start function (auto-selects best camera) ────────────────────────
    const start = useCallback(async () => {
        setError('')
        setStatus('starting')

        let cams = cameras
        if (!cams.length) {
            cams = await detectCameras()
        }

        if (!cams.length) {
            setStatus('error')
            return
        }

        const best = pickBestCamera(cams)
        if (!best) {
            setError('Could not select a camera.')
            setStatus('error')
            return
        }

        await startWithCamera(best.deviceId)
    }, [cameras, detectCameras, startWithCamera])

    // ── Switch camera ─────────────────────────────────────────────────────────
    const switchCamera = useCallback(async (deviceId: string) => {
        await startWithCamera(deviceId)
    }, [startWithCamera])

    // ── Stop scanner ──────────────────────────────────────────────────────────
    const stop = useCallback(() => {
        if (controlsRef.current) {
            try { controlsRef.current.stop() } catch { /* ignore */ }
            controlsRef.current = null
        }
        // Clear the video srcObject
        if (videoRef.current) {
            const stream = videoRef.current.srcObject as MediaStream | null
            if (stream) {
                stream.getTracks().forEach(t => t.stop())
            }
            videoRef.current.srcObject = null
        }
        setActiveCameraId(null)
        setStatus('idle')
    }, [videoRef])

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (controlsRef.current) {
                try { controlsRef.current.stop() } catch { }
                controlsRef.current = null
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
