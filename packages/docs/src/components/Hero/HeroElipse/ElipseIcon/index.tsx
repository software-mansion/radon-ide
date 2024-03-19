import React from 'react'
import useScreenSize from '@site/src/hooks/useScreenSize'

function ElipseIcon() {
  const { windowWidth } = useScreenSize()

  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={windowWidth * (windowWidth < 996 ? 0.6 : 0.5)}
      height='648'
      fill='none'
      viewBox='0 0 580 648'
    >
      <ellipse
        cx='423'
        cy='238'
        fill='url(#paint0_linear_1520_16076)'
        rx='423'
        ry='410'
      ></ellipse>
      <defs>
        <linearGradient
          id='paint0_linear_1520_16076'
          x1='423'
          x2='346.877'
          y1='-172'
          y2='888.244'
          gradientUnits='userSpaceOnUse'
        >
          <stop stopColor='#82CAB2'></stop>
          <stop offset='0.525' stopColor='#DFF2EC'></stop>
          <stop offset='1' stopColor='#fff' stopOpacity='0'></stop>
        </linearGradient>
      </defs>
    </svg>
  )
}

export default ElipseIcon
