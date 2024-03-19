import React from 'react'
import styles from '../styles.module.css'
import clsx from 'clsx'

interface Props {
  className?: string
  size?: number
}

function BigElipseIcon({ className, size }: Props) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      fill='none'
      viewBox='0 0 147 285'
      className={clsx(styles.elipse, className)}
    >
      <ellipse
        cx='147'
        cy='142.5'
        fill='url(#paint0_linear_1520_16196)'
        rx='147'
        ry='142.5'
      ></ellipse>
      <defs>
        <linearGradient
          id='paint0_linear_1520_16196'
          x1='147'
          x2='120.539'
          y1='0'
          y2='368.499'
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

export default BigElipseIcon
