/** Simulates a Google OAuth popup and returns a mock profile. */
export async function handleGoogleSignIn(): Promise<{
  email: string
  name: string
}> {
  await new Promise((r) => setTimeout(r, 700))
  return {
    email: 'farmer.agrogpt@gmail.com',
    name: 'AgroGPT Demo User',
  }
}
