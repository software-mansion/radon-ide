import React, { useState, forwardRef, useRef } from "react";
import styles from "./styles.module.css";
import { CustomSelect } from "../CustomSelect";
import Captcha from "./Captcha";
import usePageType from "@site/src/hooks/usePageType";
import clsx from "clsx";

const isProduction = process.env.NODE_ENV === "production";
const API_URL = isProduction ? "https://swmansion.dev" : "http://localhost:8787";

type EnterpriseFormProps = {
  trackSubmit: () => void;
};

const EnterpriseForm = forwardRef<HTMLDivElement, EnterpriseFormProps>(({ trackSubmit }, ref) => {
  const formRef = useRef();
  const [isSent, setIsSent] = useState(false);
  const [submitDisabled, setSubmitDisabled] = useState(false);
  const { isEnterprise } = usePageType();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    companyName: "",
    role: "",
    teamSize: "",
    message: "",
    token: "",
  });

  const [error, setError] = useState({
    name: false,
    email: false,
    companyName: false,
    token: false,
  });

  const [submitError, setSubmitError] = useState("");

  const err = "This field is required.";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCaptchaSolve = (token: string) => {
    setFormData((prev) => ({ ...prev, token }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {
      name: formData.name.trim() === "",
      email: formData.email.trim() === "",
      companyName: formData.companyName.trim() === "",
      token: formData.token.trim() === "",
    };

    setError(newErrors);
    setSubmitError("");

    if (Object.values(newErrors).some((val) => val)) return;
    try {
      setSubmitDisabled(true);
      const response = await fetch(API_URL + "/api/request-contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (response.ok) {
        setIsSent(true);
        trackSubmit();
      } else {
        setSubmitError(data?.error?.message || "Failed to submit form. Please try again.");
      }
    } catch (error) {
      setSubmitError(error.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitDisabled(false);
    }
  };

  return (
    <div ref={ref} className={clsx(styles.mainContainer, isEnterprise ? styles.bottomBorder : "")}>
      <div className={styles.description}>
        <h2 className={styles.heading}>
          Ready to streamline your team’s React Native development?
        </h2>
        <p className={styles.subheading}>
          Schedule a personalized demo and see how Radon can improve your team’s workflow.
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
                <label className={error.name ? styles.labelError : ""}>Your name </label>
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
                <label className={error.email ? styles.labelError : ""}>Email </label>
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
                <label className={error.companyName ? styles.labelError : ""}>Company name</label>
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
                  name="message"
                  id="message"
                  value={formData.message}
                  onChange={handleChange}
                />
              </div>

              <div>
                <Captcha onSolve={handleCaptchaSolve} />
                {error.token && <p className={styles.error}>{err}</p>}
              </div>

              {submitError && (
                <div>
                  <p className={styles.error}>{submitError}</p>
                </div>
              )}

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
