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

const text = `To run Large Language Models (LLMs) locally in React Native using React Native ExecuTorch, you first need to install the react-native-executorch library in your project, which acts as a bridge to Meta's on-device AI runtime. Next, you must ensure your LLM—like a Llama or Qwen model—is exported and optimized into the .pte (PyTorch ExecuTorch) format, which is required for the on-device inference engine. Within your React Native component, you can then utilize the useLLM hook, providing the local path or remote URL to your .pte model file and its tokenizer. Finally, call the generate function from the hook with your prompt to initiate local, private, and serverless text generation on the mobile device, with the response updating the llm.response state progressively.`;

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
