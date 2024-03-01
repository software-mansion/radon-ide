import React from 'react'
import styles from '../styles.module.css'
import clsx from 'clsx'

interface Props {
  className?: string
  size?: number
}

function SmallElipse({ className, size = 70 }: Props) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      fill='none'
      viewBox='0 0 69 67'
      className={clsx(styles.elipse, className)}
    >
      <ellipse
        cx='34.5'
        cy='33.5'
        fill='url(#paint0_linear_1520_16192)'
        rx='34.5'
        ry='33.5'
      ></ellipse>
      <defs>
        <linearGradient
          id='paint0_linear_1520_16192'
          x1='34.5'
          x2='28.269'
          y1='0'
          y2='86.628'
          gradientUnits='userSpaceOnUse'
        >
          <stop stopColor='#57B495'></stop>
          <stop offset='0.525' stopColor='#D0F4E8' stopOpacity='0.475'></stop>
          <stop offset='1' stopColor='#fff' stopOpacity='0'></stop>
        </linearGradient>
      </defs>
    </svg>
  )
}

export default SmallElipse
