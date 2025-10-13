import React, { useEffect, useState } from "react";
import styles from "./styles.module.css";
import RadonIcon from "../../RadonIcon";
import ReactNativeIcon from "../../ReactNativeIcon";
import EyeIcon from "../../EyeIcon";
import { useInView } from "react-intersection-observer";
import { motion } from "motion/react";

const sentence = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 2.3,
    },
  },
};

const word = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const text = `Radon AI is a dedicated React Native AI assistant enhanced with up-to-date information about the React Native ecosystem. At its heart is our extensive React Native knowledge database, which is queried before answering your question.

We index all of the popular React Native libraries to match questions to relevant pieces of documentation, providing additional, accurate context to your conversation.

Our knowledge database is updated daily to provide the most up-to-date information.`;

export default function AI() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.5 });
  const answer = text.split(" ");

  return (
    <div className={styles.container}>
      <div className={styles.left}>
        <span>Ai</span>
        <div className={styles.textContent}>
          <div className={styles.heading}>
            <p>Your expert React Native</p>
            <p>AI assistant inside Radon IDE</p>
          </div>
          <p className={styles.subheading}>
            Enhance your favorite LLM with up-to-date knowledge about the React Native ecosystem.
          </p>
        </div>
      </div>
      <div className={styles.radonBackgroundImage}>
        <RadonIcon />
      </div>
      <div ref={ref} className={styles.right}>
        {inView && (
          <div className={styles.content}>
            <motion.div
              className={styles.emptyDiv}
              initial={{ height: 0 }}
              animate={{ height: 36 }}
              transition={{ duration: 0.3, delay: 2 }}
            />
            <motion.p
              initial={{ opacity: 1, height: "auto" }}
              animate={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, delay: 2 }}>
              /help What can you do?
            </motion.p>

            <div className={styles.chat}>
              <div className={styles.message}>
                <div className={styles.messageHeading}>
                  <div className={styles.icon}>
                    <ReactNativeIcon strokeWidth="5" height="12" width="13" />
                  </div>
                  <p>Message.jsx</p>
                </div>
                <p className={styles.current}>Current file</p>
                <EyeIcon />
              </div>
              <p className={styles.question}>
                <span>@radon</span>
                How to run LLMs locally?
              </p>
            </div>
            <motion.div
              className={styles.answerContainer}
              initial={{ height: 0 }}
              animate={{ height: 200 }}
              transition={{ duration: 0.3, delay: 2 }}>
              <div className={styles.gradient} />
              <motion.div
                className={styles.answer}
                variants={sentence}
                initial="hidden"
                animate="visible">
                {answer.map((wordText, i) => (
                  <motion.span key={i} variants={word} style={{ marginRight: "8px" }}>
                    {wordText}
                  </motion.span>
                ))}
              </motion.div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
