import React, { useState } from "react";
import styles from "./styles.module.css";
import ChevronDownIcon from "../ChevronDownIcon";

export default function EnterpriseForm() {
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

  const err = "This fieled is required.";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const newErrors = {
      name: formData.name.trim() === "",
      email: formData.email.trim() === "",
      companyName: formData.companyName.trim() === "",
    };

    setError(newErrors);

    if (Object.values(newErrors).some((val) => val)) return;
  };

  return (
    <div className={styles.mainContainer}>
      <div className={styles.description}>
        <h2 className={styles.heading}>
          Ready to streamline your team’s React Native development?
        </h2>
        <p className={styles.subheading}>
          Schedule a personalized demo and see how Radon IDE can improve your team’s workflow.
        </p>
      </div>
      <div className={styles.formContainer}>
        <form onSubmit={handleSubmit}>
          <div>
            <label className={error.name && styles.labelError}>Your name* </label>
            <input
              type="text"
              name="name"
              id="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
            {error.name && <p className={styles.error}>{err}</p>}
          </div>
          <div>
            <label className={error.email && styles.labelError}>Email* </label>
            <input
              type="email"
              name="email"
              id="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
            {error.email && <p className={styles.error}>{err}</p>}
          </div>
          <div>
            <label className={error.companyName && styles.labelError}>Company name*</label>
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
            <label>Role</label>
            <input
              type="text"
              name="role"
              id="role"
              value={formData.role}
              onChange={handleChange}
            />
          </div>
          <div className={styles.selectWrapper}>
            <label>Select team size </label>
            <select
              name="teamSize"
              id="size"
              value={formData.teamSize}
              onChange={handleChange}
              className={styles.customSelect}
              required>
              <option value="" disabled>
                Select a value
              </option>
              <option className={styles.option} value="10">
                10
              </option>
              <option value="100">100</option>
              <option value="more">More</option>
            </select>
            <ChevronDownIcon className={styles.selectIcon} />
          </div>
          <div>
            <label>Tell us more about your needs</label>
            <textarea
              name="comment"
              id="comment"
              value={formData.comment}
              onChange={handleChange}
            />
          </div>
          <div>
            <button className={styles.submitButton} type="submit">
              Submit form
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
