import React, { useState } from "react";
import clsx from "clsx";
import styles from "./styles.module.css";
import { type Dispatch, useRef } from "react";
import PlusIcon from "../PlusIcon";
import MinusIcon from "../MinusIcon";

export interface ActiveItem {
  index: number;
  height: number;
}

interface FaqItemProps {
  topic: string;
  answer: string;
  index: number;
  activeItems: ActiveItem[];
  setActiveItems: (items: ActiveItem[]) => void;
}

const FaqItem = ({ index, topic, answer, activeItems, setActiveItems }: FaqItemProps) => {
  const contentRef = useRef<HTMLDivElement | null>(null);

  const isExpanded = activeItems.some((item) => item.index === index);

  const toggleAnswer = () => {
    if (isExpanded) {
      setActiveItems(activeItems.filter((item) => item.index !== index));
    } else {
      const height = contentRef.current?.clientHeight;
      setActiveItems([...activeItems, { index, height }]);
    }
  };

  function createMarkup() {
    return { __html: answer };
  }

  return (
    <div className={styles.faqItemContainer}>
      <button
        id={`faq-${index}`}
        aria-expanded={isExpanded}
        onClick={() => toggleAnswer()}
        className={clsx(isExpanded ? styles.faqItemExpanded : styles.faqItemNormal)}>
        <div
          className={clsx(
            styles.faqItemQuestion,
            isExpanded ? styles.faqItemExpanded : styles.faqItemNormal
          )}>
          <h3 className={clsx(styles.question, isExpanded && styles.questionExpanded)}>{topic}</h3>
          <div className={styles.icon}>
            {isExpanded ? <MinusIcon className={styles.icon} /> : <PlusIcon />}
          </div>
        </div>
      </button>
      <div role="region" aria-labelledby={`faq-${index}`}>
        <div
          className={styles.answerContainer}
          style={{
            maxHeight:
              isExpanded && contentRef.current?.clientHeight
                ? `calc(${contentRef.current?.clientHeight}px + 0.5rem)`
                : 0,
          }}>
          <div
            className={styles.answer}
            ref={contentRef}
            dangerouslySetInnerHTML={createMarkup()}
          />
        </div>
      </div>
    </div>
  );
};

export default FaqItem;
