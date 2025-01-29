import React from "react";
import styles from "./styles.module.css";
import FaqList from "@site/src/components/FaqList";
import Elipse from "@site/src/components/Elipse";

const faqs = [
  {
    topic: "What is Radon IDE?",
    answer:
      "Radon IDE is Visual Studio Code and Cursor extension that turns your editors into a fully fledged IDEs for React Native and Expo.",
  },
  {
    topic: "Can I use it on Windows or Linux?",
    answer:
      "You can use the IDE with VSCode and Cursor to develop React Native apps for Android and iOS on macOS. Since version 0.0.18 we added experimental support for Windows that is compatible with VSCode and allows for developing apps for Android. Support for Linux is not yet available.",
  },
  {
    topic: "How much does it cost?",
    answer: `Check out the <a href="https://ide.swmansion.com/pricing" target="_blank">pricing</a> page.<br/><br/>
    100% of the money earned are used to fund the React Native open source efforts at Software Mansion and the further developments of the Radon IDE.<br/><br/>
    `,
  },
  {
    topic: "Do you offer a free trial?",
    answer: `Yes! You can try the Radon IDE for 30 days. No sign up or card details needed.<br/><br/>
    You can simply download and run the extension from VSCode Marketplace. See our short <a href="http://ide.swmansion.com/docs/getting-started/installation#installing-the-radon-ide-extension" target="_blank">installation guide</a> on how to install the extension in VSCode and Cursor.`,
  },
  {
    topic: "How do I activate my license?",
    answer: `You activate the product by providing a license key in the extension panel.<br/><br/>
    See the <a href="https://ide.swmansion.com/docs/guides/activation-manual" target="_blank">License Activation</a> page for a step-by-step guide.<br/><br/>
    `,
  },
  {
    topic: "How can I get the license key?",
    answer: `You should receive your license key in an e-mail after you make a purchase. <br/><br/>
    Alternatively, you can get your license key from the <a href="https://portal.ide.swmansion.com/" target="_blank">Radon IDE Portal</a>. See the <a href="https://ide.swmansion.com/docs/guides/activation-manual">License Activation</a> guide for more details.<br/><br/>
    `,
  },
  {
    topic: "Why did you make the source code public?",
    answer:
      "We are well aware there are an infinite number of ways of setting up a React Native project. With access to the code you can adjust the Radon IDE to make it run with your codebase.",
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
    topic: "How do I cancel the subscription?",
    answer: `You can cancel your subscription at any time. To do so, click the "cancel your subscription" link in the email you received after purchase or visit our <a href="https://portal.ide.swmansion.com" target="_blank">Radon IDE Portal</a> to manage your subscription. If you have problems canceling your subscription, please contact us at <a href="mailto:ide@swmansion.com">ide@swmansion.com</a>.`,
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
