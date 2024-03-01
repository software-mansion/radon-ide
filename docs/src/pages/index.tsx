import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import Elipse from '@site/src/components/Elipse'
import Layout from '@theme/Layout'
import Hero from '@site/src/components/Hero/StartScreen'
import LearnMoreHero from '@site/src/components/LearnMore/LearnMoreHero'
import LearnMoreFooter from '@site/src/components/LearnMore/LearnMoreFooter'
import Installation from '@site/src/components/Sections/Installation'
import Overview from '@site/src/components/Sections/Overview'
import Troubleshooting from '@site/src/components/Sections/Troubleshooting'

import styles from './index.module.css'

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext()
  return (
    <Layout
      title={siteConfig.title}
      description='Description will go into a meta tag in <head />'
    >
      <div className={styles.preventfulContainer}>
        <div className={styles.container}>
          <Hero />
          <LearnMoreHero />
          <Installation />
          <Overview />
          <Troubleshooting />
          <LearnMoreFooter />
        </div>
      </div>
    </Layout>
  )
}
