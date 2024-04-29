import React from "react";
import clsx from "clsx";
import styles from "./styles.module.css";
import ChevronDownIcon from "@site/src/components/FaqList/ChevronDownIcon";
import { type Dispatch, useRef } from "react";

export interface ActiveItemProps {
  index: number | null;
  height: number | undefined;
}

interface FaqItemProps {
  topic: string;
  answer: string;
  index: number;
  isExpanded: boolean;
  setActiveItem: Dispatch<ActiveItemProps>;
}

const FaqItem = ({ index, topic, answer, isExpanded, setActiveItem }: FaqItemProps) => {
  const contentRef = useRef<HTMLDivElement | null>(null);

  const toggleAnswer = (index: number) => {
    if (isExpanded) {
      setActiveItem({ index: null, height: 0 });
    } else {
      setActiveItem({ index: index, height: contentRef.current?.clientHeight });
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
        onClick={() => toggleAnswer(index)}
        className={clsx(isExpanded ? styles.faqItemExpanded : styles.faqItemNormal)}>
        <div
          className={clsx(
            styles.faqItemQuestion,
            isExpanded ? styles.faqItemExpanded : styles.faqItemNormal
          )}>
          <span className={clsx(styles.question, isExpanded && styles.questionExpanded)}>
            {topic}
          </span>
          <div>
            <ChevronDownIcon
              color={"var(--swm-navy-light-100"}
              className={clsx(styles.chevronIcon, isExpanded ? styles.chevronIconExpanded : "")}
            />
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
