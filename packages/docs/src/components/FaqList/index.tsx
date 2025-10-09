import React, { useState } from "react";
import { type ActiveItem } from "./FaqItem";
import FaqItem from "./FaqItem";

interface Props {
  faqs: {
    topic: string;
    answer: string;
  }[];
}

const FaqList = ({ faqs }: Props) => {
  const [activeItems, setActiveItems] = useState<ActiveItem[]>([
    {
      index: null,
      height: 0,
    },
  ]);

  return (
    <>
      {faqs.map((faq, index) => (
        <FaqItem
          key={index}
          index={index}
          answer={faq.answer}
          topic={faq.topic}
          activeItems={activeItems}
          setActiveItems={setActiveItems}
        />
      ))}
    </>
  );
};

export default FaqList;
