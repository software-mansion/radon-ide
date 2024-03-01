import React from 'react'
import styles from './styles.module.css'
import HomepageButton from '@site/src/components/HomepageButton'

const StartScreen = () => {
  return (
    <section className={styles.hero}>
      <div className={styles.heading}>
        <div>
          <h1 className={styles.headingLabel}>
            <span>React Native</span>
            <span>IDE</span>
          </h1>
          <h2 className={styles.subheadingLabel}>
            Integrated Development Environment (IDE) is a tool that helps in
            integrating all the functionalities for individuals programming in
            React Native.
          </h2>
        </div>
        <div>
          <HomepageButton
            href='/change-this'
            title='Download from VS Marketplace'
          />
        </div>
        <div className={styles.headingDisclaimer}>
          IDE is available only for macOS
        </div>
      </div>
    </section>
  )
}

export default StartScreen
