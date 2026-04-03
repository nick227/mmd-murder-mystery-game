declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: any) => void
          prompt: () => void
        }
      }
    }
  }
}

export interface User {
  id: string      // Google sub
  email: string
  name: string
  avatar: string
}
