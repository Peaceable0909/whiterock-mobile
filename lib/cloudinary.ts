/**
 * Cloudinary unsigned video upload for React Native.
 * No API key needed — uses upload preset "whiterock_videos" (unsigned).
 * Free tier: 25 GB storage, 25 GB bandwidth/month.
 */

const CLOUD_NAME    = 'dodhziaix'
const UPLOAD_PRESET = 'whiterock_videos'
const UPLOAD_URL    = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`

/**
 * Upload a video/audio file from a local URI to Cloudinary.
 * @param uri        Local file URI from expo-image-picker or expo-document-picker
 * @param mimeType   e.g. "video/mp4"
 * @param fileName   e.g. "clip.mp4"
 * @param onProgress Optional 0-100 percentage callback
 * @returns          Cloudinary CDN URL (https, public)
 */
export function uploadVideo(
  uri: string,
  mimeType = 'video/mp4',
  fileName = 'video.mp4',
  onProgress?: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', { uri, type: mimeType, name: fileName } as unknown as Blob)
    form.append('upload_preset', UPLOAD_PRESET)

    const xhr = new XMLHttpRequest()

    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText) as { secure_url?: string; error?: { message?: string } }
          if (res.secure_url) resolve(res.secure_url)
          else reject(new Error(res.error?.message ?? 'Cloudinary: no URL returned'))
        } catch {
          reject(new Error('Cloudinary: invalid response'))
        }
      } else {
        try {
          const res = JSON.parse(xhr.responseText) as { error?: { message?: string } }
          reject(new Error(res.error?.message ?? `Upload failed (${xhr.status})`))
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`))
        }
      }
    }

    xhr.onerror   = () => reject(new Error('Network error during upload'))
    xhr.ontimeout = () => reject(new Error('Upload timed out'))
    xhr.timeout   = 15 * 60 * 1000

    xhr.open('POST', UPLOAD_URL)
    xhr.send(form)
  })
}
