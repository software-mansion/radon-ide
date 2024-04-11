import React, { useState } from 'react'
import { type ActiveItemProps } from './FaqItem'
import FaqItem from './FaqItem'

interface Props {
  faqs: {
    topic: string
    answer: string
  }[]
}

const FaqList = ({ faqs }: Props) => {
  const [activeItem, setActiveItem] = useState<ActiveItemProps>({
    index: null,
    height: 0,
  })

  return (
    <>
      {faqs.map((faq, index) => (
        <FaqItem
          key={index}
          index={index}
          answer={faq.answer}
          topic={faq.topic}
          isExpanded={activeItem.index === index}
          setActiveItem={setActiveItem}
        />
      ))}
    </>
  )
}

export default FaqList
