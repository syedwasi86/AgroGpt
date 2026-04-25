import { saveScan, getRecentScans, clearAllScans } from './lib/repository'

export async function testTenMBBlobStorage() {
  console.log('Starting 10MB Blob test...')
  
  // Create a 10MB array buffer
  const size = 10 * 1024 * 1024
  const buffer = new ArrayBuffer(size)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < size; i++) {
    view[i] = Math.floor(Math.random() * 256)
  }
  
  const blob = new Blob([buffer], { type: 'application/octet-stream' })
  console.log(`Generated Blob size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`)

  try {
    const start = performance.now()
    const scanId = await saveScan(blob, { mode: 'test', title: '10MB Test' })
    const end = performance.now()
    
    console.log(`✅ Successfully saved 10MB Blob. ID: ${scanId}. Time taken: ${(end - start).toFixed(2)}ms`)
    
    const scans = await getRecentScans(1)
    if (scans.length > 0 && scans[0].id === scanId) {
       console.log(`✅ Verified: Retrieved Blob of size ${(scans[0].imageBlob.size / 1024 / 1024).toFixed(2)} MB`)
    } else {
       console.error('❌ Failed to retrieve the newly saved 10MB blob.')
    }
    
    // Clean up
    await clearAllScans()
    console.log('Cleanup complete.')
    
  } catch (err) {
    console.error('❌ Failed to save 10MB Blob to IndexedDB. Error:', err)
  }
}
