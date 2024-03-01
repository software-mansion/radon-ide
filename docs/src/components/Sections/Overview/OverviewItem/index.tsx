import React from 'react'
import styles from './styles.module.css'

interface Props {
  title: string
  body: string
  mediaSrc?: string
}

const OverviewItem = ({ title, body, mediaSrc }: Props) => {
  return (
    <>
      <div className={styles.description}>
        <h2 className={styles.itemTitle}>{title}</h2>
        <p className={styles.itemBody}>{body}</p>
      </div>
      <div className={styles.media}>
        <video controls>
          <source src={mediaSrc} type='video/mp4' />
        </video>
      </div>
    </>
  )
}

export default OverviewItem
