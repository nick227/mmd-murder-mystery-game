export function storyHeroImage(title: string): string {
  const key = title.toLowerCase()
  if (key.includes('diamond') || key.includes('hollywood')) {
    return 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80'
  }
  return 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=80'
}

