import styles from './styles.module.css'
import config from '../configStyles.module.css'
import clsx from 'clsx'
import Step from '@site/src/components/Sections/Installation/InstallationStep'
import Elipse from '@site/src/components/Elipse'

const steps = [
  {
    name: 'Install Node.js',
    body: 'React Native requires Node.js installed on your system. You can download and install the latest version of Node.js from the official website.',
    image: {
      src: 'img/vscode.jpg',
      alt: 'banner',
    },
    config: {
      flexDirection: config.itemColumn,
      borderWidth: config.itemColumnBorder,
      borderColor: config.borderGreen,
    },
  },
  {
    name: 'Install a package manager',
    body: 'React Native requires Node.js installed on your system. You can download and install the latest version of Node.js from the official website.',
    image: {
      src: 'img/vscode.jpg',
      alt: 'banner',
    },
    config: {
      flexDirection: config.itemColumn,
      borderWidth: config.itemColumnBorder,
      borderColor: config.borderNavy,
    },
  },
  {
    name: 'Install JDK',
    body: 'React Native requires Node.js installed on your system. You can download and install the latest version of Node.js from the official website.',
    image: {
      src: 'img/vscode.jpg',
      alt: 'banner',
    },
    config: {
      flexDirection: config.itemRowReversed,
      borderWidth: config.itemRowBorder,
      borderColor: config.borderGreen,
    },
  },
  {
    name: 'Install JDK',
    body: 'React Native requires Node.js installed on your system. You can download and install the latest version of Node.js from the official website.',
    image: {
      src: 'img/vscode.jpg',
      alt: 'banner',
    },
    config: {
      flexDirection: config.itemRow,
      borderWidth: config.itemRowBorder,
      borderColor: config.borderNavy,
    },
  },
]

const Installation = () => {
  return (
    <section>
      <div className={styles.installation}>
        <h1 className={styles.installationHeading}>IDE: what is it?</h1>
        <span className={styles.installationSubheading}>
          Step by step installation instruction.
        </span>
        <div className={styles.installationStepsContainer}>
          {steps.map((step, idx) => (
            <div className={clsx(styles.step, step.config.flexDirection)}>
              <Step
                key={idx}
                name={step.name}
                body={step.body}
                idx={idx + 1}
                image={step.image}
                config={step.config}
              />
            </div>
          ))}
        </div>
      </div>
      <div className={styles.elipseContainer}>
        <Elipse isSmall className={styles.elipse} />
        <Elipse className={styles.elipse} size={290} />
      </div>
    </section>
  )
}

export default Installation
