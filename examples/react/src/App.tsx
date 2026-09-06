import { useState } from 'react'
import { RecorderDemo } from './RecorderDemo'

export const App = () => {
  const [sessionKey, setSessionKey] = useState(0)

  return (
    <RecorderDemo
      key={sessionKey}
      onReset={() => setSessionKey(key => key + 1)}
    />
  )
}
