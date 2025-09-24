import React, { useState, forwardRef, useRef } from "react";
import styles from "./styles.module.css";
import emailjs from "@emailjs/browser";
import { CustomSelect } from "../CustomSelect";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";

const EnterpriseForm = forwardRef<HTMLDivElement, {}>((props, ref) => {
  const formRef = useRef();
  const [isSent, setisSent] = useState(false);
  const [submitDisabled, setSubmitDisabled] = useState(false);

  const { siteConfig } = useDocusaurusContext();

  const SERVICE_ID = siteConfig.customFields.service_id;
  const CONTACT_TEMPLATE_ID = siteConfig.customFields.contact_template_id;
  const AUTO_REPLY_TEMPLATE_ID = siteConfig.customFields.auto_reply_template_id;
  const PUBLIC_KEY = siteConfig.customFields.public_key;

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    companyName: "",
    role: "",
    teamSize: "",
    comment: "",
  });

  const [error, setError] = useState({
    name: false,
    email: false,
    companyName: false,
  });

  const err = "This field is required.";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {
      name: formData.name.trim() === "",
      email: formData.email.trim() === "",
      companyName: formData.companyName.trim() === "",
    };

    setError(newErrors);

    if (Object.values(newErrors).some((val) => val)) return;

    try {
      setSubmitDisabled(true);
      await emailjs.sendForm(SERVICE_ID, CONTACT_TEMPLATE_ID, formRef.current, {
        publicKey: PUBLIC_KEY,
      });
      await emailjs.sendForm(SERVICE_ID, AUTO_REPLY_TEMPLATE_ID, formRef.current, {
        publicKey: PUBLIC_KEY,
      });
      setisSent(true);
    } catch (error) {
      console.log("FAILED...", error.text);
    }
  };

  return (
    <div ref={ref} className={styles.mainContainer}>
      <div className={styles.description}>
        <h2 className={styles.heading}>
          Ready to streamline your team’s React Native development?
        </h2>
        <p className={styles.subheading}>
          Schedule a personalized demo and see how Radon IDE can improve your team’s workflow.
        </p>
      </div>
      <div className={styles.formBox}>
        {isSent ? (
          <div className={styles.successContainer}>
            <h4>Thank you!</h4>
            <p>
              Your form has been submitted. A member of our team will contact you within 2 business
              days to discuss your enterprise needs.
            </p>
          </div>
        ) : (
          <div className={styles.formContainer}>
            <form ref={formRef} onSubmit={handleSubmit}>
              <div>
                <label className={error.name && styles.labelError}>Your name </label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  value={formData.name}
                  onChange={handleChange}
                />
                {error.name && <p className={styles.error}>{err}</p>}
              </div>
              <div>
                <label className={error.email && styles.labelError}>Email </label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  value={formData.email}
                  onChange={handleChange}
                />
                {error.email && <p className={styles.error}>{err}</p>}
              </div>
              <div>
                <label className={error.companyName && styles.labelError}>Company name</label>
                <input
                  type="text"
                  name="companyName"
                  id="company"
                  value={formData.companyName}
                  onChange={handleChange}
                />
                {error.companyName && <p className={styles.error}>{err}</p>}
              </div>
              <div>
                <label>
                  Role <span>(Optional)</span>
                </label>
                <input
                  type="text"
                  name="role"
                  id="role"
                  value={formData.role}
                  onChange={handleChange}
                />
              </div>
              <CustomSelect
                label="Select team size"
                name="teamSize"
                value={formData.teamSize}
                onChange={handleChange}
                placeholder="Select a value"
              />
              <div>
                <label>
                  Tell us more about your needs <span>(Optional)</span>
                </label>
                <textarea
                  name="comment"
                  id="comment"
                  value={formData.comment}
                  onChange={handleChange}
                />
              </div>
              <div>
                <button className={styles.submitButton} disabled={submitDisabled} type="submit">
                  Submit form
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
});
export default EnterpriseForm;
