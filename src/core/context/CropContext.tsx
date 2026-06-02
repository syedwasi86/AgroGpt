import React, { createContext, useContext, useState } from 'react'

interface CropContextType {
  activeCrop: string
  sowingDate: string
  updateActiveCrop: (crop: string) => void
  updateSowingDate: (date: string) => void
}

const CropContext = createContext<CropContextType | undefined>(undefined)

export function CropProvider({ children }: { children: React.ReactNode }) {
  const [activeCrop, setActiveCrop] = useState<string>(() => {
    return localStorage.getItem('active_crop') || 'Rice'
  })

  const [sowingDate, setSowingDate] = useState<string>(() => {
    const active = localStorage.getItem('active_crop') || 'Rice'
    return localStorage.getItem(`sowing_date_${active}`) || ''
  })

  const updateActiveCrop = (crop: string) => {
    setActiveCrop(crop)
    localStorage.setItem('active_crop', crop)
    const date = localStorage.getItem(`sowing_date_${crop}`) || ''
    setSowingDate(date)
  }

  const updateSowingDate = (date: string) => {
    setSowingDate(date)
    localStorage.setItem(`sowing_date_${activeCrop}`, date)
  }

  return (
    <CropContext.Provider value={{ activeCrop, sowingDate, updateActiveCrop, updateSowingDate }}>
      {children}
    </CropContext.Provider>
  )
}

export function useCrop() {
  const context = useContext(CropContext)
  if (!context) {
    throw new Error('useCrop must be used within a CropProvider')
  }
  return context
}
