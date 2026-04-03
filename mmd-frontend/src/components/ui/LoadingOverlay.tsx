import { useEffect, useState } from 'react'

type LoadingOverlayProps = {
  isVisible: boolean
  message?: string
  minDuration?: number
  onComplete?: () => void
}

const gameTips = [
  "Pro tip: Read character backgrounds carefully for hidden clues",
  "Did you know? Every conversation could contain a vital piece of evidence",
  "Strategy: Take notes during discussions - you'll need them later",
  "Hint: Pay attention to what characters DON'T say",
  "Pro tip: Alibis can be broken with the right questions",
  "Did you know? The murderer often tries to redirect suspicion",
  "Strategy: Establish timelines for each character's movements",
  "Hint: Motive, means, and opportunity - find all three",
  "Pro tip: Some clues are only revealed through specific dialogue choices",
  "Did you know? Innocent characters may still lie to protect secrets",
  "Strategy: Compare testimonies to find contradictions",
  "Hint: The crime scene holds more than meets the eye",
  "Pro tip: Build relationships to unlock special dialogue options",
  "Did you know? Timing your accusations can be crucial",
  "Strategy: Work backwards from the crime to establish the sequence",
  "Hint: Sometimes the most obvious suspect is the right one",
  "Pro tip: Keep track of who knew what and when",
  "Did you know? Digital evidence can be as telling as physical clues",
  "Strategy: Test your theories before making final accusations",
  "Hint: The solution often connects seemingly unrelated events"
]

export function LoadingOverlay({ 
  isVisible, 
  message = "Loading...", 
  minDuration = 3000,
  onComplete 
}: LoadingOverlayProps) {
  const [currentTip, setCurrentTip] = useState('')
  const [startTime] = useState(Date.now())
  const [canComplete, setCanComplete] = useState(false)

  useEffect(() => {
    if (isVisible) {
      // Select random tip
      const randomTip = gameTips[Math.floor(Math.random() * gameTips.length)]
      setCurrentTip(randomTip)
      
      // Set minimum duration timer
      const timer = setTimeout(() => {
        setCanComplete(true)
      }, minDuration)
      
      return () => clearTimeout(timer)
    }
  }, [isVisible, minDuration])

  useEffect(() => {
    if (canComplete && isVisible && onComplete) {
      onComplete()
    }
  }, [canComplete, isVisible, onComplete])

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="text-center space-y-8 max-w-md mx-auto px-6">
        {/* Rotating shape */}
        <div className="relative w-20 h-20 mx-auto">
          <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-2 border-2 border-purple-500/20 rounded-full"></div>
          <div className="absolute inset-2 border-2 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '2s' }}></div>
        </div>

        {/* Main message */}
        <div className="space-y-2">
          <h2 className="text-2xl font-light text-white tracking-wide">
            {message}
          </h2>
          <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent mx-auto"></div>
        </div>

        {/* Random game tip */}
        <div className="space-y-3">
          <p className="text-sm text-blue-300 font-medium tracking-wide uppercase">
            Mystery Tip
          </p>
          <p className="text-gray-300 text-sm leading-relaxed italic">
            "{currentTip}"
          </p>
        </div>

        {/* Progress indicator */}
        <div className="space-y-2">
          <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
              style={{ 
                width: `${Math.min(100, ((Date.now() - startTime) / minDuration) * 100)}%` 
              }}
            ></div>
          </div>
          <p className="text-xs text-gray-400">
            Preparing your mystery experience...
          </p>
        </div>
      </div>
    </div>
  )
}
