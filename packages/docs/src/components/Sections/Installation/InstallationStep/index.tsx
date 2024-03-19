import clsx from 'clsx'
import styles from './styles.module.css'

interface StepImage {
  src?: string
  alt: string
}

interface Props {
  name: string
  body: string
  idx: number
  image: StepImage
  config: {
    flexDirection: string
    borderWidth: string
    borderColor: string
  }
}

const InstallationStep = ({ name, body, image, idx, config }: Props) => {
  return (
    <>
      <div className={styles.image}>
        <img
          src={image.src}
          alt={image.alt}
          className={clsx(config.borderColor, config.borderWidth)}
        />
      </div>
      <div className={styles.instruction}>
        <h3 className={styles.stepNumber}>STEP {idx}</h3>
        <h2 className={styles.stepName}>{name}</h2>
        <p className={styles.stepBody}>{body}</p>
      </div>
    </>
  )
}

export default InstallationStep
