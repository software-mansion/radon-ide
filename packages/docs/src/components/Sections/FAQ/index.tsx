import React from "react";
import styles from "./styles.module.css";
import FaqList from "@site/src/components/FaqList";
import Elipse from "@site/src/components/Elipse";

const faqs = [
  {
    topic: "What is Radon IDE?",
    answer:
      "Radon IDE is a Visual Studio Code extension that aims to simplify the development of React Native applications.",
  },
  {
    topic: "Can I use it on Windows or Linux?",
    answer:
      "You can use the IDE with VSCode and Cursor to develop React Native apps for Android and iOS on macOS. Since version 0.0.18 we added experimental support for Windows that is compatible with VSCode and allows for developing apps for Android. Support for Linux is not yet available.",
  },
  {
    topic: "How much does it cost?",
    answer: `Radon IDE is free to use during the Beta period. We're working on a sustainable licensing model for the project.<br/><br/>
    100% of the money earned will be used to fund the React Native open source efforts at Software Mansion and the further developments of the Radon IDE.<br/><br/>
    `,
  },
  {
    topic: "Do you offer a student discount?",
    answer: `Yes! Radon IDE is free for students learning at accredited educational institutions. Only for non-commercial purposes.`,
  },
  {
    topic: "When are you planning to close the public Beta?",
    answer: "We're aiming to close the beta in November 2024.",
  },
  {
    topic: "Why did you make the source code public?",
    answer:
      "We are well aware there are an infinite number of ways of setting up your React Native project. With access to the code you can adjust the Radon IDE to make it run with your codebase.",
  },
  {
    topic: "What's up with the code license for Radon IDE?",
    answer: `TL;DR<br/>
It's okay to modify the code to run in your project and to fix bugs. However, do not distribute the project on your own in any way or form besides our official channels.<br/><br/>This license will evolve as we move beyond the Beta period. <a href="https://github.com/software-mansion/radon-ide/blob/main/LICENSE.txt" target="_blank">You can read the full license here</a>.`,
  },
  {
    topic: "Is WebStorm supported?",
    answer:
      "At this moment WebStorm is not supported.<br/><br/>As the adoption for the extension grows we might add a support for WebStorm in the future.",
  },
  {
    topic: "How does the Supporter's license discount work?",
    answer:
      "For every month your Supporter's license is active, you receive a 50% discount on the Individual or Team license. For example, if you have been a Supporter for 2 months, you will receive a 50% discount on an Individual or Team license for 2 months.",
  },
  {
    topic: "How do I cancel the subscription?",
    answer: `You can cancel your subscription at any time. To do so, click the "cancel your subscription" link in the email you received after purchase or visit <a href="https://paddle.net" target="_blank">paddle.net</a> to manage your subscription. If you have problems canceling your subscription, please contact us at ide@swmansion.com.`,
  },
];

const FAQ = () => {
  return (
    <section>
      <div className={styles.elipseContainer}>
        <Elipse className={styles.elipse} size={290} />
        <Elipse isSmall className={styles.elipse} />
      </div>
      <div className={styles.faq}>
        <div className={styles.faqMain}>
          <h2 className={styles.faqHeading}>FAQ</h2>
          <span className={styles.faqSubheading}>
            Here are the answers to your most frequent questions about the Radon IDE.
          </span>
        </div>
        <div>
          <FaqList faqs={faqs} />
        </div>
      </div>
    </section>
  );
};

export default FAQ;
