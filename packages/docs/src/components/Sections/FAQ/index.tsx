import React from "react";
import styles from "./styles.module.css";
import FaqList from "@site/src/components/FaqList";
import usePageType from "@site/src/hooks/usePageType";
import { faqEnterpriseData } from "./faqEnterpriseData";
import { faqPricingData } from "./faqPricingData";

const FAQ = () => {
  const { isEnterprise } = usePageType();
  const faqs = isEnterprise ? faqEnterpriseData : faqPricingData;
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
