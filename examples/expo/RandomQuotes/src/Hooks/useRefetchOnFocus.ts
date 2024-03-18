import { useFocusEffect } from '@react-navigation/native'
import { useEffect, useState } from 'react'

export const useRefetchOnFocus = (refetch = () => {}, canRefetch = true) => {
  const [isScreenFocused, setIsScreenFocused] = useState(false)
  useFocusEffect(() => {
    setIsScreenFocused(true)
    return () => setIsScreenFocused(false)
  })

  useEffect(() => {
    if (isScreenFocused && canRefetch) {
      refetch()
    }
  }, [canRefetch, isScreenFocused, refetch])
}
