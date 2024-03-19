import React from 'react'
import clsx from 'clsx'
import { useThemeConfig } from '@docusaurus/theme-common'
import {
  useHideableNavbar,
  useNavbarMobileSidebar,
} from '@docusaurus/theme-common/internal'
import { translate } from '@docusaurus/Translate'
import NavbarMobileSidebar from '@theme/Navbar/MobileSidebar'
import HeroElipse from '@site/src/components/Hero/HeroElipse'
import styles from './styles.module.css'
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment'

function NavbarBackdrop(props) {
  return (
    <div
      role='presentation'
      {...props}
      className={clsx('navbar-sidebar__backdrop', props.className)}
    />
  )
}

const LandingBackground = () => {
  return (
    <div className={styles.heroBackground}>
      {ExecutionEnvironment.canUseViewport && <HeroElipse />}
    </div>
  )
}

export default function NavbarLayout({ children }) {
  const {
    navbar: { hideOnScroll, style },
  } = useThemeConfig()
  const mobileSidebar = useNavbarMobileSidebar()
  const { navbarRef, isNavbarVisible } = useHideableNavbar(hideOnScroll)
  return (
    <div>
      <LandingBackground />
      <nav
        ref={navbarRef}
        aria-label={translate({
          id: 'theme.NavBar.navAriaLabel',
          message: 'Main',
          description: 'The ARIA label for the main navigation',
        })}
        className={clsx(
          'navbar',
          'navbar--fixed-top',
          styles.navbarLanding,
          hideOnScroll && [
            styles.navbarHideable,
            !isNavbarVisible && styles.navbarHidden,
          ],
          {
            'navbar--dark': style === 'dark',
            'navbar--primary': style === 'primary',
            'navbar-sidebar--show': mobileSidebar.shown,
          }
        )}
      >
        {children}
        <NavbarBackdrop onClick={mobileSidebar.toggle} />
        <NavbarMobileSidebar />
      </nav>
    </div>
  )
}
