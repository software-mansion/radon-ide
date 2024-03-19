import React from 'react'
import styles from './styles.module.css'
import ElipseIcon from '@site/src/components/Hero/HeroElipse/ElipseIcon'

const HeroElipse = () => {
  return (
    <div className={styles.elipseHero}>
      <ElipseIcon />
    </div>
  )
}

export default HeroElipse
