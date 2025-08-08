import { useNavbarMobileSidebar } from "@docusaurus/theme-common/internal";
import styles from "./styles.module.css";
import MenuIcon from "../../MenuIcon";
import CloseIcon from "../../CloseIcon";

export default function MobileSidebarToggle() {
  const { toggle, shown } = useNavbarMobileSidebar();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle navigation bar"
      aria-expanded={shown}
      className={styles.menuIcon}
      type="button">
      {shown ? <CloseIcon /> : <MenuIcon />}
    </button>
  );
}
