import { useNavbarMobileSidebar } from "@docusaurus/theme-common/internal";
import { translate } from "@docusaurus/Translate";
import styles from "./styles.module.css";
import MenuIcon from "../../MenuIcon";
import CloseIcon from "../../CloseIcon";

export default function MobileSidebarToggle() {
  const { toggle, shown } = useNavbarMobileSidebar();
  return (
    <button
      onClick={toggle}
      aria-label={translate({
        id: "theme.docs.sidebar.toggleSidebarButtonAriaLabel",
        message: "Toggle navigation bar",
        description: "The ARIA label for hamburger menu button of mobile navigation",
      })}
      aria-expanded={shown}
      className={styles.menuIcon}
      type="button">
      {shown ? <CloseIcon /> : <MenuIcon />}
    </button>
  );
}
