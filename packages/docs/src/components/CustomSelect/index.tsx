import React, { useState, useRef, useEffect } from "react";
import styles from "./styles.module.css";
import ChevronDownIcon from "../ChevronDownIcon";
import CheckIcon from "../CheckIcon";

export const CustomSelect = ({ name, value, onChange, label, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const teamSizeOptions = [
    { value: "1-10", label: "1-10" },
    { value: "11-50", label: "11-50" },
    { value: "51-200", label: "51-200" },
    { value: "201-500", label: "201-500" },
    { value: "501-1000", label: "501-1000" },
    { value: "1001+", label: "1001+" },
  ];
  const selectedOption = teamSizeOptions.find((option) => option.value === value);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  const handleOptionClick = (optionValue) => {
    const syntheticEvent = {
      target: {
        name: name,
        value: optionValue,
      },
    };
    onChange(syntheticEvent);
    setIsOpen(false);
  };

  return (
    <div className={styles.selectWrapper} ref={wrapperRef}>
      <label>
        {label} <span>(Optional)</span>
      </label>

      <select name={name} value={value} onChange={onChange} className={styles.hideSelect}>
        <option value="" disabled>
          {placeholder}
        </option>
        {teamSizeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <div
        className={styles.selectTrigger}
        tabIndex={0}
        role="button"
        onClick={() => setIsOpen(!isOpen)}>
        <div className={styles.selectContent}>
          {isOpen && <CheckIcon />}
          <span className={value ? "" : styles.placeholder}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDownIcon />
      </div>

      {isOpen && (
        <div className={styles.selectOptions}>
          {teamSizeOptions.map((option) => (
            <div
              key={option.value}
              className={styles.selectOption}
              onClick={() => handleOptionClick(option.value)}>
              <div className={option.value === value ? styles.active : ""}>
                <CheckIcon />
              </div>
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
