import { useEffect } from 'react'

/**
 * Sets the document title for the current page.
 * Lightweight alternative to react-helmet-async (React 19 compatible).
 */
export function usePageTitle(title: string) {
    useEffect(() => {
        const prev = document.title
        document.title = title ? `${title} | VIRUDTI JEWELLS ERP` : 'VIRUDTI JEWELLS | Jewells ERP'
        return () => { document.title = prev }
    }, [title])
}
