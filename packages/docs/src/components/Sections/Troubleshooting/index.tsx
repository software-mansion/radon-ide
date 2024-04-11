import React from 'react';
import styles from './styles.module.css'
import FaqList from '@site/src/components/FaqList'
import Elipse from '@site/src/components/Elipse'

const faqs = [
  {
    topic: 'Performance Issues',
    answer:
      'React Native apps may encounter platform-specific bugs on iOS and Android.',
  },
  {
    topic: 'Platform-Specific Bugs',
    answer:
      'React Native apps may encounter platform-specific bugs on iOS and Android.',
  },
  {
    topic: 'Third-Party Dependencies',
    answer:
      'React Native apps may encounter platform-specific bugs on iOS and Android.',
  },
  {
    topic: 'Limited Native Access',
    answer:
      'React Native apps may encounter platform-specific bugs on iOS and Android.',
  },
  {
    topic: 'Debugging and Tooling',
    answer:
      'React Native apps may encounter platform-specific bugs on iOS and Android.',
  },
  {
    topic: 'Code Maintainability',
    answer:
      'React Native apps may encounter platform-specific bugs on iOS and Android.',
  },
  {
    topic: 'Overhead of Bridge Communication',
    answer:
      'React Native apps may encounter platform-specific bugs on iOS and Android.',
  },
  {
    topic: 'Version Compatibility',
    answer:
      'React Native apps may encounter platform-specific bugs on iOS and Android.',
  },
  {
    topic: 'Security Concerns',
    answer:
      'React Native apps may encounter platform-specific bugs on iOS and Android.',
  },
]

const Troubleshooting = () => {
  return (
    <section>
      <div className={styles.elipseContainer}>
        <Elipse className={styles.elipse} size={290} />
        <Elipse isSmall className={styles.elipse} />
      </div>
      <div className={styles.troubleshooting}>
        <div className={styles.troubleshootingMain}>
          <h2 className={styles.troubleshootingHeading}>Troubleshooting</h2>
          <span className={styles.troubleshootingSubheading}>
            Short info about problems.
          </span>
        </div>
        <div>
          <FaqList faqs={faqs} />
        </div>
      </div>
    </section>
  )
}

export default Troubleshooting
