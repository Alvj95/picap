import { Capacitor } from '@capacitor/core'

/**
 * Hands a text file (CSV export) to the OS: native share sheet in the Android app
 * (Drive, WhatsApp, email…), Web Share on mobile browsers, plain download elsewhere.
 */
export async function shareText(text: string, filename: string, mime = 'text/csv') {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
    const { uri } = await Filesystem.writeFile({ path: filename, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 })
    await Share.share({ title: 'Mi Anillo', files: [uri] })
    return
  }

  const blob = new Blob([text], { type: mime })
  const file = new File([blob], filename, { type: mime })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Mi Anillo' })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
