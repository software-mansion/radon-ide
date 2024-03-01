import React from 'react'
import styles from './styles.module.css'
import HomepageButton from '@site/src/components/HomepageButton'

const LearnMoreFooter = () => {
  return (
    <section>
      <div className={styles.learnMoreSectionFooter}>
        <div>
          <p>Learn more about the features in the newest video about IDE</p>
        </div>
        <HomepageButton
          target='_blank'
          href='https://swmansion.com/'
          title='See the video'
        />
      </div>
    </section>
  )
}

export default LearnMoreFooter
