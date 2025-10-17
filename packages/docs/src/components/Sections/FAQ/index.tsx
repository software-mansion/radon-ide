import React from "react";
import styles from "./styles.module.css";
import FaqList from "@site/src/components/FaqList";

const faqs = [
  {
    topic: "Can I try Radon IDE Pro for free?",
    answer:
      "Yes, the Pro plan for Radon IDE includes a free 2-week trial, allowing you to test all its features.",
  },
  {
    topic: "How can I pay for the Radon IDE license?",
    answer:
      "You can pay for the Pro plan using all the major credit cards. If you need a dedicated payment method and/or custom invoicing, please choose the Enterprise plan.",
  },
  {
    topic: "How can I get the license key?",
    answer: `You should receive your license key via e-mail after you make a purchase. Alternatively, you can get your license key from the <a href="https://portal.ide.swmansion.com/" target="_blank">Radon IDE Portal</a>. See the <a href="https://ide.swmansion.com/docs/guides/activation-manual" target="_blank">License Activation</a> guide for more details.
    `,
  },
  {
    topic: "How do I activate my license?",
    answer: `You activate the product by providing a license key in the extension panel.
    See the <a href="https://ide.swmansion.com/docs/guides/activation-manual" target="_blank">License Activation</a> page for a step-by-step guide.
    `,
  },
  {
    topic: "Who can use the Free plan?",
    answer: `Radon’s Free plan was created for those who are starting their React Native adventure - mainly students and hobbyists. If you’re a professional React Native developer working in commercial projects, according to our <a href="https://ide.swmansion.com/pricing" target="_blank">Subscription Agreement</a>, you should use the Pro tier.
    `,
  },
  {
    topic: "What happens with the money that I pay for the Radon IDE license?",
    answer: `Radon is maintained by Software Mansion, the software company that you know from many open-source React Native libraries. Because of that, 100% of the money you pay for Radon licenses is used to fund these open-source efforts at <a href="https://swmansion.com/" target="_blank">Software Mansion</a> and for the further development of Radon IDE.`,
  },
  {
    topic: "Can I use Radon on Windows and Linux?",
    answer: `Due to limited capacity, support for Linux and Windows is considered beta. Because of that, we don't distribute Windows or Linux builds via VSCode marketplace and you have to follow <a href="/">manual installation instructions</a>. Since Windows and Linux support is in beta, you don't have to purchase a license to use Radon IDE on those platforms, and you can use it under the free Beta license but keep in mind that the number of features will be limited.`,
  },
  {
    topic: "Can I use Radon in WebStorm?",
    answer:
      "At this moment WebStorm is not supported. As the adoption grows, we might add support for WebStorm in the future.",
  },
  {
    topic: "How do I cancel my Radon IDE subscription?",
    answer: `You can cancel your subscription at any time. To do so, click the "cancel your subscription" link in the email you received after purchase or visit our <a href="https://portal.ide.swmansion.com" target="_blank">Radon IDE Portal</a> to manage your subscription. If you have problems canceling your subscription, please contact us at <a href="mailto:ide@swmansion.com">ide@swmansion.com</a>.`,
  },
];

const FAQ = () => {
  return (
    <section>
      <div className={styles.faq}>
        <div className={styles.faqMain}>
          <h2 className={styles.faqHeading}>Frequently Asked Questions</h2>
          <span className={styles.faqSubheading}>
            Here are the answers to your most frequent questions about the Radon IDE.
          </span>
        </div>
        <div className={styles.faqsContainer}>
          <FaqList faqs={faqs} />
        </div>
      </div>
    </section>
  );
};

export default FAQ;
