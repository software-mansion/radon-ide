import React from 'react'
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment'
import SmallElipse from '@site/src/components/Elipse/SmallElipseIcon'
import BigElipse from '@site/src/components/Elipse/BigElipseIcon'

interface Props {
  isSmall?: boolean
  className?: string
  size?: number
}

const Elipse = ({ isSmall = false, className, size }: Props) => {
  const currentComponent = isSmall ? (
    <SmallElipse className={className} size={size} />
  ) : (
    <BigElipse className={className} size={size} />
  )
  return <>{ExecutionEnvironment.canUseViewport && currentComponent}</>
}

export default Elipse
