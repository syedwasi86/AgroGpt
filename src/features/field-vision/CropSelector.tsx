import React from 'react'

export const SUPPORTED_CROPS = ['Chili', 'Cotton', 'Maize', 'Rice', 'Tomato']

interface Props {
  selectedCrop: string
  onChange: (crop: string) => void
}

export function CropSelector({ selectedCrop, onChange }: Props) {
  return (
    <div className="w-full mb-6 text-left">
      <label className="block text-sm font-bold text-white mb-2">
        Select Crop <span className="text-red-500">*</span>
      </label>
      <select
        value={selectedCrop}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-primary-500 focus:border-primary-500"
      >
        <option value="" disabled>Select a crop</option>
        {SUPPORTED_CROPS.map(crop => (
          <option key={crop} value={crop}>{crop}</option>
        ))}
        <option value="Other">Other</option>
      </select>
    </div>
  )
}
