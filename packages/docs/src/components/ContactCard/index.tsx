import ArrowRightSmallIcon from "../ArrowRightSmallIcon";
import styles from "./styles.module.css";

interface ContactCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  linkText: string;
  linkHref: string;
  linkTarget?: "_blank" | "_top";
}

export default function ContactCard({
  icon,
  title,
  description,
  linkText,
  linkHref,
  linkTarget,
}: ContactCardProps) {
  return (
    <div className={styles.card}>
      <div>
        <h4>
          {icon} {title}
        </h4>
        <p>{description}</p>
      </div>
      <div>
        <a href={linkHref} target={linkTarget} className={styles.contactButton}>
          {linkText} <ArrowRightSmallIcon />
        </a>
      </div>
    </div>
  );
}
